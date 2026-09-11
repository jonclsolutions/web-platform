# Enum hodnoty a booleany v generických builder komponentách

Tenhle dokument navazuje na `admin-i18n.md` a popisuje, jak se **hodnoty
uložené v DB** (status/priority/thema/boolean sloupce) technicky promítají do
přeloženého textu v `TableBuilderComponent`, `FormBuilderComponent` a
`FilterFormBuilderComponent` — tedy ve sdílených builderech, které
`AdminLocalizationService` **neinjektují samy** (viz bod 5.3 předchozího
dokumentu), a přesto musí zobrazovat přeložený text.

## 1. Princip — builder text nikdy nezná, jen ho přeposílá

Žádný ze tří builderů neřeší **jak** se hodnota přeloží. Vždy jen hledá
existující `{value, label}` pár, který mu **stránka** (přes `*.config.ts`)
předala v `InputDefinition.options`/`FilterColumns.options`. Builder je tak
plně nezávislý na jazyce i na tom, kolik jazyků administrace podporuje —
stará se o to výhradně stránka, která `AdminLocalizationService` injektuje.

```
*.config.ts (zná i18n)
   │  vytvoří {value: 'in_progress', label: 'Zpracovává se'}
   ▼
InputDefinition.options / FilterColumns.options
   │  (obyčejná data, žádná i18n reference uvnitř)
   ▼
FormBuilderComponent / FilterFormBuilderComponent / TableBuilderComponent
   │  jen hledají: options.find(o => o.value === rawValue)?.label
   ▼
Zobrazený text
```

## 2. Canonical value vs. label — jediné místo pravdy

Sloupce jako `status`/`priority`/`thema` mají dvě odlišné role:

- **`value`** — string, který se posílá na backend a ukládá do DB. **Nikdy
  se nepřekládá.** Backendová validace (`in:new,in_progress,done,cancelled`)
  i filtrování v DB (`WHERE status = ?`) pracují výhradně s touto hodnotou.
- **`label`** — text, který vidí uživatel. Přeložený, jazykově závislý.

Recept z `user-request.config.ts` (referenční implementace pro celý
projekt):

```typescript
// 1) Canonical VALUES - anglický slug, nikdy nepřekládat
export const USER_REQUEST_STATUS_VALUES: string[] = ['new', 'in_progress', 'done', 'cancelled'];

// 2) slug -> i18n klíč (NE slug -> text přímo)
const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'status_new',
  in_progress: 'status_in_progress',
  done: 'status_done',
  cancelled: 'status_cancelled',
};

// 3) Sdílená pomocná funkce - vrací {value, label} páry
function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}
```

Tahle trojice (`_VALUES` + `_LABEL_KEYS` + `mapLabeledOptions()`) je jediné
místo, kam sahá jak formulář, tak filtr, tak (nepřímo) tabulka — žádná
duplicitní definice hodnot nikde jinde v komponentě.

> **Poznámka k historii:** bod 5.4 v `admin-i18n.md` popisoval tohle jako
> "plán do budoucna" s tím, že `value` zatím zůstává v češtině. Tenhle plán
> je od migrace `003_status_slugs_web_raw_request_commissions.sql` **splněný**
> pro `web_raw_request_commissions` — DB sloupce teď nesou anglické slugy,
> validace na backendu (`Store/UpdateWebRawRequestCommissionRequest`) je
> přepsaná zároveň. Pro ostatní tabulky (`web_sales_leads`, `web_job_applications`,
> `web_support_tickets`, ...) je to práce, která se řeší controller po
> controlleru stejným receptem, viz sekce 6 níže.

## 3. Jak to čte `FormBuilderComponent`

Formulářové `select` pole dostává `options` přímo v `InputDefinition`:

```typescript
{
  column_name: 'status',
  type: 'select',
  options: mapLabeledOptions(USER_REQUEST_STATUS_VALUES, STATUS_LABEL_KEYS, i18n),
  ...
}
```

`FormBuilderComponent` páry jen vykreslí jako `<option [value]="opt.value">{{ opt.label }}</option>`
— žádnou i18n logiku v sobě nemá. `normalizeSelectValues()` navíc při
otevření formuláře k editaci porovnává uloženou DB hodnotu (`value`) se
seznamem `options`, ne s labelem — proto musí `value` v `options` **přesně**
odpovídat tomu, co je v DB (slug, ne text).

## 4. Jak to čte `FilterFormBuilderComponent`

Filtr má stejnou schopnost, ale dřív se u téhle komponenty nevyužívala —
`FilterColumns.options` byl historicky plochý `string[]` (stejná hodnota
sloužila jako filtr-hodnota poslaná do API i jako zobrazený text). Šablona
(`filter-form-builder.component.html`) ale **od začátku** uměla obojí:

```html
@for (option of $any(column.options); track option) {
  <option [value]="option?.value !== undefined ? option.value : option">
    {{ option?.label !== undefined ? option.label : option }}
  </option>
}
```

Pokud `option.value` existuje, použije se `{value,label}` pár (přeložený
text, anglický slug jako hodnota). Pokud ne, chová se to jako dřív (plochý
string je zároveň hodnota i text) — zpětně kompatibilní se stránkami, které
`mapLabeledOptions()` ještě nepoužívají. Migrace na přeložené filtry proto
**nevyžaduje žádnou úpravu builderu** — jen se ve `*.config.ts` přepne
`options: USER_REQUEST_STATUS_VALUES` na
`options: mapLabeledOptions(USER_REQUEST_STATUS_VALUES, STATUS_LABEL_KEYS, i18n)`.

