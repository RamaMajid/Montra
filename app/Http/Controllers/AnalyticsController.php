<?php

namespace App\Http\Controllers;

use App\Http\Requests\DashboardFilterRequest;
use App\Models\Workspace;
use App\Services\FinancialAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Response;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class AnalyticsController extends Controller
{
    public function __invoke(DashboardFilterRequest $request, FinancialAnalyticsService $analytics): JsonResponse
    {
        return Response::json($this->payload($request, $analytics));
    }

    public function page(DashboardFilterRequest $request, FinancialAnalyticsService $analytics): InertiaResponse
    {
        return Inertia::render('analytics/index', [
            ...$this->payload($request, $analytics),
            'filters' => $request->validated(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(DashboardFilterRequest $request, FinancialAnalyticsService $analytics): array
    {
        $workspace = $this->workspace($request);
        $period = $analytics->resolvePeriod($request->validated());

        $accountBalances = $analytics->getAccountBalances($workspace);
        $trends = $analytics->getTrends($workspace, $period['start_date'], $period['end_date']);

        return [
            'period' => [
                'type' => $period['period'],
                'start_date' => $period['start_date']->format('Y-m-d'),
                'end_date' => $period['end_date']->format('Y-m-d'),
            ],
            'summary' => $analytics->getSummary($workspace, $period['start_date'], $period['end_date'], $accountBalances, $period['period']),
            'trends' => $trends,
            'category_trends' => $analytics->getCategoryTrends($workspace, $period['start_date'], $period['end_date']),
            'savings_rate_trends' => $analytics->getSavingsRateTrends($workspace, $period['start_date'], $period['end_date'], $trends),
            'expense_breakdown' => $analytics->getExpenseBreakdown($workspace, $period['start_date'], $period['end_date']),
            'account_distribution' => $analytics->getAccountDistribution($workspace, $accountBalances),
            'budget' => $analytics->getBudgetOverview($workspace, $period['start_date'], $period['end_date']),
            'recent_transactions' => $analytics->getRecentTransactions($workspace),
        ];
    }

    private function workspace(DashboardFilterRequest $request): Workspace
    {
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail((int) $request->session()->get('active_workspace_id'));

        return $workspace;
    }
}
