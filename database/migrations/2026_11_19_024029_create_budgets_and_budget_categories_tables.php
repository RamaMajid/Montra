<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('budgets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->date('period_start');
            $table->date('period_end');
            $table->bigInteger('total_amount');
            $table->string('status', 20)->default('active');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('created_by');
            $table->index(['workspace_id', 'period_start', 'period_end']);
            $table->index(['workspace_id', 'status', 'period_start']);
        });

        Schema::create('budget_categories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('budget_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->bigInteger('allocated_amount');
            $table->timestamps();

            $table->unique(['budget_id', 'category_id']);
            $table->index('category_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE budgets ADD CONSTRAINT budgets_status_check CHECK (status IN ('active', 'archived'))");
            DB::statement('ALTER TABLE budgets ADD CONSTRAINT budgets_total_amount_check CHECK (total_amount > 0 AND total_amount <= 9223372036854775807)');
            DB::statement('ALTER TABLE budgets ADD CONSTRAINT budgets_period_check CHECK (period_start <= period_end)');
            DB::statement('ALTER TABLE budget_categories ADD CONSTRAINT budget_categories_allocated_amount_check CHECK (allocated_amount > 0 AND allocated_amount <= 9223372036854775807)');
            DB::statement("CREATE UNIQUE INDEX budgets_active_workspace_period_unique ON budgets (workspace_id, period_start) WHERE status = 'active' AND deleted_at IS NULL");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budget_categories');
        Schema::dropIfExists('budgets');
    }
};
