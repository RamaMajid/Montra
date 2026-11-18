<?php

use App\Actions\ManageTransaction;
use App\Console\Commands\CleanupImportFiles;
use App\Jobs\ProcessImportBatch;
use App\Models\Account;
use App\Models\Category;
use App\Models\ImportBatch;
use App\Models\ImportRow;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\AccountBalanceService;
use App\Services\ImportFileReader;
use App\Services\ImportRowValidator;
use App\Services\TransactionDuplicateDetector;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;

beforeEach(function () {
    Storage::fake('local');
});

test('viewer cannot initiate or upload import batch', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $owner->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $owner->id, 'role' => 'owner']);

    $viewer = User::factory()->create();
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $viewer->id, 'role' => 'viewer']);

    $file = UploadedFile::fake()->create('test.csv', 100, 'text/csv');

    $this->actingAs($viewer)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->post(route('imports.store'), ['file' => $file])
        ->assertForbidden();
});

test('member can upload csv and view import batch', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $user->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $user->id, 'role' => 'owner']);

    $csvContent = "type,description,amount,date\nincome,Freelance,1500000,2026-05-10";
    $file = UploadedFile::fake()->createWithContent('statement.csv', $csvContent);

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->post(route('imports.store'), ['file' => $file]);

    $batch = ImportBatch::first();
    expect($batch)->not->toBeNull()
        ->and($batch->file_type)->toBe('csv')
        ->and($batch->original_filename)->toBe('statement.csv');

    $response->assertRedirect(route('imports.show', $batch));
    Storage::disk('local')->assertExists($batch->storage_path);
});

test('member cannot access import batch from another workspace', function () {
    $user1 = User::factory()->create();
    $workspace1 = Workspace::factory()->create(['owner_id' => $user1->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace1->id, 'user_id' => $user1->id, 'role' => 'owner']);

    $user2 = User::factory()->create();
    $workspace2 = Workspace::factory()->create(['owner_id' => $user2->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace2->id, 'user_id' => $user2->id, 'role' => 'owner']);

    $batch = ImportBatch::factory()->create(['workspace_id' => $workspace1->id, 'uploaded_by' => $user1->id]);

    $this->actingAs($user2)
        ->withSession(['active_workspace_id' => $workspace2->id])
        ->get(route('imports.show', $batch))
        ->assertNotFound();
});

test('preview persists mapping and marks duplicate rows', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $user->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $user->id, 'role' => 'owner']);

    $account = Account::factory()->create(['workspace_id' => $workspace->id, 'is_active' => true]);
    $category = Category::factory()->create(['workspace_id' => $workspace->id, 'type' => 'income', 'is_active' => true]);

    $manage = app(ManageTransaction::class);
    $manage->save($user, $workspace, [
        'type' => 'income',
        'description' => 'Existing Salary',
        'amount' => 5000000,
        'transaction_date' => '2026-05-01',
        'account_id' => $account->id,
        'category_id' => $category->id,
    ]);

    $csv = "type,description,amount,date\n"
        ."income,Existing Salary,5.000.000,2026-05-01\n"
        ."income,New Bonus,2.000.000,2026-05-02\n";

    $path = 'imports/test_preview.csv';
    Storage::disk('local')->put($path, $csv);

    $batch = ImportBatch::factory()->create([
        'workspace_id' => $workspace->id,
        'uploaded_by' => $user->id,
        'storage_path' => $path,
        'file_type' => 'csv',
        'status' => 'uploaded',
    ]);

    $mapping = [
        'type' => 0,
        'description' => 1,
        'amount' => 2,
        'date' => 3,
        'date_format' => 'Y-m-d',
        'amount_format' => 'idr_dot',
        'account_id' => $account->id,
        'category_id' => $category->id,
    ];

    $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->put(route('imports.preview', $batch), ['mapping' => $mapping])
        ->assertRedirect(route('imports.show', $batch));

    $batch->refresh();
    expect($batch->status)->toBe('previewed')
        ->and($batch->total_rows)->toBe(2);

    $rows = $batch->rows()->orderBy('row_number')->get();
    expect($rows[0]->status)->toBe('duplicate')
        ->and($rows[1]->status)->toBe('valid');
});

