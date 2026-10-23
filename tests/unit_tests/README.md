# Unit tests

Run scripts for the automated unit tests of the Angular app (`erp/`) and the Laravel API (`api/`).
The tests themselves live next to the code (`*.spec.ts` in `erp/src/...`, `*Test.php` in
`api/tests/...`). This folder only runs them and writes a report.

```
tests/unit_tests/
├── run_all.sh           EVERYTHING: erp/run_all_erp.sh + api/run_all_api.sh, one combined report
├── report/              combined report of run_all.sh (git-ignored)
├── lib/
│   ├── report.js        shared report writer (report.html + report.xml)
│   └── run_all.js       combined runner used by run_all.sh
├── erp/
│   ├── run_all_erp.sh   every *.spec.ts in erp/src
│   ├── run_admin_core.sh  admin/core-pages + admin/components + admin/auth + admin/intranet
│   ├── run_admin_web.sh   admin/web-pages
│   ├── run_admin_shop.sh  admin/shop-pages
│   ├── run_public_web.sh  public/web-pages
│   ├── run_public_shop.sh public/shop-pages
│   ├── lib/             runner (run.js) and Karma configuration
│   └── report/          result of the last run (git-ignored)
└── api/
    ├── run_all_api.sh   every PHPUnit suite
    ├── run_core.sh      suite Core  (api/tests/{Unit,Feature}/Core)  – core administration + authentication
    ├── run_web.sh       suite Web   (api/tests/{Unit,Feature}/Web)
    ├── run_shop.sh      suite Shop  (api/tests/{Unit,Feature}/Shop)
    ├── run_other.sh     suite Other (api/tests/{Unit,Feature}/Other) – everything else (legal, translations, import, …)
    ├── lib/             runner (run.js) and the section → source files mapping (sections.js)
    └── report/          result of the last run (git-ignored)
```

`core/` and `shared/` specs only run with `erp/run_all_erp.sh` (and `run_all.sh`).

## Running

From any directory, for example:

```bash
tests/unit_tests/run_all.sh                           # all erp + all api tests, combined report
tests/unit_tests/run_all.sh --no-coverage             # the same without code coverage (faster)
tests/unit_tests/erp/run_admin_core.sh                # one erp section
tests/unit_tests/erp/run_admin_web.sh --no-coverage
tests/unit_tests/api/run_all_api.sh                   # all api tests only
tests/unit_tests/api/run_core.sh --no-coverage        # one api section without coverage
```

Requirements: Node.js, `npm install` in `erp/`, Chrome or Chromium (found via `CHROME_BIN` or on
PATH), PHP 8.2+ with `pdo_sqlite` and `composer install` in `api/`. For the api code coverage a
PHP coverage driver: **pcov** (recommended – Fedora `sudo dnf install php-pecl-pcov`,
Debian/Ubuntu `sudo apt install php-pcov`) or Xdebug. Without a driver the api tests still run and
the report says "coverage not available".

Exit code: `0` all passed, `1` at least one test failed, `2` setup problem (missing
`node_modules` / `vendor`).

## Report

Every run overwrites the report folder of the script that was started (last run only):

| Script | Report folder |
|---|---|
| `run_all.sh` | `tests/unit_tests/report/` – erp + api together |
| `erp/run_*.sh` | `tests/unit_tests/erp/report/` |
| `api/run_*.sh` | `tests/unit_tests/api/report/` |

`run_all.sh` runs `erp/run_all_erp.sh` first, then `api/run_all_api.sh`, and merges both into one
report: test names start with their part (`erp › …`, `api › …`), the summary shows the totals and
one line per part, the coverage of both parts (summary + one table per part) and
`coverage/erp/index.html` + `coverage/api/index.html` line by line. It does not change
`erp/report/` or `api/report/`. A part that cannot start (missing `node_modules` / `vendor`) is
a failed `setup` entry in the combined report and the exit code is `2`. A missing Chrome/Chromium
is reported as the failed entry `Karma › test run` with the message how to fix it.

Each report folder contains:

- **report.html**: a summary (what ran, when, how long, total / passed / failed / skipped, number
  of failures per type) and a numbered table: test name and PASS / FAIL / SKIP.
- **report.xml**: JUnit-compatible. Every failed test has its type, the message, the expected and
  the actual value (when the tool reports them) and the file and line.
- **coverage/index.html**: line-by-line code coverage of the tested folders (erp) / section (api).

### Code coverage (erp)

The erp runners measure code coverage by default (`--no-coverage` switches it off). The summary
in report.html shows **statements, branches, functions and lines** for the source files of the
tested folders, followed by a table per file with the uncovered line numbers; report.xml has the
same values as `coverage.*` properties.

- Every `*.ts` file of the tested folders counts, except specs, `*.d.ts` and files without runtime
  code (only interfaces / types, `index.ts` that only re-exports).
- A source file that no spec imports is listed as **not loaded by any test – 0 %**, so untested
  files are visible.
- Files outside the tested folders (e.g. `admin/components` when running `run_admin_web.sh`) are
  executed but not counted.

