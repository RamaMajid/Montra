<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->jsonb('raw_data');
            $table->jsonb('normalized_data')->nullable();
            $table->string('status')->default('valid');
            $table->text('error_message')->nullable();
            $table->foreignId('transaction_id')->nullable()->index()->constrained('transactions')->nullOnDelete();
            $table->timestamps();
            $table->unique(['import_batch_id', 'row_number']);
            $table->index(['import_batch_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_rows');
    }
};
