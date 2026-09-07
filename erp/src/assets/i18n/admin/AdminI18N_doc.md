# Vícejazyčná administrace (Admin i18n)

Tenhle dokument popisuje, jak funguje **statický i18n systém admin rozhraní** —
tedy překlad textů samotné administrace (tlačítka, labely, hlášky), **ne**
obsahu veřejného webu.

## 1. Dva nezávislé i18n systémy — nepleť si je

V projektu existují **dva zcela oddělené** překladové systémy:

| | `LocalizationService` | `AdminLocalizationService` |
|---|---|---|
| Co překládá | Obsah **veřejného webu** (texty stránek, e-shopu) | UI **administrace** (tlačítka, labely, hlášky) |
| Odkud se bere | Z databáze, editovatelné přes `EditWebsiteComponent`/`EditEshopComponent` | Ze statických JSON souborů zabalených s frontendem |
| Kdo edituje text | Admin přes formulář v UI | Vývojář, přímo v JSON souboru |
| Typický počet jazyků | 1–2 (podle webu) | Může růst na 10+ |

**Nikdy je nemíchej.** Pokud upravuješ text tlačítka v administraci, jde vždy o
`AdminLocalizationService`.

## 2. Jak to funguje technicky

### Zdroj dat
Každý jazyk má vlastní JSON soubor:
```
src/assets/i18n/admin/cz/cz.json
src/assets/i18n/admin/en/en.json
```
a vlaječku vedle něj (`cz.png`, `en.png`).

### Struktura JSON
Plochá mapa **sekce → klíče**:
```json
{
  "shared": { "confirm": "Potvrdit", "cancel": "Zrušit" },
  "user-request": { "table_header": "Webový formulář", "btn_edit": "Edit" }
}
```
- `shared` — texty společné napříč celou administrací (Uložit/Zrušit/Chyba...).
  Automaticky se přimíchá ke KAŽDÉ sekci.
- Každý další klíč nejvyšší úrovně = jedna stránka/komponenta (`user-request`,
  `edit-roles`, `web-settings`...).

### Chybějící překlad se nikdy netváří jako čeština
Pokud klíč nebo celá sekce v JSONu chybí, `AdminLocalizationService` vrátí
doslovný text `Cannot load text` — **nikdy** tiše nespadne na češtinu.
Je to záměr: chybějící překlad má být hned vidět a snadno dohledatelný
(`grep "Cannot load text"` v UI), ne se schovat za "vypadá to OK, je to jen
česky".

### Jak se jazyk vybírá a ukládá
- Volba jazyka je uložena **jen v `localStorage` prohlížeče** — žádný sloupec
  v DB, žádný backend endpoint. Je to čistě per-prohlížeč preference.
- Přepínání řeší `PersonalInfoComponent` (dropdown s vlaječkami).

### Datum a čas
`AdminLocalizationService.getDateLocale()` mapuje interní kód jazyka (`cz`,
`en`) na BCP-47 locale (`cs-CZ`, `en-US`) pro `DatePipe`. Nový jazyk vyžaduje
i registraci locale dat v `app.config.ts` (`registerLocaleData(...)`) —
jinak `DatePipe` s neznámým locale spadne.

Globální `LOCALE_ID` provider v `AdminLayoutComponent` zůstává natvrdo
`cs-CZ` — týká se jiných věcí (např. `CurrencyPipe`), ne datumů v adminu.

## 3. Jak přidat text do existující komponenty

**Vzor A — komponenta dědí `BaseDataComponent`:**

```typescript
export class MyComponent extends BaseDataComponent<...> {
  protected override translationSection: string = 'my-page';

  // POVINNÝ override kvůli bugu popsanému níže (bod 5.1) — vlož ho VŽDY:
  public override t(key: string): string {
    return this.i18n.getValue(`my-page.${key}`);
  }
}
```
V šabloně: `{{ strings.some_key }}` (přes `getMergedSection`) nebo
`{{ t('some_key') }}` v `.ts` pro imperativní texty (alert dialogy apod.).

**Vzor B — komponenta `BaseDataComponent` nedědí** (sdílené buildery jako
`TableBuilderComponent`, `FormBuilderComponent`, `GraphBuilderComponent`,
nebo samostatné stránky jako `PersonalInfoComponent`, `WelcomePageComponent`):

```typescript
public readonly i18n = inject(AdminLocalizationService);
public get strings(): any { return this.i18n.getMergedSection('my-section'); }
public t(key: string): string { return this.i18n.getValue(`my-section.${key}`); }
```

Pokud komponenta má `ChangeDetectionStrategy.OnPush`, přidej do konstruktoru:
```typescript
this.i18n.translations$.subscribe(() => this.cd.markForCheck());
```
jinak se po přepnutí jazyka nepřekreslí.

## 4. Texty s proměnnou (interpolace)

**Žádný templating engine.** Do JSONu se ukládá šablona s `{placeholder}` a
v kódu se nahradí přes `.replace()`:

```json
"save_success": "Sekce byla úspěšně uložena pro {name}."
```
```typescript
this.t('save_success').replace('{name}', role.role_name)
```

Pro tučný text uvnitř věty (např. `<strong>bez hesla</strong>`) se věta
**rozdělí na prefix/bold/suffix klíče**, ne `[innerHTML]` — vyhneme se tak
XSS riziku jen kvůli tučnému písmu:
```json
"info_banner_prefix": "Účet se vytvoří ",
"info_banner_bold": "bez hesla",
"info_banner_suffix": ". Uživatel obdrží e-mail..."
```
```html
{{ strings.info_banner_prefix }}<strong>{{ strings.info_banner_bold }}</strong>{{ strings.info_banner_suffix }}
```

