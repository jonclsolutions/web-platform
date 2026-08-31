

/**
 * @file security-events.config.ts
 * @path src/app/admin/core-pages/security-events/security-events.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Statická konfigurace (tlačítka, sloupce tabulky/filtrů/detailů) pro stránku
 * bezpečnostního monitoringu (core_security_events). Read-only ve smyslu "žádné create" -
 * záznamy vznikají výhradně backendem (CoreSecurityEvent::record()) - ale na rozdíl od
 * core/logs (audit) tahle stránka podporuje TRIAGE (úprava statusu/poznámky přes tlačítko
 * "Řešit") a mazání jednotlivých záznamů i hromadný purge podle retence.
 *
 * @refactor-note (2026-08-22) UX - ČITELNÉ POPISKY A DOPORUČENÍ. `event_type`/`severity`/
 * `status` jsou interní technické identifikátory (`throttle_exceeded`, `scan_probe`...) -
 * bez kontextu nic neřeknou administrátorovi, který se s tím nesetkává denně, a
 * u rafinovanějšího útoku není vždy zřejmé, co dělat dál. Řešeno dvěma vrstvami:
 * 1) `FORM_FIELDS` teď obsahuje `select` mapování pro `event_type`/`severity`/`status` -
 *    `TableBuilderComponent.getCellValue()` UŽ toto mapování umí (hledá
 *    `inputDefinitions` podle `column_name` a nahradí hodnotu za `option.label`), takže
 *    tabulka zobrazí lidsky čitelný text bez JAKÉKOLIV úpravy samotného table builderu.
 * 2) `EVENT_TYPE_INFO` + `buildEventExplanation()` - mapa "co se stalo / co to znamená /
 *    co doporučujeme" pro každý typ eventu, s dosazením konkrétních dat KONKRÉTNÍHO
 *    záznamu (IP, endpoint, e-mail, počet výskytů) do šablony textu. Zobrazuje se
 *    v triage modalu (`SecurityEventsComponent.triageExplanation`) v okamžiku, kdy
 *    administrátor rozhoduje, jaký stav záznamu nastavit.
 */
import * as Core from '../../../shared/imports/core-providers';

export const BUTTONS: Core.TableButtons[] = [
  { display_name: 'Detaily', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details', icon: 'search' },
  { display_name: 'Řešit', header_name: 'Řešit', isActive: true, type: 'edit_button', action: 'edit', permission: 'core-security-update', icon: 'edit' },
  { display_name: 'Smazat', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'core-security-delete', icon: 'delete' },
];

export const TOOLBAR_BUTTONS: Core.Button[] = [
  {
    action: 'toggleFilters',
    label: 'Otevřít filtry',
    icon: '',
    class: 'btn-filter',
    isActive: false
  },
  { action: 'openGraphBuilder', label: 'Generovat grafy a reporty', icon: '', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
  {
    action: 'exportActiveTable',
    label: 'Exportovat data',
    icon: '',
    class: 'btn-export',
    showIf: true
  }
];

/**
 * @description Mapování technických hodnot na lidsky čitelný text pro sloupce
 * `event_type`/`severity`/`status` v tabulce i exportu - `TableBuilderComponent`
 * (`getCellValue()`/`getExportValueForKey()`) tohle mapování aplikuje automaticky,
 * jen podle `column_name`, bez nutnosti upravovat samotný builder.
 */
export const FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'event_type',
    type: 'select',
    options: [
      { value: 'captcha_failed', label: 'Selhání CAPTCHA' },
      { value: 'captcha_provider_error', label: 'Výpadek captcha služby' },
      { value: 'throttle_exceeded', label: 'Překročen limit požadavků' },
      { value: 'login_failed', label: 'Neúspěšné přihlášení' },
      { value: 'login_brute_force_suspected', label: 'Podezření na brute-force útok' },
      { value: 'login_2fa_invalid', label: 'Špatný ověřovací kód (2FA)' },
      { value: 'login_2fa_exhausted', label: 'Vyčerpané pokusy o 2FA kód' },
      { value: 'login_2fa_resend_exhausted', label: 'Vyčerpané žádosti o 2FA kód' },
      { value: 'refresh_token_invalid', label: 'Neplatný přihlašovací token' },
      { value: 'scan_probe', label: 'Automatizované skenování' },
    ],
  } as unknown as Core.InputDefinition,
  {
    column_name: 'severity',
    type: 'select',
    options: [
      { value: 'info', label: 'Informativní' },
      { value: 'warning', label: 'Varování' },
      { value: 'critical', label: 'Kritické' },
    ],
  } as unknown as Core.InputDefinition,
  {
    column_name: 'status',
    type: 'select',
    options: [
      { value: 'new', label: 'Nový' },
      { value: 'reviewed', label: 'Vyřešeno' },
      { value: 'false_positive', label: 'Falešný poplach' },
      { value: 'confirmed_attack', label: 'Potvrzený útok' },
    ],
  } as unknown as Core.InputDefinition,
];

