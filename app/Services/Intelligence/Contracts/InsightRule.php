<?php

namespace App\Services\Intelligence\Contracts;

use App\Models\Workspace;
use Illuminate\Support\Carbon;

interface InsightRule
{
    /**
     * Unique stable rule key.
     */
    public function key(): string;

    /**
     * Readable rule name.
     */
    public function name(): string;

    /**
     * Insight category.
     */
    public function category(): string;

    /**
     * Evaluate rule for the workspace within period.
     *
     * @return array<int, array{
     *     rule_key: string,
     *     title: string,
     *     description: string,
     *     severity: string,
     *     period_start: string|null,
     *     period_end: string|null,
     *     supporting_data: array<string, mixed>,
     *     fingerprint: string
     * }>
     */
    public function evaluate(Workspace $workspace, Carbon $startDate, Carbon $endDate): array;
}
