<?php

namespace Database\Factories;

use App\Models\Budget;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Budget>
 */
class BudgetFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'created_by' => User::factory(),
            'name' => 'Monthly budget',
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'total_amount' => 100000,
            'status' => 'active',
        ];
    }
}
