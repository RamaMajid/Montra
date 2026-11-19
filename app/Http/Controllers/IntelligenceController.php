<?php

namespace App\Http\Controllers;

use App\Models\FinancialInsight;
use App\Models\Workspace;
use App\Services\Intelligence\InsightEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Response;

class IntelligenceController extends Controller
{
    private function activeWorkspace(Request $request): Workspace
    {
        $id = (int) $request->session()->get('active_workspace_id');
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail($id);
        Gate::authorize('view', $workspace);

        return $workspace;
    }

    public function index(Request $request, InsightEngine $engine): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);

        // Always run idempotent evaluation to ensure fresh events/thresholds are captured
        $engine->evaluateWorkspace($workspace);

        $filters = [
            'rule_key' => $request->query('rule_key'),
            'severity' => $request->query('severity'),
            'is_read' => $request->query('is_read'),
        ];

        $insights = $engine->getInsights($workspace, $filters);
        $allInsights = $engine->getInsights($workspace);

        $unreadCount = $allInsights->where('is_read', false)->count();

        $bySeverity = [
            'critical' => $allInsights->where('severity', 'critical')->count(),
            'warning' => $allInsights->where('severity', 'warning')->count(),
            'info' => $allInsights->where('severity', 'info')->count(),
        ];

        $data = $insights->map(fn (FinancialInsight $item): array => [
            'id' => $item->id,
            'rule_key' => $item->rule_key,
            'title' => $item->title,
            'description' => $item->description,
            'severity' => $item->severity,
            'period_start' => $item->period_start ? $item->period_start->format('Y-m-d') : null,
            'period_end' => $item->period_end ? $item->period_end->format('Y-m-d') : null,
            'supporting_data' => $item->supporting_data,
            'is_read' => $item->is_read,
            'generated_at' => $item->generated_at->toIso8601String(),
        ])->all();

        return Response::json([
            'summary' => [
                'total_insights' => $allInsights->count(),
                'unread_insights' => $unreadCount,
                'by_severity' => $bySeverity,
            ],
            'insights' => $data,
            'notice' => 'Financial insights are deterministic, explainable rule-based calculations and do not constitute financial or investment advice.',
        ]);
    }

    public function markAsRead(Request $request, FinancialInsight $insight, InsightEngine $engine): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        if ((int) $insight->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        $engine->markAsRead($request->user(), $insight);

        return Response::json([
            'message' => 'Insight marked as read.',
        ]);
    }

    public function markAllAsRead(Request $request, InsightEngine $engine): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        $updated = $engine->markAllAsRead($request->user(), $workspace);

        return Response::json([
            'message' => 'All insights marked as read.',
            'updated_count' => $updated,
        ]);
    }
}
