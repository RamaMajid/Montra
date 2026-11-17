<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Workspace>
 */
class WorkspaceFactory extends Factory
{
    protected $model = Workspace::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'owner_id' => User::factory(),
            'name' => fake()->company().' Workspace',
            'type' => 'family',
            'description' => fake()->sentence(),
        ];
    }

    public function personal(): static
    {
        return $this->state(fn () => [
            'type' => 'personal',
            'name' => 'Personal Workspace',
        ]);
    }

    public function family(): static
    {
        return $this->state(fn () => [
            'type' => 'family',
        ]);
    }
}
