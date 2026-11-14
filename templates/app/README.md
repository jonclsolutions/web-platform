# Template of a new application

`new-app.sh` creates a new **application** (module) of web-platform – a part with its own admin
pages (and optionally public pages) that plugs into the core the same way as `web`, `shop` and
`project-portal`, and that can be removed again without touching the core.

```bash
templates/app/new-app.sh my-crm "Moje CRM"
cd api && php artisan migrate && php artisan db:seed --class=BaseDataSeeder
```

The new application has one admin page – its **audit log** – and everything around it: tab
permission, sidebar, admin texts (cz / en), manual page, tests and unit test runners. Build the
real pages on top of it.

## What is created

| Part | Files | Registered in |
|---|---|---|
| API manifest | `api/app/Apps/<App>/<App>App.php` | `api/config/apps.php` |
| API routes | `api/app/Apps/<App>/routes.php` (below `/api/<id>/…`) | loaded through the manifest |
| Audit log | `Models/<App>Log.php` (extends `AuditLog`), `Http/Controllers/<App>LogController.php`, migration `Database/Migrations/…_create_<app>_logs.php` (`AuditLogSchema`) | manifest `logModel()` |
| Permissions | `Database/Seeders/<App>BaseDataSeeder.php` + `data/permissions.php` (`view-<id>`, `<id>-view-logs`, module `<id>`) | manifest `baseDataSeeders()` |
| Manual (KB) | `Resources/knowledge-base/{structure,cz,en}.json` | merged by `KnowledgeBase` |
| API tests | `api/tests/Apps/<App>/` (`Support/<App>Schema.php`, `Feature/<App>LogTest.php`) | `api/phpunit.xml` suite `<App>` |
| Frontend manifest | `erp/src/app/apps/<id>/<id>.app.ts` | `apps.registry.ts`, `AppId` in `app-manifest.ts` |
| Admin pages | `admin/<id>-admin.routes.ts`, `admin/<id>-logs.config.ts` (the core `AuditLogPageComponent`) | manifest `adminRoutes`, `nav` |
| Admin texts | `admin/i18n/{cz,en}.json` (name, description, sidebar, role editor, calendar, manual group, permission descriptions, log labels) | manifest `adminI18n` |
| Test runners | `tests/unit_tests/api/run_<app>.sh`, `tests/unit_tests/erp/run_<app>_admin.sh` | – |

## Rules of an application

- **Dependencies go one way – the application uses the core, never the other way round.** The core
  learns about applications only from the registries (`api/config/apps.php`,
  `erp/src/app/apps/apps.registry.ts`) and the manifests. Checked by
  `api/tests/Unit/Core/ApplicationBoundariesTest.php` and the erp unit test runner
  (“Application boundaries”).
- **An application never imports another one.** When it offers something of another application
  (a link, a button), it asks the registry first: `hasApp('shop')` (frontend),
  `AppRegistry::app('shop')` (API).
- **Shared things come from the core:** audit log (`AuditLog`, `AuditLogPageComponent`), dashboard
  (`BaseDashboardComponent` + `<app-dashboard-view>`), translation editor
  (`BaseTranslationEditorComponent` + `<app-translation-editor-view>`), page titles, legal pages,
  404 (`publicNotFoundRoute()`), attachments, calendar (`agendaSources()`), retention
  (`retentionSources()`). Do not copy them into the application.
- **Names:** permissions `<id>-…` with module `<id>`, tables `<app_snake>_…`, admin URL
  `/admin/<id>/…`, API `/api/<id>/…`, translation sections prefixed `<id>-`.
- **Public part** (optional): a layout route with `data: { publicArea: … }` (`public/public-area.ts`),
  the same `publicArea` in the manifest, `publicRoutes` (+ `publicFallbackRoutes` for a catch-all),
  runtime translations of the module `<id>` (`translations/<id>/<lang>`).
- Every admin page has a sidebar item, `data.permission` and `data.help` (a manual page with the
  same permission) – `admin-navigation.config.spec.ts` and `KnowledgeBaseTest` check it.

## Checking and removing

```bash
tests/unit_tests/api/run_<app>.sh            # API tests of the application
tests/unit_tests/erp/run_<app>_admin.sh      # its admin specs
tests/module_removal/check.sh <id>           # the rest works without it
```

Removing an application = delete `api/app/Apps/<App>`, `api/tests/Apps/<App>`,
`erp/src/app/apps/<id>`, its lines in `api/config/apps.php`, `api/phpunit.xml`,
`apps.registry.ts` (and `AppId`), its runners – exactly what `tests/module_removal/check.sh`
simulates. Its tables stay in the database until dropped by hand (its migrations are gone with it).
