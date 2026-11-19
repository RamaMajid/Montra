<?php

namespace App\Models;

use Database\Factories\GoalContributionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $savings_goal_id
 * @property int $amount
 * @property Carbon $contribution_date
 * @property string|null $notes
 * @property int $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property SavingsGoal $savingsGoal
 * @property User $creator
 */
class GoalContribution extends Model
{
    /** @use HasFactory<GoalContributionFactory> */
    use HasFactory;

    protected $fillable = [
        'savings_goal_id',
        'amount',
        'contribution_date',
        'notes',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'contribution_date' => 'date:Y-m-d',
        ];
    }

    /**
     * @return BelongsTo<SavingsGoal, $this>
     */
    public function savingsGoal(): BelongsTo
    {
        return $this->belongsTo(SavingsGoal::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
