<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportPreviewRequest;
use App\Http\Requests\ImportUploadRequest;
use App\Jobs\ProcessImportBatch;
use App\Models\ImportBatch;
use App\Models\Workspace;
use App\Services\ImportFileReader;
use App\Services\ImportNormalizer;
use App\Services\ImportRowValidator;
use App\Services\TransactionDuplicateDetector;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ImportBatchController extends Controller
{
    private function workspace(Request $request): Workspace
    {
        $workspace = Workspace::query()->findOrFail((int) $request->session()->get('active_workspace_id'));
        Gate::authorize('view', $workspace);

        return $workspace;
    }

    public function index(Request $request): Response
    {
        $workspace = $this->workspace($request);
        $canCreate = Gate::allows('create', [ImportBatch::class, $workspace]);

        $query = $workspace->importBatches()->latest();
        $status = $request->query('status');
        if (is_string($status) && in_array($status, ['uploaded', 'previewed', 'queued', 'processing', 'completed', 'completed_with_errors', 'failed'], true)) {
            $query->where('status', $status);
        }

        return Inertia::render('imports/index', [
            'batches' => $query->paginate(15)->withQueryString()->through(fn (ImportBatch $b): array => $this->batch($b)),
            'filters' => ['status' => is_string($status) ? $status : ''],
            'canManage' => $canCreate,
            'canUpload' => $canCreate,
        ]);
    }

    public function store(ImportUploadRequest $request): RedirectResponse
    {
        $workspace = $this->workspace($request);
        $file = $request->file('file');
        $type = strtolower($file->getClientOriginalExtension());
        if (! in_array($type, ['csv', 'xlsx'], true)) {
            throw ValidationException::withMessages(['file' => 'Only CSV and XLSX files are supported.']);
        }
        $path = $file->store('imports', config('imports.disk'));
        if (! $path) {
            throw ValidationException::withMessages(['file' => 'Unable to store file.']);
        }
        try {
            $found = false;
            foreach (app(ImportFileReader::class)->rows(Storage::disk(config('imports.disk'))->path($path), $type) as $row) {
                $found = true;
            }
            if (! $found) {
                throw new \RuntimeException('Empty file.');
            }
            $batch = $workspace->importBatches()->create(['uploaded_by' => $request->user()->id, 'original_filename' => mb_substr(basename(str_replace('\\', '/', $file->getClientOriginalName())), 0, 255), 'storage_path' => $path, 'file_type' => $type]);
        } catch (Throwable $e) {
            Storage::disk(config('imports.disk'))->delete($path);
            throw ValidationException::withMessages(['file' => 'File is empty, malformed, or unsupported.']);
        }

        return to_route('imports.show', $batch);
    }

    public function show(Request $request, ImportBatch $importBatch): Response
    {
        abort_unless((int) $importBatch->workspace_id === (int) $request->session()->get('active_workspace_id'), 404);
        Gate::authorize('view', $importBatch);

        $workspace = $this->workspace($request);

        $headers = [];
        if ($importBatch->storage_path && in_array($importBatch->status, ['uploaded', 'previewed'], true) && Storage::disk(config('imports.disk'))->exists($importBatch->storage_path)) {
            try {
                foreach (app(ImportFileReader::class)->rows(Storage::disk(config('imports.disk'))->path($importBatch->storage_path), $importBatch->file_type) as $num => $row) {
                    if ($num === 1) {
                        $headers = $row;
                        break;
                    }
                }
            } catch (Throwable) {
                // file unreadable or missing
            }
        }

        return Inertia::render('imports/show', [
            'batch' => [...$this->batch($importBatch), 'mapping_config' => $importBatch->mapping_config],
            'headers' => $headers,
            'rows' => $importBatch->rows()->orderBy('row_number')->paginate(50),
            'accounts' => $workspace->accounts()->where('is_active', true)->get(['id', 'name']),
            'categories' => $workspace->categories()->where('is_active', true)->get(['id', 'name', 'type']),
            'canManage' => Gate::allows('update', $importBatch),
        ]);
    }

    public function preview(ImportPreviewRequest $request, ImportBatch $importBatch): RedirectResponse
    {
        Gate::authorize('update', $importBatch);
        $mapping = $request->validated('mapping');
        DB::transaction(function () use ($importBatch, $mapping): void {
            $importBatch = ImportBatch::query()->lockForUpdate()->findOrFail($importBatch->id);
            abort_unless(in_array($importBatch->status, ['uploaded', 'previewed'], true) && $importBatch->storage_path, 409);
            $importBatch->rows()->delete();
            $workspace = $importBatch->workspace;
            $reader = app(ImportFileReader::class);
            $normalizer = app(ImportNormalizer::class);
            $validator = app(ImportRowValidator::class);
            $duplicates = app(TransactionDuplicateDetector::class);
            $count = 0;
            $seenInBatch = [];
            foreach ($reader->rows(Storage::disk(config('imports.disk'))->path($importBatch->storage_path), $importBatch->file_type) as $number => $row) {
                if ($number === 1) {
                    continue;
                }
                $data = $normalizer->normalize($row, $mapping);
                $error = $validator->validate($workspace, $data);
                $fingerprint = implode('|', [
                    $data['type'] ?? '',
                    $data['transaction_date'] ?? '',
                    $data['amount'] ?? '',
                    mb_strtolower(trim($data['description'] ?? '')),
                    $data['type'] === 'transfer' ? ($data['source_account_id'] ?? '').':'.($data['destination_account_id'] ?? '') : ($data['account_id'] ?? ''),
                ]);
                $isDuplicate = ! $error && (isset($seenInBatch[$fingerprint]) || $duplicates->isDuplicate($workspace, $data));
                if (! $error) {
                    $seenInBatch[$fingerprint] = true;
                }
                $status = $error ? 'invalid' : ($isDuplicate ? 'duplicate' : 'valid');
                $importBatch->rows()->updateOrCreate(['row_number' => $number], ['raw_data' => $row, 'normalized_data' => $data, 'status' => $status, 'error_message' => $error]);
                $count++;
            }
            $importBatch->update(['total_rows' => $count, 'mapping_config' => $mapping, 'status' => 'previewed']);
        });

        return to_route('imports.show', $importBatch);
    }

    public function confirm(Request $request, ImportBatch $importBatch): RedirectResponse
    {
        abort_unless((int) $importBatch->workspace_id === (int) $request->session()->get('active_workspace_id'), 404);
        Gate::authorize('update', $importBatch);
        DB::transaction(function () use ($importBatch): void {
            $locked = ImportBatch::query()->lockForUpdate()->findOrFail($importBatch->id);
            abort_unless($locked->status === 'previewed', 409);
            $locked->update(['status' => 'queued', 'confirmed_at' => now()]);
        });
        ProcessImportBatch::dispatch($importBatch->id);

        return to_route('imports.show', $importBatch);
    }

    /** @return array<string, mixed> */
    private function batch(ImportBatch $batch): array
    {
        return $batch->only(['id', 'original_filename', 'file_type', 'status', 'total_rows', 'successful_rows', 'failed_rows', 'duplicate_rows', 'confirmed_at']);
    }
}