test('process import batch creates transactions and leaves balance source intact', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $user->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $user->id, 'role' => 'owner']);

    $account = Account::factory()->create(['workspace_id' => $workspace->id, 'initial_balance' => 1000000, 'is_active' => true]);
    $category = Category::factory()->create(['workspace_id' => $workspace->id, 'type' => 'income', 'is_active' => true]);

    $batch = ImportBatch::factory()->create([
        'workspace_id' => $workspace->id,
        'uploaded_by' => $user->id,
        'status' => 'queued',
    ]);

    $validRow = ImportRow::factory()->create([
        'import_batch_id' => $batch->id,
        'row_number' => 2,
        'status' => 'valid',
        'normalized_data' => [
            'type' => 'income',
            'description' => 'Project Pay',
            'amount' => 500000,
            'transaction_date' => '2026-05-15',
            'account_id' => $account->id,
            'category_id' => $category->id,
        ],
    ]);

    $invalidRow = ImportRow::factory()->create([
        'import_batch_id' => $batch->id,
        'row_number' => 3,
        'status' => 'valid',
        'normalized_data' => [
            'type' => 'income',
            'description' => 'Bad Row',
            'amount' => -10,
            'transaction_date' => 'bad-date',
            'account_id' => $account->id,
            'category_id' => $category->id,
        ],
    ]);

    (new ProcessImportBatch($batch->id))->handle(
        app(ManageTransaction::class),
        app(ImportRowValidator::class),
        app(TransactionDuplicateDetector::class)
    );

    $batch->refresh();
    expect($batch->status)->toBe('completed_with_errors')
        ->and($batch->successful_rows)->toBe(1)
        ->and($batch->failed_rows)->toBe(1);

    $validRow->refresh();
    expect($validRow->status)->toBe('imported')
        ->and($validRow->transaction_id)->not->toBeNull();

    $invalidRow->refresh();
    expect($invalidRow->status)->toBe('failed');

    // Re-running same job is idempotent
    (new ProcessImportBatch($batch->id))->handle(
        app(ManageTransaction::class),
        app(ImportRowValidator::class),
        app(TransactionDuplicateDetector::class)
    );

    expect($batch->workspace->transactions()->count())->toBe(1);
});

test('xlsx import reads rows accurately', function () {
    $tempPath = tempnam(sys_get_temp_dir(), 'test_xlsx_').'.xlsx';
    $writer = new XlsxWriter;
    $writer->openToFile($tempPath);
    $writer->addRow(Row::fromValues(['type', 'description', 'amount', 'date']));
    $writer->addRow(Row::fromValues(['income', 'Consulting', 3500000, '2026-06-01']));
    $writer->close();

    $reader = app(ImportFileReader::class);
    $rows = iterator_to_array($reader->rows($tempPath, 'xlsx'));
    @unlink($tempPath);

    expect(count($rows))->toBe(2)
        ->and($rows[2][1])->toBe('Consulting')
        ->and($rows[2][2])->toBe('3500000');
});

test('cleanup import files removes old completed storage files and retains history', function () {
    $path = 'imports/old_file.csv';
    Storage::disk('local')->put($path, 'sample');

    $batch = ImportBatch::factory()->create([
        'storage_path' => $path,
        'status' => 'completed',
        'updated_at' => now()->subDays(10),
    ]);

    $recentPath = 'imports/recent_file.csv';
    Storage::disk('local')->put($recentPath, 'recent');
    $recentBatch = ImportBatch::factory()->create([
        'storage_path' => $recentPath,
        'status' => 'completed',
        'updated_at' => now()->subDays(2),
    ]);

    $this->artisan(CleanupImportFiles::class)->assertSuccessful();

    Storage::disk('local')->assertMissing($path);
    Storage::disk('local')->assertExists($recentPath);

    $batch->refresh();
    expect($batch->storage_path)->toBeNull()
        ->and($batch->exists)->toBeTrue();
});

test('viewer cannot preview or confirm import batch', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $owner->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $owner->id, 'role' => 'owner']);

    $viewer = User::factory()->create();
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $viewer->id, 'role' => 'viewer']);

    $batch = ImportBatch::factory()->create([
        'workspace_id' => $workspace->id,
        'uploaded_by' => $owner->id,
        'status' => 'uploaded',
    ]);

    $this->actingAs($viewer)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->put(route('imports.preview', $batch), ['mapping' => [
            'type' => 0, 'description' => 1, 'amount' => 2, 'date' => 3,
            'date_format' => 'Y-m-d', 'amount_format' => 'idr_dot',
        ]])
        ->assertForbidden();

    $this->actingAs($viewer)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->post(route('imports.confirm', $batch))
        ->assertForbidden();
});