## 5. Časté chyby (a jak se jim vyhnout)

### 5.1 Chybějící `t()` override → "Cannot load text" všude
Zděděná `BaseDataComponent.t(path)` čeká **plnou cestu se sekcí**
(`'user-request.btn_edit'`), ne krátký klíč. Pokud v komponentě píšeš
`this.t('btn_edit')` bez vlastního override, `getValue()` hledá klíč
`btn_edit` na **nejvyšší úrovni JSONu**, kde neexistuje → `Cannot load text`.

**Řešení:** každá komponenta s vlastním `translationSection` musí mít
override z bodu 3 (Vzor A). Bez něj to vypadá, že "text nikde není", i když
JSON je v pořádku.

### 5.2 Nekonečná smyčka / NG0956 (destrukce tabulky)
Pokud konfigurace tabulky (sloupce, tlačítka) pochází z **factory funkce**
volané jako **getter** (`get buttons() { return createButtons(this.i18n); }`),
vrací se při **každém** čtení nové pole nových objektů. `@for` s
`track button` (track podle identity) pak vidí "jinou kolekci" při každém
change-detection průchodu → Angular zboří a znovu postaví celou tabulku →
to vyvolá další cyklus → nekonečná smyčka.

**Řešení, dvě části:**
1. V šablonách `@for` vždy trackuj podle **stabilního klíče**, ne identity:
   `track col.key`, `track button.action` — nikdy `track col`/`track button`.
2. Konfigurace z factory funkcí **nepočítej jako getter**. Ulož do obyčejného
   pole a naplň ho **jednou v konstruktoru** přes subscribe:
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
   `translations$` je `BehaviorSubject` — subscribe dostane hodnotu hned a
   znovu při každém dalším načtení/přepnutí jazyka, takže texty doplní, jakmile
   JSON reálně dorazí.

### 5.3 Sdílené komponenty nesmí injektovat žádnou i18n službu
`MultiFileUploadComponent` se používá jak na veřejném webu
(`LocalizationService`), tak v adminu (`AdminLocalizationService`). Kdyby si
sama injektovala jednu z nich, přestala by fungovat ve druhém kontextu.

**Řešení:** taková komponenta zůstává čistě prezentační — texty nikdy
nezjišťuje sama, vždy je dostává zvenku přes `@Input() textOverrides`
s výchozími (fallback) hodnotami pro zpětnou kompatibilitu. Konzument
(admin i public) si texty vytáhne ze své vlastní i18n vrstvy a pošle je
dovnitř jako obyčejná data.

### 5.4 Hodnoty uložené v DB ≠ zobrazený text
Pole jako `status`/`priority` mají hodnotu (`value`), která se posílá na
backend a ukládá do DB, a popisek (`label`), který vidí uživatel. **Value se
nikdy nepřekládá** — je to canonical string, který backend porovnává a
filtruje. Překládá se jen `label`:

```typescript
{ value: 'Zpracovává se', label: i18n.getValue('user-request.status_in_progress') }
```

Plán do budoucna: `value` přejde na anglické slugy (`in_progress` místo
`Zpracovává se`) jako samostatný task zahrnující DB migraci a úpravu
backendové validace — zatím se toho nedotýkáme, aby se nerozbilo
filtrování/ukládání.

## 6. Jak přidat nový jazyk

1. Vytvoř `src/assets/i18n/admin/{kód}/{kód}.json` (zkopíruj strukturu z
   `en.json`, přelož hodnoty) a `{kód}.png` (vlaječka).
2. Přidej záznam do `ADMIN_AVAILABLE_LANGUAGES` v `admin-localization.service.ts`.
3. Přidej mapování locale do `DATE_LOCALE_MAP` ve stejném souboru
   (např. `de: 'de-DE'`).
4. Zaregistruj locale data pro `DatePipe` v `app.config.ts`:
   ```typescript
   import localeDe from '@angular/common/locales/de';
   registerLocaleData(localeDe, 'de-DE');
   ```

Žádná další úprava kódu není potřeba — všechny komponenty čtou aktuální
jazyk dynamicky.

## 7. Checklist při migraci nové komponenty

- [ ] Najdi všechny natvrdo psané texty v `.html` i `.ts` (i chybové hlášky,
      `aria-label`, `title`, placeholdery).
- [ ] Přidej odpovídající klíče do **obou** JSON souborů (`cz.json`, `en.json`)
      pod stejnou sekcí.
- [ ] Nastav `translationSection` (Vzor A) nebo ruční injection (Vzor B).
- [ ] Pokud dědí `BaseDataComponent`, přidej override `t()` (bod 5.1).
- [ ] Pokud má `OnPush` a nedědí `BaseDataComponent`, přidej
      `translations$.subscribe(markForCheck)`.
- [ ] Pokud stránka má vlastní `*.config.ts` (sloupce/tlačítka tabulky),
      převeď statické konstanty na factory funkce a naplň je v konstruktoru
      (ne jako getter — viz bod 5.2).
- [ ] Zkontroluj `@for`/`*ngFor` v šabloně — `track` musí být podle stabilního
      klíče, nikdy podle identity objektu.
- [ ] `console.error`/`console.warn` (dev logy) se **nepřekládají** — nikdy je
      neuvidí koncový uživatel.
- [ ] Technické konstanty (permission klíče, CSS třídy, API cesty) se
      **nepřekládají**.
- [ ] Po nasazení otestuj v obou jazycích a hledej `Cannot load text`.
