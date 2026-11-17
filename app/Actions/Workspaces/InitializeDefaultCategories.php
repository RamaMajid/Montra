<?php

namespace App\Actions\Workspaces;

use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

class InitializeDefaultCategories
{
    public function for(Workspace $workspace): void
    {
        DB::transaction(function () use ($workspace): void {
            $workspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            if ($workspace->getAttribute('default_categories_initialized_at') !== null) {
                return;
            }

            foreach ([
                'income' => ['Salary', 'Freelance', 'Business', 'Investment Return', 'Other Income'],
                'expense' => ['Food & Beverage', 'Transportation', 'Housing', 'Bills', 'Shopping', 'Entertainment', 'Healthcare', 'Education', 'Family', 'Other Expense'],
            ] as $type => $names) {
                foreach ($names as $name) {
                    $workspace->categories()->withTrashed()->firstOrCreate(
                        ['type' => $type, 'name' => $name],
                        ['is_default' => true],
                    );
                }
            }

            $workspace->forceFill(['default_categories_initialized_at' => now()])->save();
        });
    }
}
