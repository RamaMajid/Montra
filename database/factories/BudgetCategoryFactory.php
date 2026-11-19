<?php

namespace Database\Factories;

use App\Models\Budget;
use App\Models\BudgetCategory;
use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BudgetCategory>
 */
class BudgetCategoryFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'budget_id' => Budget::factory(),
            'category_id' => Category::factory()->expense(),
            'allocated_amount' => 10000,
        ];
    }
}
