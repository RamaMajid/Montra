<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type', 16);
            $table->text('description')->nullable();
            $table->string('icon', 64)->nullable();
            $table->string('color', 7)->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['workspace_id', 'type', 'is_active']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE categories ADD CONSTRAINT categories_type_check CHECK (type IN ('income', 'expense'))");
            DB::statement("ALTER TABLE categories ADD CONSTRAINT categories_color_check CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')");
            DB::statement('CREATE UNIQUE INDEX categories_workspace_type_name_unique ON categories (workspace_id, type, lower(name)) WHERE deleted_at IS NULL');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
