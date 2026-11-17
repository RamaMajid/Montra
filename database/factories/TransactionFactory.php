<?php

namespace Database\Factories;

use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'type' => 'expense',
            'description' => fake()->sentence(3),
            'amount' => fake()->numberBetween(10000, 500000),
            'transaction_date' => now()->toDateString(),
            'account_id' => Account::factory(),
            'source_account_id' => null,
            'destination_account_id' => null,
            'category_id' => Category::factory(),
            'notes' => fake()->optional()->sentence(),
            'source' => 'manual',
            'created_by' => User::factory(),
        ];
    }

    public function income(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'income',
            'source_account_id' => null,
            'destination_account_id' => null,
        ]);
    }

    public function expense(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'expense',
            'source_account_id' => null,
            'destination_account_id' => null,
        ]);
    }

    public function transfer(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'transfer',
            'account_id' => null,
            'category_id' => null,
            'source_account_id' => Account::factory(),
            'destination_account_id' => Account::factory(),
        ]);
    }
}
