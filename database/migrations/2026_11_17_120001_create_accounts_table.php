<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type', 16);
            $table->bigInteger('initial_balance')->default(0);
            $table->string('institution')->nullable();
            $table->text('description')->nullable();
            $table->string('icon', 64)->nullable();
            $table->string('color', 7)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['workspace_id', 'is_active']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE accounts ADD CONSTRAINT accounts_type_check CHECK (type IN ('bank', 'e_wallet', 'cash', 'savings', 'other'))");
            DB::statement("ALTER TABLE accounts ADD CONSTRAINT accounts_negative_balance_check CHECK (initial_balance >= 0 OR type IN ('bank', 'other'))");
            DB::statement("ALTER TABLE accounts ADD CONSTRAINT accounts_color_check CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')");
            DB::statement('CREATE UNIQUE INDEX accounts_workspace_name_unique ON accounts (workspace_id, lower(name)) WHERE deleted_at IS NULL');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};
