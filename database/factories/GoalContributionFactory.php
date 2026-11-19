<?php

namespace Database\Factories;

use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GoalContribution>
 */
class GoalContributionFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'savings_goal_id' => SavingsGoal::factory(),
            'created_by' => User::factory(),
            'amount' => 500000,
            'contribution_date' => '2026-11-19',
            'notes' => 'Setoran tabungan bulanan',
        ];
    }
}
