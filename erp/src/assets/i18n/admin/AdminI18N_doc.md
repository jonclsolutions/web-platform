# Multilingual admin (Admin i18n)

This document describes the **static i18n system of the admin UI** - the
translation of the admin itself (buttons, labels, messages), **not** of the
public web content.

## 1. Two independent i18n systems - do not mix them

The project has **two completely separate** translation systems:

| | `LocalizationService` | `AdminLocalizationService` |
|---|---|---|
| What it translates | Content of the **public web** (page and e-shop texts) | The **admin** UI (buttons, labels, messages) |
| Source | Translation files of the API, editable through `EditWebsiteComponent` / `EditEshopComponent` | Static JSON files bundled with the frontend |
| Who edits the text | An administrator in the UI | A developer, directly in the JSON file |
| Typical number of languages | 1-2 (per web) | Can grow to 10+ |

**Never mix them.** A text of an admin button is always
`AdminLocalizationService`.

## 2. How it works

### Data source
Every language has its own JSON file:
```
src/assets/i18n/admin/cz/cz.json
src/assets/i18n/admin/en/en.json
```
with its flag next to it (`cz.png`, `en.png`).

### JSON structure
A flat map **section -> keys**:
```json
{
  "shared": { "confirm": "Confirm", "cancel": "Cancel" },
  "user-request": { "table_header": "Web form", "btn_edit": "Edit" }
}
```
- `shared` - texts common to the whole admin (Save / Cancel / Error ...).
  Merged automatically into EVERY section.
- Every other top-level key = one page / component (`user-request`,
  `edit-roles`, `web-settings` ...).
- `permission-descriptions` - descriptions of the permission keys shown in the
  role editor, keyed by `permission_key` (a key without a translation shows the
  English description stored in the database).

### A missing translation never pretends to be another language
When a key or a whole section is missing, `AdminLocalizationService` returns
the literal text `Cannot load text` - it **never** silently falls back to
another language. A missing translation must be visible and easy to find
(search the UI for `Cannot load text`).

### How the language is chosen and stored
- The choice is stored **only in the browser `localStorage`** - no database
  column, no API endpoint. It is a per-browser preference.
- The language dropdown is in the header of `AdminLayoutComponent`.

### Date and time
`AdminLocalizationService.getDateLocale()` maps the internal language code
(`cz`, `en`) to a BCP-47 locale (`cs-CZ`, `en-US`) for `DatePipe`. A new
language also needs its locale data registered in `app.config.ts`
(`registerLocaleData(...)`), otherwise `DatePipe` fails on the unknown locale.

The global `LOCALE_ID` provider of `AdminLayoutComponent` stays `cs-CZ` - it
affects other things (e.g. `CurrencyPipe`), not the admin dates.

## 3. Adding a text to an existing component

**Pattern A - the component extends `BaseDataComponent`:**

```typescript
export class MyComponent extends BaseDataComponent<...> {
  protected override translationSection: string = 'my-page';

  // REQUIRED override, see 5.1 - always add it:
  public override t(key: string): string {
    return this.i18n.getValue(`my-page.${key}`);
  }
}
```
In the template: `{{ strings.some_key }}` (through `getMergedSection`) or
`{{ t('some_key') }}`; in `.ts` `this.t('some_key')` for imperative texts
(alert dialogs etc.).

**Pattern B - the component does not extend `BaseDataComponent`** (shared
builders such as `TableBuilderComponent`, `FormBuilderComponent`,
`GraphBuilderComponent`, or standalone pages such as `PersonalInfoComponent`,
`WelcomePageComponent`):

```typescript
public readonly i18n = inject(AdminLocalizationService);
public get strings(): any { return this.i18n.getMergedSection('my-section'); }
public t(key: string): string { return this.i18n.getValue(`my-section.${key}`); }
```

A component with `ChangeDetectionStrategy.OnPush` also needs, in the
constructor:
```typescript
this.i18n.translations$.subscribe(() => this.cd.markForCheck());
```
otherwise it is not re-rendered after a language switch.

## 4. Texts with a variable (interpolation)

**No templating engine.** The JSON holds a template with `{placeholder}`,
replaced in code with `.replace()`:

```json
"save_success": "The section has been saved for {name}."
```
```typescript
this.t('save_success').replace('{name}', role.role_name)
```

