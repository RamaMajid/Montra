<?php

namespace Database\Factories;

use App\Models\ImportBatch;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ImportBatch>
 */
class ImportBatchFactory extends Factory
{
    protected $model = ImportBatch::class;

    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'uploaded_by' => User::factory(),
            'original_filename' => 'test_statement.csv',
            'storage_path' => 'imports/test_statement.csv',
            'file_type' => 'csv',
            'status' => 'uploaded',
            'total_rows' => 0,
            'successful_rows' => 0,
            'failed_rows' => 0,
            'duplicate_rows' => 0,
        ];
    }
}