export const TABLE_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'last_seen_at', header: 'Naposledy', type: 'date', format: 'short' },
  { key: 'event_type', header: 'Typ události', type: 'text' },
  { key: 'severity', header: 'Závažnost', type: 'text' },
  { key: 'ip_address', header: 'IP adresa', type: 'text' },
  { key: 'occurrences', header: 'Počet výskytů', type: 'number' },
  { key: 'status', header: 'Stav', type: 'text' },
];

export const FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID záznamu', canSort: true },
  {
    key: 'event_type',
    header: 'Typ události',
    type: 'select',
    options: [
      'captcha_failed',
      'captcha_provider_error',
      'throttle_exceeded',
      'login_failed',
      'login_brute_force_suspected',
      'login_2fa_invalid',
      'login_2fa_exhausted',
      'login_2fa_resend_exhausted',
      'refresh_token_invalid',
      'scan_probe',
    ],
    placeholder: '-- Typ události --',
    canSort: true
  },
  {
    key: 'severity',
    header: 'Závažnost',
    type: 'select',
    options: ['info', 'warning', 'critical'],
    placeholder: '-- Závažnost --',
    canSort: true
  },
  {
    key: 'status',
    header: 'Stav',
    type: 'select',
    options: ['new', 'reviewed', 'false_positive', 'confirmed_attack'],
    placeholder: '-- Stav --',
    canSort: true
  },
  { key: 'ip_address', header: 'IP adresa', type: 'text', placeholder: 'Hledat IP', canSort: true },
];

export const DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID záznamu', type: 'text' },
  {
    key: 'event_type',
    displayName: 'Typ události',
    type: 'text',
    chartable: true,
    chartPossibleValues: [
      'captcha_failed', 'captcha_provider_error', 'throttle_exceeded', 'login_failed',
      'login_brute_force_suspected', 'login_2fa_invalid', 'login_2fa_exhausted',
      'login_2fa_resend_exhausted', 'refresh_token_invalid', 'scan_probe',
    ],
  },
  {
    key: 'severity',
    displayName: 'Závažnost',
    type: 'text',
    chartable: true,
    chartPossibleValues: ['info', 'warning', 'critical'],
  },
  { key: 'ip_address', displayName: 'IP adresa', type: 'text' },
  { key: 'user_agent', displayName: 'User-Agent', type: 'text' },
  { key: 'route', displayName: 'Route', type: 'text' },
  { key: 'method', displayName: 'HTTP metoda', type: 'text' },
  { key: 'user_id', displayName: 'ID uživatele (pokud přihlášený)', type: 'text' },
  { key: 'occurrences', displayName: 'Počet výskytů v okně', type: 'text' },
  {
    key: 'status',
    displayName: 'Stav triage',
    type: 'text',
    chartable: true,
    chartPossibleValues: ['new', 'reviewed', 'false_positive', 'confirmed_attack'],
  },
  { key: 'notes', displayName: 'Poznámka administrátora', type: 'text' },
  { key: 'context_data', displayName: 'Kontext (JSON)', type: 'text' },
  { key: 'first_seen_at', displayName: 'První výskyt', type: 'date', format: 'medium' },
  { key: 'last_seen_at', displayName: 'Poslední výskyt', type: 'date', format: 'medium' },
];

