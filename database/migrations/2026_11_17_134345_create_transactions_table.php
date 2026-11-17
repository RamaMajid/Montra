<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('type', 16);
            $table->string('description');
            $table->bigInteger('amount');
            $table->date('transaction_date');
            $table->foreignId('account_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('source_account_id')->nullable()->constrained('accounts')->restrictOnDelete();
            $table->foreignId('destination_account_id')->nullable()->constrained('accounts')->restrictOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->string('source', 16)->default('manual');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['workspace_id', 'transaction_date']);
            $table->index(['workspace_id', 'type', 'transaction_date']);
            $table->index(['account_id', 'transaction_date']);
            $table->index(['source_account_id', 'transaction_date']);
            $table->index(['destination_account_id', 'transaction_date']);
            $table->index(['category_id', 'transaction_date']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'transfer'))");
            DB::statement('ALTER TABLE transactions ADD CONSTRAINT transactions_amount_check CHECK (amount > 0 AND amount <= 9223372036854775807)');
            DB::statement("ALTER TABLE transactions ADD CONSTRAINT transactions_source_check CHECK (source IN ('manual', 'import'))");
            DB::statement("ALTER TABLE transactions ADD CONSTRAINT transactions_shape_check CHECK ((type IN ('income', 'expense') AND account_id IS NOT NULL AND category_id IS NOT NULL AND source_account_id IS NULL AND destination_account_id IS NULL) OR (type = 'transfer' AND account_id IS NULL AND category_id IS NULL AND source_account_id IS NOT NULL AND destination_account_id IS NOT NULL AND source_account_id <> destination_account_id))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