Bold text inside a sentence (e.g. `<strong>without a password</strong>`) is
**split into prefix / bold / suffix keys**, never `[innerHTML]` - no XSS risk
just for a bold font:
```json
"info_banner_prefix": "The account is created ",
"info_banner_bold": "without a password",
"info_banner_suffix": ". The user receives an e-mail..."
```
```html
{{ strings.info_banner_prefix }}<strong>{{ strings.info_banner_bold }}</strong>{{ strings.info_banner_suffix }}
```

## 5. Common mistakes (and how to avoid them)

### 5.1 Missing `t()` override -> "Cannot load text" everywhere
The inherited `BaseDataComponent.t(path)` expects the **full path including
the section** (`'user-request.btn_edit'`), not a short key. Calling
`this.t('btn_edit')` without an own override makes `getValue()` look for
`btn_edit` at the **top level of the JSON**, where it does not exist ->
`Cannot load text`.

**Fix:** every component with its own `translationSection` has the override
of Pattern A.

### 5.2 Endless loop / NG0956 (table torn down)
When the table configuration (columns, buttons) comes from a **factory
function** called in a **getter** (`get buttons() { return createButtons(this.i18n); }`),
every read returns a new array of new objects. `@for` with `track button`
(identity) then sees "another collection" in every change-detection pass ->
Angular tears down and rebuilds the whole table -> which triggers another
pass -> endless loop.

**Fix, two parts:**
1. In templates, `@for` always tracks a **stable key**, never the identity:
   `track col.key`, `track button.action` - never `track col` / `track button`.
2. Do **not** compute factory configurations in a getter. Store them in a
   plain field filled in the constructor through a subscription:
   ```typescript
   buttons: Core.TableButtons[] = [];

   constructor(...) {
     super(...);
     this.i18n.translations$.subscribe(() => {
       this.buttons = createButtons(this.i18n);
       this.cd.markForCheck();
     });
   }
   ```
   `translations$` is a `BehaviorSubject` - the subscription gets the value at
   once and again on every load / language switch, so the texts appear as
   soon as the JSON arrives.

### 5.3 Shared components must not inject an i18n service
`MultiFileUploadComponent` is used both on the public web
(`LocalizationService`) and in the admin (`AdminLocalizationService`).
Injecting one of them would break it in the other context.

**Fix:** such a component stays purely presentational - it never looks up
texts itself, it gets them through `@Input() textOverrides` with neutral
English fallbacks. The consumer (admin or public) takes the texts from its own
i18n layer and passes them in as plain data.

### 5.4 Values stored in the database != displayed text
Fields such as `status` / `priority` have a value that is sent to the API and
stored in the database, and a label the user sees. **The value is never
translated** - it is a canonical English slug the backend validates and
filters by. Only the label is translated - see
`src/app/admin/components/builders/enum-and-i18n-in-builder-components.md`:

```typescript
options: mapLabeledOptions(SECTION, ['new', 'in_progress', 'done'], STATUS_LABEL_KEYS, i18n)
```

## 6. Adding a new language

1. Create `src/assets/i18n/admin/{code}/{code}.json` (copy the structure of
   `en.json`, translate the values) and `{code}.png` (flag).
2. Add an entry to `ADMIN_AVAILABLE_LANGUAGES` in `admin-localization.service.ts`.
3. Add the locale mapping to `DATE_LOCALE_MAP` in the same file
   (e.g. `de: 'de-DE'`).
4. Register the locale data for `DatePipe` in `app.config.ts`:
   ```typescript
   import localeDe from '@angular/common/locales/de';
   registerLocaleData(localeDe, 'de-DE');
   ```

No other code change is needed - every component reads the current language
dynamically.

## 7. Checklist for a new component

- [ ] Find every hard-coded text in `.html` and `.ts` (also error messages,
      `aria-label`, `title`, placeholders).
- [ ] Add the keys to **both** JSON files (`cz.json`, `en.json`) under the
      same section.
- [ ] Set `translationSection` (Pattern A) or inject the service (Pattern B).
- [ ] When it extends `BaseDataComponent`, add the `t()` override (5.1).
- [ ] With `OnPush` and without `BaseDataComponent`, add
      `translations$.subscribe(markForCheck)`.
- [ ] When the page has its own `*.config.ts` (table columns / buttons), use
      factory functions filled in the constructor (not a getter - see 5.2).
- [ ] Check `@for` / `*ngFor` in the template - `track` must use a stable key,
      never the object identity.
- [ ] `console.error` / `console.warn` (developer logs) are **not** translated -
      the end user never sees them.
- [ ] Technical constants (permission keys, CSS classes, API paths) are **not**
      translated.
- [ ] After the change, test in both languages and look for `Cannot load text`.
