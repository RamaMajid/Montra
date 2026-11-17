<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->string('name');
            $table->string('type', 16);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['owner_id', 'type']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE workspaces ADD CONSTRAINT workspaces_type_check CHECK (type IN ('personal', 'family'))");
            DB::statement("CREATE UNIQUE INDEX workspaces_one_personal_per_owner ON workspaces (owner_id) WHERE type = 'personal'");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('workspaces');
    }
};
