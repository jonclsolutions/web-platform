# Knowledge Base (internal manual of the administration)

The content of the manual shown at `/admin/intranet/knowledge-base`. These files live outside
the public folder; only signed-in users can read them, through
`GET /api/knowledge-base` and `GET /api/knowledge-base/pages/{id}`. Each user gets only the
pages and sections their permissions allow (`App\Support\KnowledgeBase\KnowledgeBase`).

## Files

- `structure.json` holds the language-neutral part. It is the only place where access is set.
  - `id`: route slug (`/admin/intranet/knowledge-base/{id}`), kebab-case. Never change it once
    published.
  - `group`: menu group, one of `general`, `roles`, `web`, `core`, `shop`. The heading comes from
    the admin i18n key `knowledge-base.nav_group_{group}`.
  - `order`: order in the menu. Groups are ordered by their lowest `order`.
  - `permission`: who sees the page. Normally this is the permission of the admin page it
    describes (the same value as `data.permission` in `admin-routing.module.ts`).
  - `sections`: optional map of a section `key` to a permission. Use it for sections about
    actions that need more than viewing, e.g. creating, editing or deleting.
  - `devNote`: a note for developers. It is never sent to the browser.
- `cz.json`, `en.json` and any other language file hold the texts of every page: `navLabel`,
  `header` and `sections`. A section has an optional `key`, an optional `heading` and its
  `blocks`.

## Permission values

- `null`: every signed-in user.
- `"core-administrators-view"`: users with that permission.
- `"a|b"`: users with any of the listed permissions.
- `"sysadmin"`: only the sysadmin role.

The sysadmin always sees everything. A page or section the user may not see is left out; a
hidden page answers 404, like a missing one.

## Adding a page

1. Add the page to `structure.json` (`id`, `group`, `order`, `permission`).
2. Add the page with the same `id` to every language file.
3. To restrict a section, give it a `key` in every language file and map that key in
   `structure.json` → `sections`.
4. Use only these block types:
   - `text`, `lead`: `content`.
   - `alert`: `variant` (info, warning, success or danger) and `content`.
   - `note`: `highlight` and `content`.
   - `image`: `path` under `erp/src/assets/kb/`, `alt` and `caption`.
   - `link`: `label`, `url` and `external`.
   - `list`: `ordered` and `items`.
   - `grid`: `cards` with `title` and `text`.
   - `flow`: `steps` with `label`, `text` and `active`.
5. Run the API tests. `KnowledgeBaseTest` checks that the files fit together: every page exists
   in every language, the permission keys are known, and the block types are valid.

## Help button of the admin pages

Every admin page has its own page in the manual. The route in `admin-routing.module.ts` names it
in `data.help`, e.g. `{ path: 'administrators', ..., data: { help: 'administrators', permission:
'core-administrators-view' } }`. The help button ("?") at the top right of the page then opens
`/admin/intranet/knowledge-base/administrators`. The button is `<app-page-help>`
(`erp/src/app/admin/components/page-help`) - place it at the right end of the header of a new
page. "Help" in the admin header always opens the manual home.

A new admin page therefore needs a page in the manual too (steps above, the same `permission` as
the route). Until its guide is written, the page holds a short placeholder text.
`KnowledgeBaseTest` fails when an admin page has no `help`, the manual page does not exist, or
it has other readers than the route.

A page missing in the requested language falls back to English, then Czech.
