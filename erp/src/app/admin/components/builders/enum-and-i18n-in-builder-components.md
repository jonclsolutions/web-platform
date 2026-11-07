# Enum values and booleans in the generic builder components

This document follows `src/assets/i18n/admin/AdminI18N_doc.md` and describes
how **values stored in the database** (status / priority / thema / boolean
columns) become translated text in `TableBuilderComponent`,
`FormBuilderComponent` and `FilterFormBuilderComponent` - shared builders that
**do not inject** `AdminLocalizationService` themselves (see 5.3 of the
previous document) and still have to show translated text.

## 1. Principle - a builder never knows the text, it only passes it on

None of the three builders decides **how** a value is translated. It only
looks up an existing `{value, label}` pair the **page** (through its
`*.config.ts`) passed in `InputDefinition.options` / `FilterColumns.options`.
A builder is therefore independent of the language and of how many languages
the admin supports - that is the job of the page, which injects
`AdminLocalizationService`.

```
*.config.ts (knows i18n)
   │  creates {value: 'in_progress', label: 'In progress'}
   ▼
InputDefinition.options / FilterColumns.options
   │  (plain data, no i18n reference inside)
   ▼
FormBuilderComponent / FilterFormBuilderComponent / TableBuilderComponent
   │  only look up: options.find(o => o.value === rawValue)?.label
   ▼
Displayed text
```

## 2. Canonical value vs. label - one source of truth

Columns such as `status` / `priority` / `thema` have two different roles:

- **`value`** - the string sent to the API and stored in the database. **Never
  translated.** Backend validation (`in:new,in_progress,done,cancelled`) and
  database filtering (`WHERE status = ?`) work only with this value.
- **`label`** - the text the user sees. Translated, language dependent.

The recipe (reference implementation `user-request.config.ts`):

```typescript
import { mapLabeledOptions } from '../../components/builders/labeled-options';

const SECTION = 'user-request';

// 1) Canonical VALUES - English slugs, never translated
export const USER_REQUEST_STATUS_VALUES: string[] = ['new', 'in_progress', 'done', 'cancelled'];

// 2) slug -> i18n key (NOT slug -> text)
const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'status_new',
  in_progress: 'status_in_progress',
  done: 'status_done',
  cancelled: 'status_cancelled',
};

// 3) The shared helper returns the {value, label} pairs
options: mapLabeledOptions(SECTION, USER_REQUEST_STATUS_VALUES, STATUS_LABEL_KEYS, i18n)
```

This trio (`_VALUES` + `_LABEL_KEYS` + `mapLabeledOptions()` of
`labeled-options.ts`) is the only place the form, the filter and (indirectly)
the table read from - no duplicate definition of the values anywhere else in
the component.

## 3. How `FormBuilderComponent` reads it

A `select` form field gets its `options` directly in the `InputDefinition`:

```typescript
{
  column_name: 'status',
  type: 'select',
  options: mapLabeledOptions(SECTION, USER_REQUEST_STATUS_VALUES, STATUS_LABEL_KEYS, i18n),
  ...
}
```

`FormBuilderComponent` only renders the pairs as
`<option [value]="opt.value">{{ opt.label }}</option>` - no i18n logic inside.
When a form opens for editing, `normalizeSelectValues()` compares the stored
database value with the `options` values, not with the labels - so `value`
in `options` must match the database **exactly** (slug, not text).

## 4. How `FilterFormBuilderComponent` reads it

The filter template (`filter-form-builder.component.html`) supports both a
`{value, label}` pair and a plain string:

```html
@for (option of $any(column.options); track option) {
  <option [value]="option?.value !== undefined ? option.value : option">
    {{ option?.label !== undefined ? option.label : option }}
  </option>
}
```

With `option.value` the pair is used (translated text, English slug as the
value); without it a plain string is both the value and the text. A filter
gets translated options without any builder change - the `*.config.ts` just
passes `mapLabeledOptions(...)` instead of the plain value list.

## 5. How `TableBuilderComponent` reads it

`getCellValue()` in its `default` branch (anything that is not `currency` /
`date` / `boolean` / `image`) looks up the same pair - not in its own
configuration, but in the `InputDefinitions` the page passes anyway for the
form (`[inputDefinitions]="formFields"`):

```typescript
default:
  const fieldDef = this.inputDefinitions.find(i => i.column_name === column.key);
  if (fieldDef?.options) {
    const option = fieldDef.options.find(opt => String(opt.value) === String(value));
    return option ? option.label : value;
  }
  return value;
```

**Consequence:** when a field of the form definition has no `options`
(typically `type: 'text'` without a fixed list), the table shows the raw
database value (slug) - no error, but no translation either. For a text field
whose values come from a fixed list (e.g. `thema` of `user-request`, a free
text input of the public form), add `options: mapLabeledOptions(...)` to the
`text` field too: the form ignores `options` of a `text` field, the table
reads them.

`String(opt.value) === String(value)` compares as strings, so numeric and text
slugs work the same.

**Free texts do not break:** a value outside the fixed list makes
`options.find()` return `undefined` and the method returns the raw value -
shown unchanged, not as an empty cell or an error.

## 6. Recipe for converting another column / table

The procedure is the same across the project (Core / Web / Shop), only the
table and the `*.config.ts` change:

1. **Find every DISTINCT value** in the production data
   (`SELECT DISTINCT status FROM ...`), not only in sample data.
2. **Migration** - `UPDATE ... SET status = 'slug' WHERE status = 'old text'`
   for every value + the new default.
3. **Backend validation** (`Store*Request` / `Update*Request`) - change
   `in:Old text,Other text` to `in:slug_one,slug_two`.
4. **`*.config.ts`** - slugs in the `..._VALUES` array, `..._LABEL_KEYS` keyed
   by the new slugs (the i18n keys and JSON texts usually stay the same).
5. **Form and filter fields** - both through `mapLabeledOptions()`.
6. Check that **no** field sharing the same value list (typically a free `text`
   field, see `thema` above) is left without `options` - otherwise the table
   shows the slug instead of the label although the filter and the form work.

Steps 2-3 must be released **together** with step 4, never separately (old
data would fail the new validation, or a select would not find a matching
option for an old value).

## 7. Booleans - `shared.yes` / `shared.no`

Boolean columns (`type: 'boolean'`) are not an `options` pair but a fixed pair
of keys of the `shared` JSON section, common to the whole admin:

```typescript
// TableBuilderComponent.getCellValue() / DetailsBuilderComponent
case 'boolean':
  return (value == true || value === 'true' || value == 1)
    ? this.i18n.getValue('shared.yes')
    : this.i18n.getValue('shared.no');
```

The table and the details use the **same** keys - they show the same database
value (`is_active`, `is_featured` ...) in a different context and must agree
on "Yes" across the admin. No `*.config.ts` change is needed.

## 8. What a builder NEVER does

- **It does not detect the current language.** It always gets a ready,
  translated `label` from outside - `AdminLocalizationService` is injected
  only in the page / `*.config.ts`, not in the builder.
- **It does not decide the canonical value.** `value` in `options` must match
  the database exactly - the builder only compares, never normalizes or
  guesses.
- **It does not handle missing `options`.** Without options the builder
  returns the raw value - that is missing page configuration, not a builder
  error (see sections 5-6).
