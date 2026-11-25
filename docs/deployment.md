# Montra Deployment & Operations

This is an operator checklist, not a claim that a specific hosting environment has been validated. No production deployment is performed by this repository.

## Runtime requirements

- PHP `^8.3` (local development currently uses PHP 8.4) with extensions required by Laravel and Composer packages: PDO, PostgreSQL (`pdo_pgsql`), mbstring, OpenSSL, tokenizer, XML, ctype, JSON, fileinfo, and ZIP/XMLReader for XLSX imports.
- Composer 2.
- Node.js LTS and npm for Vite production assets.
- PostgreSQL supported by the installed Laravel 13 version.
- Long-running queue worker and a scheduler trigger.
- Private persistent storage or private S3-compatible object storage for imports.

Run `composer check-platform-reqs` on the target host before release.

## Required environment

Start from `.env.example`; never commit production `.env` or credentials.

```env
APP_NAME=Montra
APP_ENV=production
APP_KEY=base64:generated-secret
APP_DEBUG=false
APP_URL=https://finance.example.com
APP_TIMEZONE=Asia/Jakarta

DB_CONNECTION=pgsql
DB_HOST=
DB_PORT=5432
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=

SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
CACHE_STORE=database
QUEUE_CONNECTION=database

FILESYSTEM_DISK=local
IMPORT_DISK=local
IMPORT_RETENTION_DAYS=7

LOG_CHANNEL=stack
LOG_STACK=daily
LOG_LEVEL=warning
```

Generate `APP_KEY` once with `php artisan key:generate --show`; store it in the host secret manager. Never rotate it casually because encrypted data and sessions depend on it. Configure production mail instead of `MAIL_MAILER=log` for verification and password reset. If TLS terminates at a trusted proxy, configure trusted proxies at infrastructure/application level and verify Laravel detects HTTPS before enabling traffic.

`local` stores private files under `storage/app/private`; it is not the `public` disk. Ensure persistent private storage and deny direct web-server access. For multiple app instances, configure `IMPORT_DISK=s3` and S3-compatible credentials, or another shared private disk already supported by Laravel. Do not run `storage:link` for import files.

## Release procedure

1. Put application into maintenance mode when migration risk or deployment topology requires it: `php artisan down --retry=60`.
2. Install locked production dependencies: `composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction`.
3. Install/build assets from lockfile: `npm ci && npm run build`.
4. Run `php artisan migrate --force` against the verified production database. Never use `migrate:fresh` or destructive rollback.
5. Cache production metadata: `php artisan optimize`.
6. Restart workers after code changes: `php artisan queue:restart` (the process supervisor must restart exited workers).
7. Return service: `php artisan up`.
8. Run deployment verification below.

Use an atomic release/symlink strategy when host supports it. Keep previous code artifact available for rollback. Database rollback requires a reviewed forward-fix or migration-specific plan; reverting code without reverting an incompatible schema is unsafe.

## Queue worker

Imports use database queues. Run a supervised process equivalent to:

```bash
php artisan queue:work database --sleep=3 --tries=3 --timeout=60 --max-time=3600
```

Supervisor/systemd/hosting process manager must restart workers. Monitor failed jobs (`php artisan queue:failed`), logs, queue depth, and import batch state. Review before `queue:retry`; import jobs are designed for retry safety, but repeated operational failures need diagnosis.

## Scheduler

Configure one cron entry (or hosting scheduler) every minute:

```cron
* * * * * cd /path/to/Montra-react-starter && php artisan schedule:run >> /dev/null 2>&1
```

The scheduler removes expired import source files and generates financial insights daily. Confirm with `php artisan schedule:list`. Only one scheduler should dispatch each due task per deployment topology.

## PostgreSQL and backups

Use least-privilege application credentials and require encrypted database connections where provider supports them. Restrict network access. Keep automated backups and point-in-time recovery if available.

Minimum recovery practice:

1. Schedule encrypted PostgreSQL backups outside web-accessible storage.
2. Define retention and off-site policy appropriate to financial data.
3. Record provider-specific restore steps and responsible operator.
4. Test restore regularly into an isolated non-production database.
5. Verify row counts, migrations, workspace isolation, and representative financial totals after restore.

Do not treat an untested backup as recoverable. Never restore production data into developer laptops or demo environments without explicit approval and sanitization.

## Security and operations

- HTTPS required; redirect HTTP at load balancer/web server. Set `SESSION_SECURE_COOKIE=true`; keep HttpOnly enabled and `SameSite=lax` unless a reviewed integration requires another value.
- Keep `APP_DEBUG=false`. Restrict log access and avoid logging request bodies, credentials, import rows, or financial report contents.
- Apply web-server request size limits compatible with application import validation. Current upload validation limit is the source of truth; keep proxy/PHP limits at least that large, not unbounded.
- Configure rate limiting at application/reverse-proxy edge. Report CSV exports have application throttle `20/minute` per default throttle identity.
- Protect `.env`, `storage`, database dumps, and private import objects from public access.
- Monitor HTTP errors, queue failures, scheduler health, database capacity/locks, disk usage, and backup success.
- Demo workspace is not provisioned by this phase decision; do not use production/user data as demo data.

## Deployment verification

Before production traffic:

```bash
php artisan about --only=environment
php artisan migrate:status
php artisan route:list --path=reports
php artisan schedule:list
php artisan queue:monitor database:default --max=100
```

Verify HTTPS, secure cookie behavior, login/email flow, active workspace isolation, dashboard totals, one read-only report JSON request, one CSV download, private import upload path, queue processing, scheduler execution, error logging, and backup job visibility. Use synthetic verification records only and remove them through normal application behavior.

## Rollback

- Code/assets: switch to previous compatible release and run `php artisan optimize:clear`, then restart workers.
- Database: prefer forward migration fixes. Execute `migrate:rollback` only after reviewing exact migration and data-loss impact, with a current verified backup.
- Failed release: keep maintenance mode until schema/code compatibility and worker versions are restored.
