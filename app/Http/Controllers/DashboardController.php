<?php

namespace App\Http\Controllers;

use App\Http\Requests\DashboardFilterRequest;
use App\Models\Workspace;
use App\Services\FinancialAnalyticsService;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(DashboardFilterRequest $request, FinancialAnalyticsService $analytics): Response
    {
        $workspace = $this->workspace($request);
        $period = $analytics->resolvePeriod($request->validated());

        $accountBalances = $analytics->getAccountBalances($workspace);
        $trends = $analytics->getTrends($workspace, $period['start_date'], $period['end_date']);

        return Inertia::render('dashboard', [
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
            'filters' => $request->validated(),
        ]);
    }

    private function workspace(DashboardFilterRequest $request): Workspace
    {
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail((int) $request->session()->get('active_workspace_id'));

        return $workspace;
    }
}
