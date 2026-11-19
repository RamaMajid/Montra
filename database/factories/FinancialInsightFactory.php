<?php

namespace Database\Factories;

use App\Models\FinancialInsight;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FinancialInsight>
 */
class FinancialInsightFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'rule_key' => 'budget_warning',
            'title' => 'Peringatan Anggaran',
            'description' => 'Penggunaan anggaran telah mencapai 70% atau lebih.',
            'severity' => 'warning',
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'supporting_data' => [
                'utilization' => '75.00',
                'actual_amount' => '750000',
                'total_amount' => '1000000',
            ],
            'is_read' => false,
            'fingerprint' => fake()->sha256(),
            'generated_at' => now(),
        ];
    }

    public function read(): static
    {
        return $this->state(fn (): array => ['is_read' => true]);
    }
}