/**
 * @description Jedno vysvětlení pro daný `event_type` - "co se stalo" a "co doporučujeme"
 * jsou ŠABLONY s placeholdery (`{route}`, `{ip}`, `{email}`, `{user_id}`, `{occurrences}`),
 * které `buildEventExplanation()` nahradí konkrétními daty daného záznamu. Texty jsou
 * záměrně bez emoji a bez technického žargonu - cílí na administrátora, který se
 * s bezpečnostním monitoringem nesetkává denně.
 */
interface EventTypeInfo {
  label: string;
  whatHappened: string;
  recommendation: string;
}

export const EVENT_TYPE_INFO: Record<string, EventTypeInfo> = {
  captcha_failed: {
    label: 'Selhání CAPTCHA',
    whatHappened: 'Někdo odeslal přihlašovací formulář bez platného ověření CAPTCHA z IP adresy {ip} (endpoint {route}).',
    recommendation: 'Pokud počet výskytů rychle roste, jde pravděpodobně o automatizovaný skript zkoušející hesla (běžný bot CAPTCHU nevyřeší). Zvažte dočasné zablokování téhle IP adresy na úrovni firewallu, hostingu nebo CDN (např. Cloudflare).',
  },
  captcha_provider_error: {
    label: 'Výpadek captcha služby',
    whatHappened: 'Server se pokusil ověřit CAPTCHA token u Cloudflare Turnstile, ale externí služba neodpověděla nebo vrátila chybu.',
    recommendation: 'Obvykle nejde o útok, jen o dočasný výpadek třetí strany. Akce není nutná - pokud se to opakuje dlouhodobě, zkontrolujte stav Cloudflare Turnstile.',
  },
  throttle_exceeded: {
    label: 'Překročen limit počtu požadavků',
    whatHappened: 'Z IP adresy {ip} přišlo na endpoint {route} víc požadavků, než povoluje nastavený limit, během jedné minuty ({occurrences}× za sledované okno).',
    recommendation: 'U veřejných formulářů (poptávka, reset hesla) může jít o pokus o spam nebo zahlcení. Pokud se opakuje dlouhodobě ze stejné IP, zvažte její zablokování na úrovni firewallu/CDN.',
  },
  login_failed: {
    label: 'Neúspěšný pokus o přihlášení',
    whatHappened: 'Někdo se pokusil přihlásit se špatným heslem k účtu {email} z IP adresy {ip}.',
    recommendation: 'Jednotlivý neúspěšný pokus je běžný (překlep). Sledujte, jestli počet výskytů neroste - to by byl varovný signál (viz níže "Podezření na brute-force útok").',
  },
  login_brute_force_suspected: {
    label: 'Podezření na brute-force útok na heslo',
    whatHappened: 'Počet neúspěšných pokusů o přihlášení k účtu {email} z IP adresy {ip} překročil bezpečnostní práh - od této chvíle systém u tohoto e-mailu vyžaduje CAPTCHA.',
    recommendation: 'Doporučujeme ověřit, zda dotčený účet nemá slabé/uhodnutelné heslo, případně vynutit jeho změnu. Pokud pokusy pokračují i po zavedení CAPTCHA, zvažte zablokování IP adresy.',
  },
  login_2fa_invalid: {
    label: 'Špatně zadaný ověřovací kód (2FA)',
    whatHappened: 'Uživatel (ID {user_id}) zadal po úspěšném přihlášení heslem nesprávný dvoufázový ověřovací kód, z IP adresy {ip}.',
    recommendation: 'Ojedinělý výskyt je obvykle jen překlep. Víc pokusů krátce po sobě může znamenat, že útočník zná heslo, ale nemá přístup ke schránce s kódem - zvažte kontaktovat uživatele a doporučit mu změnu hesla.',
  },
  login_2fa_exhausted: {
    label: 'Vyčerpán počet pokusů o zadání 2FA kódu',
    whatHappened: 'Uživatel (ID {user_id}) opakovaně zadal špatný ověřovací kód a vyčerpal maximální povolený počet pokusů - přihlašovací relace byla zneplatněna.',
    recommendation: 'Doporučujeme ověřit s uživatelem, zda se skutečně pokoušel přihlásit sám. Pokud ne, jde o poměrně silný signál kompromitovaného hesla.',
  },
  login_2fa_resend_exhausted: {
    label: 'Vyčerpán počet žádostí o nový 2FA kód',
    whatHappened: 'Bylo vyžádáno maximum opakovaných zaslání ověřovacího kódu v rámci jedné přihlašovací relace (z IP adresy {ip}).',
    recommendation: 'Samo o sobě málo významné. V kombinaci s dalšími eventy od stejné IP nebo účtu ale může jít o snahu zahltit e-mailovou schránku uživatele - zkontrolujte i ostatní záznamy se stejnou IP.',
  },
  refresh_token_invalid: {
    label: 'Neplatný přihlašovací token',
    whatHappened: 'Aplikace se pokusila obnovit přihlášení tokenem, který je expirovaný, smazaný nebo neplatný (IP adresa {ip}).',
    recommendation: 'Obvykle jde o běžné vypršení relace (uživatel se dlouho nepřihlásil) - v takovém případě není potřeba nic dělat. Vysoký počet výskytů z jedné IP může znamenat pokus o uhodnutí/zneužití tokenu - v tom případě zvažte zablokování IP.',
  },
  scan_probe: {
    label: 'Automatizované skenování zranitelností',
    whatHappened: 'Bot zkusil zavolat cestu, která v aplikaci neexistuje, ale je typická pro známé zranitelnosti jiných systémů (odhalené .env soubory, staré WordPress instalace, exponovaný .git adresář apod.) - naposledy {route}, z IP adresy {ip}.',
    recommendation: 'Tohle dělají prakticky nepřetržitě boti po celém internetu - protože takové cesty v aplikaci neexistují, sama o sobě nejsou zranitelností. Pokud provoz z jedné IP dlouhodobě pokračuje ve vysokém objemu, zvažte trvalé zablokování na úrovni firewallu/CDN.',
  },
};

