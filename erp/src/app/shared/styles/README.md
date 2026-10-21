<!--
  @file README.md
  @path erp/src/app/shared/styles/README.md
  @project RPSW Web
  @author RPSW
  @created 2026
  @description How the CSS of the Angular app is organised: where styles live, how a component
  gets them, the tokens, the rules for where a new style goes, and what to avoid.
-->

# CSS guide

This is the map of the app's styles. Read it before adding or moving CSS.
The global entry point is [`src/styles.css`](../../../styles.css); everything else is component CSS
plus the shared files described here.

---

## 1. The idea in one paragraph

Every component keeps its own `*.component.css`. What several components use **identically** lives
in a `shared-styles/` folder at the lowest level that all of them have in common, and the component
pulls it in through `styleUrls`. Colours come from **tokens**: raw palette values in one global file,
and the meaning of a colour (accent, text, border …) in one `theme.css` per look. Modules never depend
on each other sideways – web never includes shop files, admin and public meet only in `app/shared/styles/`.

---

## 2. Where styles live

```
src/
├── styles.css                              global: html/body, scrollbar, imports tokens.css
└── app/
    ├── shared/styles/                      ADMIN + PUBLIC
    │   ├── tokens.css                      global colour primitives (:root, --color-*)
    │   ├── base.css                        box-model reset for a component (*, ::before, ::after)
    │   └── README.md                       this file
    │
    ├── admin/
    │   ├── shared-styles/                  whole admin (core + shop + web, auth, layout, intranet)
    │   │   ├── theme.css                   admin look tokens (--accent, --text, --border …)
    │   │   ├── page.css                    standard list page: toolbar, buttons, table header, banners
    │   │   ├── dashboard.css               dashboard header bar          (core, shop, web dashboards)
    │   │   ├── dashboard-cards.css         cards, KPI rows, charts       (core + web dashboards)
    │   │   ├── dashboard-maintenance.css   maintenance switch            (shop + web dashboards)
    │   │   ├── settings-page.css           site-settings editor          (edit-eshop + edit-website)
    │   │   ├── welcome-page.css            greeting block                (core, shop, web welcome pages)
    │   │   └── welcome-links.css           link-card grid                (shop + web welcome pages)
    │   ├── core-pages/shared-styles/page.css   list-page rules only core uses
    │   ├── shop-pages/shared-styles/
    │   │   ├── page.css                    list-page rules only shop uses
    │   │   └── list-page.css               orders + products toolbar / filter panel
    │   ├── web-pages/shared-styles/page.css    list-page rules only web uses
    │   ├── auth/shared-styles/
    │   │   ├── auth.css                    form controls of login, activation, reset
    │   │   └── auth-card.css               centred card of activation + reset
    │   └── components/builders/table-style.css  (table builders – unchanged)
    │
    └── public/
        ├── shared-styles/maintenance.css   maintenance page (web + e-shop)
        ├── web-pages/shared-styles/
        │   ├── theme.css                   public web look tokens (dark, violet)
        │   ├── content-page.css            .content-page / .content-page-hero frame
        │   ├── cta.css                     call-to-action row
        │   ├── faq-list.css                FAQ accordion (FAQ + services)
        │   ├── form-fields.css             form field states (contact + job application)
        │   ├── animations.css              fadeUp keyframes
        │   └── legal-document.css          GDPR / TOS / cookies pages
        └── shop-pages/shared-styles/
            ├── theme.css                   e-shop look tokens
            └── quantity.css                quantity selector + buy buttons (cart + product detail)
```

The header of every shared file says what it contains and who uses it (`@description`,
`@dependencies`, `@module`, `@usage`).

---

## 3. How a component gets its styles

A component lists its sheets in `styleUrls`, **from the most general to its own file**:

```ts
// admin/shop-pages/edit-eshop/edit-eshop.component.ts
styleUrls: [
  '../../shared-styles/theme.css',        // 1. look tokens
  '../../../shared/styles/base.css',      // 2. shared base
  '../../shared-styles/settings-page.css',// 3. shared layout
  './edit-eshop.component.css',           // 4. own rules – always last
],
```

Why this order matters: rules of equal specificity are decided by order, so the component's own file
must come last – it can override anything shared. Keep this order when you add a file.

Why `styleUrls` and not the global `styles.css`: Angular scopes every sheet listed in `styleUrls` to
the component (emulated encapsulation). A shared file therefore behaves exactly like a copy inside
the component – same specificity, no leaking into other components. Putting component rules into
`styles.css` would make them global and could change pages you did not touch.

Consequence of the scoping: a component's CSS only styles elements of **its own template**. It never
reaches into a child component, content inserted with `[innerHTML]`, or a CDK overlay. Style those in
the component that renders them.

---

## 4. Tokens

### 4.1 Colour primitives – `app/shared/styles/tokens.css`

Raw palette values on `:root`, available everywhere (imported once by `styles.css`):

```css
color: var(--color-zinc-900);
background: var(--color-emerald-50);
```

- Names: `--color-<palette>-<shade>` (50 lightest … 900 darkest), plus `--color-white` / `--color-black`.
  The `--color-` prefix is mandatory – several components define their own `--white`, `--accent` …,
  and a global token with the same name would override or be overridden silently.
- No meaning here. "Accent" or "text" is decided by a theme.
- A colour used in only one look (e.g. the violet `#a67dff` of the public web) belongs to that
  look's `theme.css`, not here.

### 4.2 Looks (themes) – `theme.css`

The app has three looks that use the **same token names with different values**:

