<?php

namespace App\Jobs;

use App\Actions\ManageTransaction;
use App\Models\ImportBatch;
use App\Models\ImportRow;
use App\Models\Workspace;
use App\Services\ImportRowValidator;
use App\Services\TransactionDuplicateDetector;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Throwable;

class ProcessImportBatch implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public int $batchId) {}

    public function handle(ManageTransaction $manage, ImportRowValidator $validator, TransactionDuplicateDetector $duplicates): void
    {
        $batch = ImportBatch::query()->with(['workspace', 'workspace.members', 'uploader'])->find($this->batchId);
        if (! $batch || ! in_array($batch->status, ['queued', 'processing'], true)) {
            return;
        }
        $uploader = $batch->workspace->members->firstWhere('user_id', $batch->uploaded_by);
        if (! $uploader || $uploader->role === 'viewer') {
            $batch->update(['status' => 'failed']);

            return;
        }
        $claimed = DB::transaction(function () use ($batch): bool {
            $locked = ImportBatch::query()
                ->whereKey($batch->id)
                ->whereIn('status', ['queued', 'processing'])
                ->lockForUpdate()
                ->first();

            if (! $locked) {
                return false;
            }

            $locked->update(['status' => 'processing']);

            return true;
        });

        if (! $claimed) {
            return;
        }
        $batch->rows()->whereIn('status', ['valid', 'failed'])->orderBy('id')->chunkById(config('imports.chunk_size'), function ($rows) use ($batch, $manage, $validator, $duplicates): void {
            foreach ($rows as $row) {
                DB::transaction(function () use ($batch, $manage, $validator, $duplicates, $row): void {
                    $workspace = Workspace::query()->lockForUpdate()->find($batch->workspace_id);
                    $membership = $workspace?->membershipFor($batch->uploader);
                    if (! $membership || $membership->role === 'viewer') {
                        throw new \RuntimeException('Import authorization revoked.');
                    }
                    $locked = ImportRow::query()->lockForUpdate()->find($row->id);
                    if (! $locked || $locked->status === 'imported' || $locked->transaction_id) {
                        return;
                    }
                    $data = $locked->normalized_data;
                    if (! is_array($data)) {
                        $locked->update(['status' => 'failed', 'error_message' => 'Row data invalid or missing.']);

                        return;
                    }
                    $error = $validator->validate($batch->workspace, $data);
                    if ($error) {
                        $locked->update(['status' => 'failed', 'error_message' => $error]);

                        return;
                    }
                    if ($duplicates->isDuplicate($batch->workspace, $data)) {
                        $locked->update(['status' => 'skipped', 'error_message' => 'Duplicate transaction.']);

                        return;
                    }
                    try {
                        $transaction = $manage->save($batch->uploader, $batch->workspace, [...$data, 'source' => 'import', 'import_batch_id' => $batch->id]);
                        $locked->update(['status' => 'imported', 'transaction_id' => $transaction->id, 'error_message' => null]);
                    } catch (Throwable $e) {
                        report($e);
                        $locked->update(['status' => 'failed', 'error_message' => 'Transaction could not be imported.']);
                    }
                });
            }
        });
        /** @var object{successful: int|string|null, failed: int|string|null, duplicate: int|string|null}|null $counts */
        $counts = DB::table('import_rows')
            ->where('import_batch_id', $batch->id)
            ->selectRaw("count(*) filter (where status = 'imported') as successful, count(*) filter (where status in ('invalid','failed')) as failed, count(*) filter (where status in ('duplicate','skipped')) as duplicate")
            ->first();

        $successful = (int) ($counts->successful ?? 0);
        $failed = (int) ($counts->failed ?? 0);
        $duplicate = (int) ($counts->duplicate ?? 0);

        $batch->update([
            'successful_rows' => $successful,
            'failed_rows' => $failed,
            'duplicate_rows' => $duplicate,
            'status' => $failed > 0 ? 'completed_with_errors' : 'completed',
        ]);
    }
}