/** @description Fallback pro typ eventu, který zatím nemá vlastní vysvětlení v `EVENT_TYPE_INFO` (např. nově přidaný typ). */
const FALLBACK_EVENT_INFO: EventTypeInfo = {
  label: 'Neznámý typ události',
  whatHappened: 'Pro tento typ události zatím není k dispozici podrobný popis.',
  recommendation: 'Zkontrolujte IP adresu, endpoint a kontext záznamu ručně, nebo kontaktujte vývojáře ohledně doplnění vysvětlení pro tento typ.',
};

/**
 * @description Sestaví konkrétní vysvětlení pro daný záznam - dosadí skutečná data
 * (IP, route, e-mail, ID uživatele, počet výskytů) do šablony z `EVENT_TYPE_INFO`.
 * E-mail se čte z `context_data.email` (ukládá ho jen `AuthController` u login eventů,
 * u ostatních typů chybí - placeholder `{email}` se pak nahradí obecným textem).
 * @param item Řádek `core_security_events` (tvar `CoreSecurityEventResource`).
 */
export function buildEventExplanation(item: any): EventTypeInfo {
  const info = EVENT_TYPE_INFO[item?.event_type] ?? FALLBACK_EVENT_INFO;
  const email = item?.context_data?.email ?? 'neznámý účet';
  const replacements: Record<string, string> = {
    '{route}': item?.route ?? 'neznámý endpoint',
    '{ip}': item?.ip_address ?? 'neznámá IP',
    '{email}': email,
    '{user_id}': item?.user_id != null ? String(item.user_id) : 'neznámé',
    '{occurrences}': item?.occurrences != null ? String(item.occurrences) : '?',
  };

  const fill = (template: string): string =>
    Object.entries(replacements).reduce((text, [key, value]) => text.split(key).join(value), template);

  return {
    label: info.label,
    whatHappened: fill(info.whatHappened),
    recommendation: fill(info.recommendation),
  };
}