### Code coverage (api)

The api runners measure code coverage with pcov or Xdebug by default (`--no-coverage` switches it
off). PHP coverage is line based: the report shows **lines** (executable lines) and **methods**
(a method counts when all its lines ran) per file, with the uncovered line numbers.

- Each section measures its own files – `api/lib/sections.js` lists them: **Core** (core
  administration + authentication: login, 2FA, password reset, activation, users, roles,
  permissions, security monitoring, e-mail access policy, external links, audit log), **Web** (public
  forms, site settings, news, raw requests, support tickets, sales leads / orders, job
  applications, customer projects + project portal, imports, web log), **Shop** (storefront,
  checkout, payment simulation, catalogue, orders, customers, coupons, shipping / payment
  methods, supplier import, shop log, maintenance), and **Other** = every file of `api/app`
  that is in none of the three.
  `run_all_api.sh` measures all of `api/app`.
- The runner writes a temporary copy of `api/phpunit.xml` whose `<source>` contains only the
  section's files, so `coverage/index.html` shows exactly the measured files.
- A file whose code no test executed is listed as **not loaded by any test – 0 %**; files without
  executable code (interfaces, empty base classes) are left out.

### Test database (api)

The api tests run on **SQLite in memory** – a fresh database for every test, nothing touches the
MariaDB dev database (`api/tests/TestCase.php` refuses to run on anything else, `phpunit.xml`
forces `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`). The schema comes from
`api/tests/Support/TestSchema.php`, not from the migrations: `api/database/migrations` is out of
date (duplicate `create_roles_table` / `create_user_logins_table`, most `core_*`, `web_*`,
`shop_*`, `legal_*` tables missing), the real schema is maintained in SQL. When a tested table
changes in production, change `TestSchema.php` the same way. Helpers for tests:
`api/tests/Support/InteractsWithAccounts.php` (permissions, roles, accounts, `signIn()`,
`assertSecurityEvent()`, `assertCoreLog()`) and `TestCase::failOn($table, 'INSERT|UPDATE|DELETE')`
to force a database error.

### Current state

Target **100 %**:

| Script | Coverage |
|---|---|
| `erp/run_admin_web.sh` | 100 % (statements, branches, functions, lines) |
| `erp/run_admin_shop.sh` | 100 % |
| `erp/run_admin_core.sh` | 99 % lines / 98 % statements – 430 tests (the rest: downloads via `window.location`, ResizeObserver callbacks) |
| `erp/run_public_web.sh` + `run_public_shop.sh` | 99.6 % lines |
| `erp/run_all_erp.sh` | 99.5 % lines / 99 % statements – 1093 tests (core 100 %, shared ≥ 99.6 % per file) |
| `api/run_core.sh` | 100 % (lines, methods) – 186 tests |
| `api/run_web.sh` | 100 % (lines, methods) – 107 tests |
| `api/run_shop.sh` | 100 % (lines, methods) – 64 tests |
| `api/run_other.sh` | 100 % (lines, methods) – 28 tests |
| `api/run_all_api.sh` | 100 % (lines, methods) of all `api/app` – 385 tests |

Code that can never run (e.g. a branch for a button the page does not have) is removed instead of
being excluded from the coverage.

Failure types:

| Type | Meaning |
|---|---|
| syntax error | the code cannot be parsed (TypeScript TS1xxx, PHP ParseError) |
| parameter mismatch | wrong argument type or count; *expected* is the parameter type or count, *actual* is what was passed |
| type mismatch | a value of the wrong type is assigned |
| missing member or import | a property, method or import that does not exist (e.g. a spec testing removed code) |
| compile error / build error | other compiler or build problems |
| assertion failed | an `expect(...)` / `assert...` did not hold; *expected* vs. *actual* |
| runtime error | an exception thrown while the test ran (TypeError, …), also tests that never ran because the browser crashed |
| angular error | an Angular runtime error (NG0xxx) |
| timeout | an async test did not finish in time |

A spec file that does not compile is not sent to Karma. Each of its compiler errors is listed in
the report as a failure, and all the other specs still run.

## Writing tests

Every test has a header comment with **@description**, **@input** and **@output** (the expected
result). The file header follows the project JSDoc / PHPDoc template. Examples:

```ts
/**
 * @description Applying filters resets the page to 1 and reloads the table.
 * @input  applyFilters({ name: 'abc' }) while currentPage = 3
 * @output filters contain name 'abc', currentPage = 1, refreshData() called once
 */
it('applyFilters() merges the filters, resets the page and reloads', () => { … });
```

```php
/**
 * @description A blocked account is refused before the password is checked.
 * @input Blocked account, POST /api/login with the correct password.
 * @output 403; login_blocked_account event, login_blocked core log; no tokens.
 */
public function test_blocked_account_cannot_log_in(): void { … }
```

api tests: `api/tests/Feature/<Section>/…` for HTTP endpoints (requests through the whole stack),
`api/tests/Unit/<Section>/…` for models, middleware, services, mails and commands.
