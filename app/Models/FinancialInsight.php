<?php

namespace App\Models;

use Database\Factories\FinancialInsightFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $workspace_id
 * @property string $rule_key
 * @property string $title
 * @property string $description
 * @property string $severity
 * @property Carbon|null $period_start
 * @property Carbon|null $period_end
 * @property array<string, mixed> $supporting_data
 * @property bool $is_read
 * @property string $fingerprint
 * @property Carbon $generated_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Workspace $workspace
 */
class FinancialInsight extends Model
{
    /** @use HasFactory<FinancialInsightFactory> */
    use HasFactory;

    protected $fillable = [
        'workspace_id',
        'rule_key',
        'title',
        'description',
        'severity',
        'period_start',
        'period_end',
        'supporting_data',
        'is_read',
        'fingerprint',
        'generated_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'supporting_data' => 'array',
            'is_read' => 'boolean',
            'generated_at' => 'datetime',
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
     * @param  Builder<FinancialInsight>  $query
     * @return Builder<FinancialInsight>
     */
    public function scopeUnread(Builder $query): Builder
    {
        return $query->where('is_read', false);
    }

    /**
     * @param  Builder<FinancialInsight>  $query
     * @return Builder<FinancialInsight>
     */
    public function scopeRead(Builder $query): Builder
    {
        return $query->where('is_read', true);
    }

    /**
     * @param  Builder<FinancialInsight>  $query
     * @return Builder<FinancialInsight>
     */
    public function scopeRule(Builder $query, string $ruleKey): Builder
    {
        return $query->where('rule_key', $ruleKey);
    }

    /**
     * @param  Builder<FinancialInsight>  $query
     * @return Builder<FinancialInsight>
     */
    public function scopeSeverity(Builder $query, string $severity): Builder
    {
        return $query->where('severity', $severity);
    }
}
