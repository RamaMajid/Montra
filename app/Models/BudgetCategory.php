<?php

namespace App\Models;

use Database\Factories\BudgetCategoryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $budget_id
 * @property int $category_id
 * @property int $allocated_amount
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Budget $budget
 * @property Category $category
 */
class BudgetCategory extends Model
{
    /** @use HasFactory<BudgetCategoryFactory> */
    use HasFactory;

    protected $fillable = [
        'budget_id',
        'category_id',
        'allocated_amount',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'allocated_amount' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Budget, $this>
     */
    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class);
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
