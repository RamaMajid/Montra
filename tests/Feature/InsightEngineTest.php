<?php

use App\Models\FinancialInsight;
use App\Models\Workspace;
use App\Services\Intelligence\Contracts\InsightRule;
use App\Services\Intelligence\InsightEngine;
use Illuminate\Support\Carbon;

function insightEngineRule(array $items): InsightRule
{
    return new class($items) implements InsightRule
    {
        public function __construct(private array $items) {}

        public function key(): string
        {
            return 'test';
        }

        public function name(): string
        {
            return 'Test';
        }

        public function category(): string
        {
            return 'test';
        }

        public function evaluate(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
        {
            return $this->items;
        }
    };
}

function insightEngineItem(string $fingerprint, string $title): array
{
    return [
        'rule_key' => 'test',
        'title' => $title,
        'description' => 'Updated description',
        'severity' => 'critical',
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-30',
        'supporting_data' => ['amount' => '200000'],
        'fingerprint' => $fingerprint,
    ];
}

it('refreshes a matching insight without changing its read state or another workspace', function () {
    $this->travelTo(Carbon::parse('2026-11-20 12:00:00'));
    $workspace = Workspace::factory()->create();
    $otherWorkspace = Workspace::factory()->create();
    $insight = FinancialInsight::factory()->for($workspace)->read()->create([
        'fingerprint' => 'shared',
        'title' => 'Old title',
        'created_at' => '2026-11-01 00:00:00',
    ]);
    $other = FinancialInsight::factory()->for($otherWorkspace)->create(['fingerprint' => 'shared', 'title' => 'Other workspace']);
    $engine = app(InsightEngine::class)->registerRule(insightEngineRule([insightEngineItem('shared', 'Updated title')]));

    $result = $engine->evaluateWorkspace($workspace);

    expect($result)->toHaveCount(1);
    $insight->refresh();
    expect($insight->title)->toBe('Updated title')
        ->and($insight->description)->toBe('Updated description')
        ->and($insight->severity)->toBe('critical')
        ->and($insight->rule_key)->toBe('test')
        ->and($insight->period_start->toDateString())->toBe('2026-11-01')
        ->and($insight->period_end->toDateString())->toBe('2026-11-30')
        ->and($insight->supporting_data)->toBe(['amount' => '200000'])
        ->and($insight->is_read)->toBeTrue()
        ->and($insight->created_at->toDateTimeString())->toBe('2026-11-01 00:00:00')
        ->and($insight->generated_at->toDateTimeString())->toBe('2026-11-20 12:00:00')
        ->and($other->fresh()->title)->toBe('Other workspace');
});

it('deduplicates repeated fingerprints within one evaluation using the last result', function () {
    $workspace = Workspace::factory()->create();
    $engine = app(InsightEngine::class)->registerRule(insightEngineRule([
        insightEngineItem('duplicate', 'First'),
        insightEngineItem('duplicate', 'Last'),
    ]));

    $result = $engine->evaluateWorkspace($workspace);

    expect($result)->toHaveCount(1)
        ->and($result->first()->title)->toBe('Last')
        ->and($result->first()->is_read)->toBeFalse();
    $this->assertDatabaseCount('financial_insights', 1);
});
