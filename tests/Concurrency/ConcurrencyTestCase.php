<?php

namespace Tests\Concurrency;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

/**
 * Explicit opt-in for destructive concurrency fixtures against the isolated PostgreSQL test database.
 *
 * phpunit.xml defaults to in-memory SQLite, so this class cannot use RefreshDatabase in that mode.
 * These tests run only against a verified APP_ENV=testing, DB_CONNECTION=pgsql,
 * DB_DATABASE=montra_testing database and clean up only records they create.
 */
abstract class ConcurrencyTestCase extends TestCase
{
    protected static bool $migrated = false;

    protected function setUp(): void
    {
        parent::setUp();

        if (! $this->isolatedTestingDatabase()) {
            $this->markTestSkipped('Concurrency tests require APP_ENV=testing, pgsql, and DB_DATABASE=montra_testing.');
        }

        $currentDb = (string) (DB::selectOne('SELECT current_database() AS db')?->db ?? '');
        if ($currentDb !== 'montra_testing') {
            throw new RuntimeException("Refusing concurrency test on database [{$currentDb}]; expected [montra_testing].");
        }

        if (! static::$migrated || ! Schema::hasTable('financial_insights')) {
            $this->artisan('migrate', ['--force' => true]);
            $this->app[Kernel::class]->setArtisan(null);
            static::$migrated = true;
        }
    }

    protected function isolatedTestingDatabase(): bool
    {
        return app()->environment('testing')
            && config('database.default') === 'pgsql'
            && config('database.connections.pgsql.database') === 'montra_testing';
    }
}
