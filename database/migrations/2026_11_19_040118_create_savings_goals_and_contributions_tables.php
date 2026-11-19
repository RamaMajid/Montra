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
        Schema::create('savings_goals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->bigInteger('target_amount');
            $table->date('target_date')->nullable();
            $table->string('status', 20)->default('active');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('created_by');
            $table->index(['workspace_id', 'status']);
            $table->index(['workspace_id', 'deleted_at']);
        });

        Schema::create('goal_contributions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('savings_goal_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('amount');
            $table->date('contribution_date');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['savings_goal_id', 'contribution_date']);
            $table->index('created_by');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE savings_goals ADD CONSTRAINT savings_goals_status_check CHECK (status IN ('active', 'completed', 'archived'))");
            DB::statement('ALTER TABLE savings_goals ADD CONSTRAINT savings_goals_target_amount_check CHECK (target_amount > 0 AND target_amount <= 9223372036854775807)');
            DB::statement('ALTER TABLE goal_contributions ADD CONSTRAINT goal_contributions_amount_check CHECK (amount > 0 AND amount <= 9223372036854775807)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('goal_contributions');
        Schema::dropIfExists('savings_goals');
    }
};
