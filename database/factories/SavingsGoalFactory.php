<?php

namespace Database\Factories;

use App\Models\SavingsGoal;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SavingsGoal>
 */
class SavingsGoalFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'created_by' => User::factory(),
            'name' => 'Emergency Fund',
            'description' => 'Target dana darurat 6 bulan',
            'target_amount' => 10000000,
            'target_date' => '2027-12-31',
            'status' => 'active',
        ];
    }

    public function completed(): static
    {
        return $this->state(fn (): array => ['status' => 'completed']);
    }

    public function archived(): static
    {
        return $this->state(fn (): array => ['status' => 'archived']);
    }
}
