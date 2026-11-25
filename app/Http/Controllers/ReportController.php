<?php

namespace App\Http\Controllers;

use App\Http\Requests\DashboardFilterRequest;
use App\Models\Workspace;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function show(DashboardFilterRequest $request, ReportService $reports, string $type): JsonResponse
    {
        return Response::json($reports->build($this->workspace($request), $type, $request->validated()));
    }

    public function export(DashboardFilterRequest $request, ReportService $reports, string $type): StreamedResponse
    {
        $report = $reports->build($this->workspace($request), $type, $request->validated());
        $name = "montra-{$type}-{$report['period']['start_date']}-{$report['period']['end_date']}.csv";

        return Response::streamDownload(function () use ($report): void {
            $out = fopen('php://output', 'w');
            if ($out === false) {
                throw new \RuntimeException('Unable to open CSV output stream.');
            }
            fputcsv($out, $report['columns'], ',', '"', '');
            foreach ($report['rows'] as $row) {
                fputcsv($out, array_map($this->csvCell(...), array_values($row)), ',', '"', '');
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Neutralise spreadsheet formula injection; numeric strings (incl. negatives) pass through. */
    private function csvCell(string|int|null $value): string|int
    {
        if ($value === null) {
            return '';
        }
        if (is_string($value) && ! is_numeric($value) && preg_match('/^[=+\-@\t\r]/', $value) === 1) {
            return "'".$value;
        }

        return $value;
    }

    private function workspace(DashboardFilterRequest $request): Workspace
    {
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail((int) $request->session()->get('active_workspace_id'));

        return $workspace;
    }
}
