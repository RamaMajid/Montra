# Phase 8 — Reports & CSV Export Contract

Status: backend contract implemented. Frontend report pages remain deferred.

## Routes

All routes require `auth`, `verified`, and `EnsureActiveWorkspace`. Workspace comes only from session `active_workspace_id`; query-string `workspace_id` is ignored.

| Method | Route | Name | Access |
|---|---|---|---|
| `GET` | `/reports/{type}` | `reports.show` | Any workspace member, including viewer |
| `GET` | `/reports/{type}/export` | `reports.export` | Any workspace member, including viewer |

Supported `{type}` values: `monthly-summary`, `income`, `expense`, `category`, `budget`, `savings`. Unsupported values return `404`. CSV export is synchronous and streamed; no report file is stored.

## Filters

Uses same validated filters as dashboard analytics:

- `period`: `current_month` (default), `previous_month`, or `custom`.
- `date_from`, `date_to`: required for `custom`, inclusive `Y-m-d` dates, with `date_to >= date_from`.

Invalid filters return Laravel `422` JSON for JSON requests. Periods use `transaction_date` and application timezone. Savings progress is a current snapshot and does not restrict contributions by report period.

## JSON response

```json
{
  "report": "expense",
  "period": {"type": "current_month", "start_date": "2026-11-01", "end_date": "2026-11-30"},
  "columns": ["type", "category_id", "category_name", "amount", "transaction_count", "percentage"],
  "rows": [],
  "totals": {"total_expense": "0"}
}
```

All monetary values are decimal integer strings in IDR. Percentages are decimal strings or `null` where undefined. Empty reports return `rows: []` and zero totals.

- `monthly-summary`: summary metrics and comparison values from `FinancialAnalyticsService`.
- `income`, `expense`: valid non-deleted transactions grouped by workspace-local category. Transfers excluded.
- `category`: income and expense category rows plus `net_cash_flow`; transfers excluded.
- `budget`: active overlapping budgets and allocation rows from `BudgetProgressService`; actuals are expense-only for each full budget period.
- `savings`: non-archived goals and progress from `SavingsGoalService`; contributions are not transactions or expenses.

## CSV response

`GET /reports/{type}/export` returns `text/csv; charset=UTF-8`, with a safe filename such as `montra-expense-2026-11-01-2026-11-30.csv`. Header is always emitted, including empty reports. Numeric money strings are preserved exactly. Text cells beginning with spreadsheet formula characters are prefixed with `'` to prevent formula injection. No temporary file or public storage path is created.

Authorization and workspace isolation apply before report calculation and export generation. Foreign workspace data is never included.