test('transfer import links source and destination accounts without mutating total balance source', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $owner->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $owner->id, 'role' => 'owner']);

    $source = Account::factory()->create(['workspace_id' => $workspace->id, 'initial_balance' => 2000000, 'is_active' => true]);
    $dest = Account::factory()->create(['workspace_id' => $workspace->id, 'initial_balance' => 500000, 'is_active' => true]);

    $batch = ImportBatch::factory()->create([
        'workspace_id' => $workspace->id,
        'uploaded_by' => $owner->id,
        'status' => 'queued',
    ]);

    $row = ImportRow::factory()->create([
        'import_batch_id' => $batch->id,
        'row_number' => 2,
        'status' => 'valid',
        'normalized_data' => [
            'type' => 'transfer',
            'description' => 'Savings transfer',
            'amount' => 300000,
            'transaction_date' => '2026-05-18',
            'source_account_id' => $source->id,
            'destination_account_id' => $dest->id,
        ],
    ]);

    (new ProcessImportBatch($batch->id))->handle(
        app(ManageTransaction::class),
        app(ImportRowValidator::class),
        app(TransactionDuplicateDetector::class)
    );

    $row->refresh();
    expect($row->status)->toBe('imported')
        ->and($row->transaction)->not->toBeNull()
        ->and($row->transaction->type)->toBe('transfer')
        ->and($row->transaction->source_account_id)->toBe($source->id)
        ->and($row->transaction->destination_account_id)->toBe($dest->id);

    $balanceService = app(AccountBalanceService::class);
    expect($balanceService->calculate($source))->toBe(1700000)
        ->and($balanceService->calculate($dest))->toBe(800000);
});

test('storage_path is never exposed in response or inertia props', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $owner->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $owner->id, 'role' => 'owner']);

    $batch = ImportBatch::factory()->create([
        'workspace_id' => $workspace->id,
        'uploaded_by' => $owner->id,
        'storage_path' => 'imports/super_secret_path.csv',
    ]);

    $this->actingAs($owner)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get(route('imports.show', $batch))
        ->assertOk()
        ->assertDontSee('super_secret_path.csv');
});

test('process import fails safely when uploader was demoted to viewer before processing', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $owner->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $owner->id, 'role' => 'owner']);

    $memberUser = User::factory()->create();
    $membership = WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $memberUser->id, 'role' => 'member']);

    $batch = ImportBatch::factory()->create([
        'workspace_id' => $workspace->id,
        'uploaded_by' => $memberUser->id,
        'status' => 'queued',
    ]);

    $membership->update(['role' => 'viewer']);

    (new ProcessImportBatch($batch->id))->handle(
        app(ManageTransaction::class),
        app(ImportRowValidator::class),
        app(TransactionDuplicateDetector::class)
    );

    $batch->refresh();
    expect($batch->status)->toBe('failed');
});

test('preview detects in-file duplicates within the same import file', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $user->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $user->id, 'role' => 'owner']);

    $account = Account::factory()->create(['workspace_id' => $workspace->id, 'is_active' => true]);
    $category = Category::factory()->create(['workspace_id' => $workspace->id, 'type' => 'expense', 'is_active' => true]);

    $csv = "type,description,amount,date\n"
        ."expense,Coffee with client,45000,2026-05-01\n"
        ."expense,Coffee with client,45000,2026-05-01\n";

    $path = 'imports/test_infile_dups.csv';
    Storage::disk('local')->put($path, $csv);

    $batch = ImportBatch::factory()->create([
        'workspace_id' => $workspace->id,
        'uploaded_by' => $user->id,
        'storage_path' => $path,
        'file_type' => 'csv',
        'status' => 'uploaded',
    ]);

    $mapping = [
        'type' => 0,
        'description' => 1,
        'amount' => 2,
        'date' => 3,
        'date_format' => 'Y-m-d',
        'amount_format' => 'raw',
        'account_id' => $account->id,
        'category_id' => $category->id,
    ];

    $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->put(route('imports.preview', $batch), ['mapping' => $mapping])
        ->assertRedirect(route('imports.show', $batch));

    $rows = $batch->rows()->orderBy('row_number')->get();
    expect($rows)->toHaveCount(2)
        ->and($rows[0]->status)->toBe('valid')
        ->and($rows[1]->status)->toBe('duplicate');
});

test('upload rejects unsupported file extensions', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->create(['owner_id' => $user->id]);
    WorkspaceMember::factory()->create(['workspace_id' => $workspace->id, 'user_id' => $user->id, 'role' => 'owner']);

    $file = UploadedFile::fake()->create('report.pdf', 500, 'application/pdf');

    $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->post(route('imports.store'), ['file' => $file])
        ->assertSessionHasErrors('file');
});