## 5. Jak to čte `TableBuilderComponent`

`getCellValue()` v `default` větvi (case pro cokoliv, co není
`currency`/`date`/`boolean`/`image`) hledá stejný pár, ale ne ve vlastní
konfiguraci — v `InputDefinitions`, které stránka stejně musí builderu
předat kvůli formuláři (`[inputDefinitions]="formFields"`):

```typescript
default:
  const fieldDef = this.inputDefinitions.find(i => i.column_name === column.key);
  if (fieldDef?.options) {
    const option = fieldDef.options.find(opt => String(opt.value) === String(value));
    return option ? option.label : value;
  }
  return value;
```

**Důsledek:** pokud pole v `createUserRequestFormFields()` `options` nemá
(typicky `type: 'text'` bez pevného seznamu hodnot), tabulka zobrazí syrovou
DB hodnotu (slug) beze změny — žádná chyba, ale žádný překlad. Tohle byl
přesně případ `thema` u `user-request` (pole bylo `text` s regex validací
pro volný vstup z veřejného formuláře, `options` chybělo) — oprava je
doplnit `options: mapLabeledOptions(...)` i k `text` poli. `type` zůstává
`'text'` (formulář na `options` u `text` typu nijak nereaguje), jen tabulka
si `options` z něj přečte.

`String(opt.value) === String(value)` porovnává jako string — funguje tedy
stejně pro numerické i textové sluggy, žádná typová konverze navíc není
potřeba.

**Volné texty se nerozbijí:** pokud sloupec obsahuje hodnotu mimo pevný
seznam (např. zákazník napsal vlastní `thema` mimo pět předdefinovaných
kategorií), `options.find()` vrátí `undefined` a metoda spadne na `return value`
— zobrazí se syrový text beze změny, ne prázdné pole nebo chyba.

## 6. Recept pro migraci dalšího sloupce/tabulky

Postup je identický napříč celým projektem (Core/Web/Shop), jen se mění
tabulka a `*.config.ts` soubor:

1. **Zjisti všechny DISTINCT hodnoty** v produkčních datech
   (`SELECT DISTINCT status FROM ...`) — ne jen ukázková data z dumpu.
2. **SQL migrace** — `UPDATE ... SET slug WHERE = 'český text'` pro každou
   hodnotu + `ALTER ... MODIFY ... DEFAULT 'slug'` na nový default.
3. **Backend validace** (`Store*Request`/`Update*Request`) — přepiš
   `in:Český text,Jiný text` na `in:slug_one,slug_two`.
4. **`*.config.ts`** — přejmenuj `..._VALUES` pole na slugy, překlíčuj
   `..._LABEL_KEYS` mapu na nové slugy (i18n klíče/JSON hodnoty samotné se
   typicky NEMĚNÍ, jen jejich klíč v mapě).
5. **Formulářová i filtrová pole** — obě použij přes `mapLabeledOptions()`.
6. Zkontroluj, že **žádné** pole se stejným canonical seznamem hodnot
   (typicky `text` pole s volným vstupem, které náhodou sdílí hodnoty s
   pevným seznamem, viz `thema` výše) nezůstalo bez `options` — jinak
   tabulka zobrazí slug místo labelu i přesto, že filtr/formulář fungují
   správně.

Kroky 2–3 musí proběhnout **současně** s krokem 4 — nikdy odděleně (stará
DB data by selhala na nové validaci, nebo select pole by nenašlo matching
option pro starou hodnotu).

## 7. Booleany — `shared.yes`/`shared.no`

Booleovské sloupce (`type: 'boolean'`) se řeší jinak než enum sloupce —
nejde o `options` pár, ale o pevnou dvojici klíčů ve `shared` sekci JSONu,
společnou pro celou administraci:

```typescript
// DetailsBuilderComponent.getFormattedValue() - referenční implementace
case 'boolean':
  return (value == true || value == 1)
    ? this.i18n.getValue('shared.yes')
    : this.i18n.getValue('shared.no');
```

`TableBuilderComponent.getCellValue()` musí používat **stejné** klíče, ne
vlastní natvrdo psaný text — obě komponenty totiž zobrazují tutéž DB hodnotu
(`is_active`, `is_featured`, ...), jen v jiném kontextu (řádek tabulky vs.
detail záznamu), a musí se shodnout na tom, jak vypadá "Ano"/"Yes" napříč
administrací. Žádná `*.config.ts` úprava tu není potřeba — `shared.yes`/
`shared.no` existuje jednou, sdílí ho každá komponenta, každý sloupec,
každá stránka.

## 8. Co builder NIKDY neřeší

- **Nezjišťuje aktuální jazyk sám.** Vždy dostává už hotový přeložený
  `label` zvenku — `AdminLocalizationService` je injektovaná jen ve
  stránce/`*.config.ts`, ne v builderu (viz bod 5.3 `admin-i18n.md`).
- **Nerozhoduje o canonical hodnotě.** `value` v `options` musí přesně
  odpovídat tomu, co je v DB — builder to jen porovná, nikdy nenormalizuje
  ani nehádá.
- **Neřeší chybějící `options`.** Pokud pole options nemá, builder tiše
  vrátí syrovou hodnotu — to není chyba builderu, ale chybějící konfigurace
  na straně stránky (viz sekce 5–6 výše).
