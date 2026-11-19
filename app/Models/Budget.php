<?php

namespace App\Models;

use Database\Factories\BudgetFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $workspace_id
 * @property string $name
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property int $total_amount
 * @property string $status
 * @property int $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property Workspace $workspace
 * @property User $creator
 */
class Budget extends Model
{
    /** @use HasFactory<BudgetFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'workspace_id',
        'name',
        'period_start',
        'period_end',
        'total_amount',
        'status',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'total_amount' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<BudgetCategory, $this>
     */
    public function budgetCategories(): HasMany
    {
        return $this->hasMany(BudgetCategory::class);
    }

    /**
     * @return BelongsToMany<Category, $this>
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'budget_categories')
            ->withPivot('allocated_amount')
            ->withTimestamps();
    }

    /**
     * @param  Builder<Budget>  $query
     * @return Builder<Budget>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    /**
     * @param  Builder<Budget>  $query
     * @return Builder<Budget>
     */
    public function scopeArchived(Builder $query): Builder
    {
        return $query->where('status', 'archived');
    }
}
