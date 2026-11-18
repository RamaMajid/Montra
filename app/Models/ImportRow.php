<?php

namespace App\Models;

use Database\Factories\ImportRowFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $import_batch_id
 * @property int $row_number
 * @property array<int, string> $raw_data
 * @property array<string, mixed>|null $normalized_data
 * @property string $status
 * @property string|null $error_message
 * @property int|null $transaction_id
 * @property ImportBatch $batch
 * @property Transaction|null $transaction
 */
class ImportRow extends Model
{
    /** @use HasFactory<ImportRowFactory> */
    use HasFactory;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['raw_data' => 'array', 'normalized_data' => 'array'];
    }

    /** @return BelongsTo<ImportBatch, $this> */
    public function batch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class, 'import_batch_id');
    }

    /** @return BelongsTo<Transaction, $this> */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
