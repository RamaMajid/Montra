<?php

namespace App\Console\Commands;

use App\Models\Workspace;
use App\Services\Intelligence\InsightEngine;
use Illuminate\Console\Command;

class GenerateInsightsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'montra:generate-insights {--workspace= : Specific workspace ID to evaluate}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Evaluate deterministic rule-based financial insights for workspaces';

    /**
     * Execute the console command.
     */
    public function handle(InsightEngine $engine): int
    {
        $workspaceId = $this->option('workspace');

        if ($workspaceId) {
            $workspace = Workspace::query()->find((int) $workspaceId);
            if (! $workspace) {
                $this->error("Workspace [{$workspaceId}] not found.");

                return self::FAILURE;
            }

            $insights = $engine->evaluateWorkspace($workspace);
            $this->info("Evaluated workspace [{$workspace->id}] — total insights: {$insights->count()}.");

            return self::SUCCESS;
        }

        $count = 0;
        Workspace::query()->chunkById(50, function ($workspaces) use ($engine, &$count): void {
            foreach ($workspaces as $workspace) {
                $engine->evaluateWorkspace($workspace);
                $count++;
            }
        });

        $this->info("Evaluated financial insights for {$count} workspaces.");

        return self::SUCCESS;
    }
}