| Look | File | Used by |
|---|---|---|
| admin (light, zinc) | `admin/shared-styles/theme.css` | admin layout, auth pages, edit-roles, knowledge base, edit-eshop, edit-website, **public project portal** |
| public web (dark, violet) | `public/web-pages/shared-styles/theme.css` | about, FAQ, references, services, jobs, job detail, order form, footer |
| public e-shop (light, black) | `public/shop-pages/shared-styles/theme.css` | cart, catalog, checkout, product detail, header, footer, builders |

A theme is a `:host { --accent: …; }` block, so it is scoped like any component sheet and the three
looks never clash.

- **Only tokens that every user of the theme defines** are in it. A component that uses a token the
  theme does not have defines it itself.
- **"local value" comments**: when a component needs a different value for a theme token, it keeps
  its own declaration after the theme, marked like this:
  ```css
  --border-mid: #e4e4e7; /* local value – admin theme.css: #e0e0dd */
  ```
  Changing the theme value does **not** change such components. Decide per case whether to remove
  the local value.
- **Inheritance**: custom properties are inherited by child components. Admin pages rendered inside
  the admin layout get the layout's tokens without including the theme. Do not add `theme.css` to a
  component just because it uses `var(--accent)` – if it already inherits the right value, adding the
  theme can change what its children inherit.
- **Project portal** is a public page in the admin look; it includes the admin `theme.css`. This is
  the only place where public code uses an admin shared file (an explicit project decision).
- Maintenance pages (`public/*/…-maintenance`) keep their own palette on purpose.

---

## 5. Where does a new style go?

```
Is it used by ONE component?                    → that component's *.component.css
Used IDENTICALLY by several components of …
   … one module (e.g. only admin shop)          → that module's shared-styles/
   … several admin modules (core/shop/web)      → admin/shared-styles/
   … several public modules (web/shop)          → public/shared-styles/
   … admin AND public                           → app/shared/styles/
Is it a colour value used in admin AND public?  → tokens.css (--color-*)
Is it a meaning of a colour in one look?        → that look's theme.css
```

Rules for shared files:

1. **Everything in a shared file must be valid for every component that includes it.** If one page
   needs a variation, keep the variation in that page's own file (it comes last and wins), or create a
   second shared file for the smaller group. Never add a rule to a shared file "for one page".
2. **Depend only upwards**: page → own module's `shared-styles/` → `admin/` or `public/shared-styles/`
   → `app/shared/styles/`. Never sideways (web ↛ shop) and never admin ↔ public (except §4.2 portal).
3. **Same selector, same meaning.** When pages share a block under different class names, give the
   elements a shared class next to their own (`class="faq-hero content-page-hero"`) instead of listing
   page classes in the shared file.
4. **Name files by content** (`dashboard-cards.css`), not by who uses them.
5. Document every new file and block with the CSS template (`docs/code_documentation/doc_CSS_comment_block.json` in the repository root).

---

## 6. Recipes

**New admin list page** (table + toolbar, like logs or coupons)
```ts
styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css', './my-page.component.css'],
```
Leave out `./my-page.component.css` if the page has no rules of its own – do not keep empty CSS files.

**New public content page** (like about or FAQ)
```html
<section class="my-page content-page">
  <header class="my-hero content-page-hero"> … </header>
```
```ts
styleUrls: ['../shared-styles/theme.css', '../shared-styles/content-page.css', './my-page.component.css'],
```
The hero **title** is not shared – the pages use different title sizes, so style it in the page.

**New colour**: used in both admin and public → add `--color-…` to `tokens.css`; used in one look → add
a token to that `theme.css`; used once → a literal in the component is fine.

**Change the accent of the admin**: edit `admin/shared-styles/theme.css`, then search for
`local value – admin theme.css` to see which components keep their own value.

---

## 7. Don'ts

- Don't put component rules into `src/styles.css` (they become global).
- Don't put themed names (`--accent`, `--text`, `--border` …) on `:root`.
- Don't use `::ng-deep` – style the child in the child component.
- Don't copy a block from another page – move it to the right `shared-styles/` file and include it.
- Don't leave unused classes behind when you remove markup from a template.

---

## 8. History – the 2026-10 cleanup

The structure above was introduced by a cleanup that kept the rendered result **identical**:

| | Before | After |
|---|---|---|
| CSS files | 97 | 96 (26 shared files, 23 dead files removed) |
| Lines | 29 634 | 25 300 |
| Declarations | 19 393 | 16 004 |
| 6-digit hex literals in component CSS | 2 523 | 397 |

What changed: theme tokens copied into 25 components moved to three `theme.css`; 2 033 colour
literals now use `--color-*` primitives; 390 rules that were identical in several files moved into
shared files; 251 rules whose classes no template uses were deleted (e.g. `*-hero-eyebrow`, the old
`file-drop-area`, the admin layout's maintenance toggle); 99 declarations overridden by a later rule
with the same selector in the same file were dropped; 20 unused and 3 emptied CSS files deleted.

How "identical" was checked: for each of the 89 components (plus the global sheet) the stylesheet
Angular builds – `styleUrls` in order, `@import` inlined, nesting and `@media` flattened, tokens
resolved – was compared with the original commit: every selector keeps the same final value of every
property, and rules that can meet on one element with equal specificity keep their order. Removed
rules were checked to have no matching element in any template. Plus `ng build` (development and
production).

Left as they are on purpose (no visual change allowed):
- hero titles, `.cta-btn`, `.cta-block` – similar but not identical between pages;
- event-type colour rules (`.ev-*`) in the dashboards – their order against dynamically applied
  classes must not change;
- small differences inside the admin look – `--border-mid` (marked "local value"), and `--ease`
  (0.16s / 0.18s), `--radius-lg`, `--radius-md`, which some components define with different values
  and therefore stay in those components; unify them deliberately if the design allows it.
