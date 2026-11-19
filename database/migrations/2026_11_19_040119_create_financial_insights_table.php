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
        Schema::create('financial_insights', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('rule_key', 64);
            $table->string('title');
            $table->text('description');
            $table->string('severity', 20)->default('info');
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->json('supporting_data');
            $table->boolean('is_read')->default(false);
            $table->string('fingerprint', 64);
            $table->timestamp('generated_at');
            $table->timestamps();

            $table->unique(['workspace_id', 'fingerprint']);
            $table->index(['workspace_id', 'generated_at']);
            $table->index(['workspace_id', 'is_read']);
            $table->index(['workspace_id', 'rule_key']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE financial_insights ADD CONSTRAINT financial_insights_severity_check CHECK (severity IN ('info', 'warning', 'critical'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_insights');
    }
};
