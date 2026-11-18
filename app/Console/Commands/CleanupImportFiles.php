<?php

namespace App\Console\Commands;

use App\Models\ImportBatch;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

#[Signature('imports:cleanup')]
#[Description('Remove expired private import files while retaining import history')]
class CleanupImportFiles extends Command
{
    public function handle(): int
    {
        ImportBatch::query()->whereIn('status', ['completed', 'completed_with_errors', 'failed'])->whereNotNull('storage_path')->where('updated_at', '<', now()->subDays(config('imports.retention_days')))->chunkById(100, function ($batches): void {
            foreach ($batches as $batch) {
                Storage::disk(config('imports.disk'))->delete($batch->storage_path);
                $batch->update(['storage_path' => null]);
            }
        });

        return self::SUCCESS;
    }
}
