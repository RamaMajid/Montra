<?php

namespace Database\Factories;

use App\Models\ImportBatch;
use App\Models\ImportRow;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ImportRow>
 */
class ImportRowFactory extends Factory
{
    protected $model = ImportRow::class;

    public function definition(): array
    {
        return [
            'import_batch_id' => ImportBatch::factory(),
            'row_number' => 2,
            'raw_data' => ['income', 'Payroll', '5000000', '2026-05-01'],
            'normalized_data' => [
                'type' => 'income',
                'description' => 'Payroll',
                'amount' => 5000000,
                'transaction_date' => '2026-05-01',
            ],
            'status' => 'valid',
            'error_message' => null,
            'transaction_id' => null,
        ];
    }
}
