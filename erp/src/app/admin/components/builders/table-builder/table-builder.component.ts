/**
 * @file table-builder.component.ts
 * @path src/app/admin/components/builders/table-builder/table-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A generic, highly configurable table component for displaying datasets with
 * built-in CRUD actions, multi-format export (CSV/XLSX/JSON/TXT), and localized formatting.
 *
 * @refactor-note (2025) Dříve dědil z BaseDataComponent kvůli `deleteData()` a napojení na
 * alert/auth služby — data ale vždy přicházejí přes `@Input`, takže paginační/koš/cache
 * polovinu BaseDataComponent tato komponenta nikdy nepoužívala. Nyní si skládá
 * `EntityCrudService` přímo (pro delete + log export) a alert/auth služby injektuje sama.
 *
 * @refactor-note (2026-08) Export přepracován z jediného tlačítka "Export" (okamžité
 * stažení) na formátový picker (`ExportPopupBuilderComponent`) s volbou CSV/XLSX/JSON/TXT.
 * Metoda `exportToCSV()` byla ZÁMĚRNĚ ponechána pod stejným jménem - jen teď otevírá popup
 * místo přímého stahování - aby žádný z mnoha `*.component.ts` napříč adminem, které ji
 * volají přes `this.activeTable.exportToCSV()` z toolbar akce, nemusel být upravován.
 * Skutečné generování souboru přesunuto do `handleExportFormatSelected()` + sady
 * `download*()` metod, sdílejících stejnou `getCellValue()` logiku jako viditelná tabulka
 * (formátování měny/data, popisky select hodnot) - export tak vždy odpovídá tomu, co admin
 * vidí na obrazovce, ne syrovým DB hodnotám.
 *
 * @refactor-note (2026-08-2) Export teď zahrnuje CELÝ řádek dat z API, ne jen sloupce
 * viditelné v `columnDefinitions` - dřív export bral výhradně to, co bylo v přehledové
 * tabulce, takže cokoliv schválně skryté z přehledu (např. `enable_2fa` u
 * administrátorů, protože to není na první pohled důležité v přehledu) se do exportu
 * vůbec nedostalo, i když šlo o reálná data záznamu. Pole navíc se formátují best-effort
 * podle odpovídající `InputDefinition` (checkbox -> 'true'/'false' string, select ->
 * label z options), jinak syrová hodnota; objekty/pole se serializují do JSON stringu.
 * Zavedeny `DEFAULT_EXPORT_EXCLUDED_KEYS` (hesla, soft-delete technické příznaky) +
 * `@Input() excludeFromExport` pro doplnění dalších polí per stránka, kdyby bylo
 * potřeba schovat i něco navíc, co do defaultní sady nepatří.
 *
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php,
 * table-buttons.ts a has-permission.directive.ts stejné datum): řádková akční tlačítka
 * (Edit/Delete/...) teď respektují volitelné `TableButtons.permission` pole - komponenta
 * injektuje `PermissionService` a `isButtonVisible()` ho vyhodnocuje (s podporou OR
 * syntaxe `klic1|klic2`, stejně jako *appHasPermission direktiva) jak v hlavičce tabulky,
 * tak u samotných řádků, a `colspanValue` s tím správně počítá, ať hlavička a řádky
 * nemají rozdílný počet sloupců, když je nějaké tlačítko permission schované. Tlačítka
 * bez `permission` pole se chovají beze změny (viditelná dokud `isActive`).
 *
 * @refactor-note (2026-08-6) Přidán table-level refresh: `@Input() lastUpdatedAt`
 * (zobrazí "Aktualizováno v HH:MM:SS" v toolbaru) a `@Output() refreshRequested`
 * (rodičovská stránka na to naváže voláním `forceFullRefresh()` z BaseDataComponent -
 * viz backlog task "zbytečně moc dotazů na API"). Tahle komponenta sama žádnou cache
 * ani TTL neřeší - to je odpovědnost GenericTableService/PaginatedListStore, komponenta
 * jen emituje požadavek na tvrdý refresh a zobrazuje předaný timestamp.
 *
 * @refactor-note (2026-08-16) HROMADNÝ VÝBĚR + HROMADNÉ MAZÁNÍ. Přidán sloupec
 * checkboxů (vlevo od ID) - hlavičkový checkbox vybere/zruší výběr VŠECH řádků na
 * AKTUÁLNĚ ZOBRAZENÉ STRÁNCE (ne napříč stránkováním - `selectedIds` se resetuje při
 * každé změně `data`, viz `ngOnChanges()`, protože API nevrací ID mimo aktuální stránku
 * a "vybrat vše" napříč stránkami by tak bylo zavádějící). Nad tabulkou se objeví lišta
 * s počtem vybraných + dropdown "Akce" (šipka) obsahující "Smazat vybrané" - motivace
 * pro dropdown místo přímého tlačítka je budoucí rozšiřitelnost (další hromadné akce
 * půjdou přidat jako další položky menu, bez změny layoutu).
 *
 * @refactor-note (2026-08-16v2) EXPORTOVAT VYBRANÉ. Do stejného dropdownu přidána
 * položka "Exportovat vybrané" - otevírá STEJNÝ formátový popup (`ExportPopupBuilderComponent`)
 * jako toolbar tlačítko Export, ale `exportSelectedOnly` flag přepne zdroj dat v
 * `handleExportFormatSelected()`: místo `loadDataAsCollection()` (nový fetch celého,
 * nestránkovaného datasetu) se použijí objekty přímo z `this.data` (aktuální stránka),
 * filtrované na `selectedIds` - žádný nový síťový request, žádný nový backend endpoint.
 * Vybrané řádky mají stejný tvar jako plný export (přišly ze stejného API resource),
 * takže `buildExportRows()`/`getCellValue()` fungují beze změny pro oba případy.
 * `resolveExportData()` je jediné místo, které mezi těmito dvěma zdroji rozhoduje.
 *
 * Sloupec checkboxů se vykresluje VŽDY (`canBulkSelect`) - export vybraných je
 * bezpečný na jakékoliv tabulce, kterou uživatel vůbec vidí (view permission už
 * prokázal tím, že se `data` vůbec načetla). "Smazat vybrané" v dropdownu zůstává
 * podmíněné SAMOSTATNĚ (`canBulkDelete`) - pouze pokud `buttons` obsahuje aktivní
 * `delete_button` A uživatel na něj má permission (sdílí úplně stejnou
 * `isButtonVisible()` kontrolu jako řádkové tlačítko Smazat, žádný nový permission klíč
 * nebyl potřeba). Tabulky bez mazání (např. logy, které API stejně nedovoluje mazat)
 * tak dostanou checkboxy jen pro export, bez položky "Smazat vybrané" v menu.
 *
 * ŽÁDNÝ NOVÝ BACKEND ENDPOINT - bulk delete NENÍ jeden hromadný request, ale
 * `Promise.allSettled` nad stejným `crud.remove(id)`, který už používá řádkové mazání
 * (`onDeleteAction()`) - respektuje tak úplně stejná oprávnění/byznys pravidla na
 * backendu (např. "sysadmin účet smí smazat jen jiný sysadmin" v UserController) pro
 * KAŽDÉ jednotlivé ID zvlášť. Částečné selhání (např. 1 z 5 vybraných je cizí sysadmin
 * účet) se promítne do souhrnné hlášky ("Smazáno 4 z 5..."), ne do tichého selhání
 * celé akce. Vlastní řádek v `isAdminTable` (nelze smazat sám sebe) je z výběru úplně
 * vyloučený stejně jako u řádkového tlačítka (`selectableIds`/`isSelected` respektují
 * stejnou podmínku jako `[disabled]` na řádkovém Smazat tlačítku).
 *
 * @refactor-note (2026-08-18) VÝBĚR SLOUPCŮ K EXPORTU - viz backlog task "export:
 * uživatelský výběr sloupců přes checkboxy". `ExportPopupBuilderComponent` teď dostává
 * `[columns]="exportableColumnOptions"` - stabilní property (viz bugfix-note
 * 2026-08-18v2 u samotné property). Popup nabídne checkbox seznam (default vše
 * zaškrtnuto) a při volbě formátu vrátí `ExportSelection` (`{format, columnKeys}`)
 * místo dřívějšího prostého `ExportFormat`. `buildExportRows()` teď dostává
 * `selectedColumnKeys: string[] | null` jako druhý parametr.
 *
 * @refactor-note (2026-08-18v8 - FINÁLNÍ) Export je VÝHRADNĚ řízen `detailsColumns` -
 * `columnDefinitions` (tabulka) do exportu NEZASAHUJE VŮBEC, ani na výběr, jaká pole
 * se nabídnou, ani na jejich formátování. Dřívější varianta (v7) sice extra pole brala
 * z `detailsColumns`, ale KOMBINOVALA je se sloupci tabulky (a normalizovala tečkové
 * cesty, aby se předešlo duplicitám) - zjednodušeno na jediný, nezávislý zdroj.
 * `detailsColumns` teď nese i volitelné `type`/`format` (zatím využité pro `'date'`),
 * takže export dokáže formátovat datum stejně jako to dřív dělala tabulka. Stránka bez
 * `[detailsColumns]` bindingu nemá v exportu ŽÁDNÁ pole (ani z tabulky) - binding je
 * nutný vždy, pokud má export na dané stránce něco obsahovat.
 *
 * @dependencies
 * - EntityCrudService: CRUD volání (delete řádku/hromadné delete po jednom, POST log exportu).
 * - ConfirmDialogService: Facilitates safe delete operations (single i bulk).
 * - ExportPopupBuilderComponent: Formátový picker popup pro export dat, včetně výběru sloupců.
 * - PermissionService: Vyhodnocení `TableButtons.permission` pro řádková tlačítka i
 *   viditelnost "Smazat vybrané" v dropdownu (`canBulkDelete`).
 * - CurrencyPipe, DatePipe: Standard pipes for data formatting.
 * - xlsx (SheetJS): Lazy-loaded jen při volbě XLSX exportu, viz downloadXlsx().
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ChangeDetectorRef, OnDestroy, OnChanges, SimpleChanges, HostListener, inject
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subject } from 'rxjs';

import { DataHandler } from '../../../../core/services/data-handler.service';
import { EntityCrudService } from '../../../../core/services/entitiy-crud.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { PermissionService } from '../../../../core/auth/services/permission.service';
import { ColumnDefinition } from '../../../../shared/interfaces/generic-form-column-definiton';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { ExportFormat } from '../../../../shared/interfaces/export-format';
import { ExportPopupBuilderComponent, ExportColumnOption, ExportSelection } from '../export-popup-builder/export-popup-builder.component';

/**
 * @description Technická pole, která se z exportu vynechávají VŽDY, napříč všemi
 * tabulkami - hesla/hashe (nikdy by se neměly objevit v exportovaném souboru, i kdyby
 * je API omylem vrátilo) a soft-delete interní příznaky (pro běžného uživatele
 * v exportu nemají informační hodnotu; koš má vlastní samostatný pohled). Nejde o
 * bezpečnostní hranici (to musí hlídat API resource), jen o to, aby export nebyl
 * zahlcený technickým šumem.
 */
const DEFAULT_EXPORT_EXCLUDED_KEYS = [
  'user_password_hash',
  'user_password_salt',
  'password',
  'password_hash',
  'is_deleted',
  'deleted_at',
];

/**
 * @description Klíče, které se REDAKUJÍ (nahradí `'••••••••'`), kdykoliv se objeví
 * UVNITŘ vnořeného JSON objektu/pole exportovaného jako "extra pole" (viz
 * `getExportValueForKey()`) - typicky auditní `context_data`/payload sloupce u logů,
 * které mohou obsahovat 2FA kódy, přihlašovací tokeny apod. Na rozdíl od
 * `DEFAULT_EXPORT_EXCLUDED_KEYS` (celé TOP-LEVEL pole pryč) tohle redaguje jen KONKRÉTNÍ
 * klíč UVNITŘ objektu, zbytek payloadu zůstává čitelný a užitečný pro audit.
 * @bugfix-note (2026-08-18v4) Přidáno po zjištění, že `context_data` u
 * `login_success`/`login_2fa_challenge_sent` obsahuje `login_token` a `code` (2FA
 * ověřovací kód) v čitelném tvaru - export do souboru bez ochrany by tak z auditního
 * logu udělal cestu k úniku aktivních přihlašovacích tokenů/OTP kódů.
 * @note KOMPROMIS: `code` je poměrně obecný název a teoreticky by mohl kolidovat s
 * legitimním business polem (např. slevový/produktový kód) v JSON payloadu JINÉ
 * entity než auth logy. Prioritou je zabránit úniku citlivých autentizačních údajů;
 * pokud by tahle redakce v budoucnu způsobila false-positive u jiné tabulky, lze
 * seznam zúžit/rozšířit o kontext (např. jen uvnitř `context_data` konkrétního modulu).
 */
const SENSITIVE_JSON_KEYS = new Set([
  'password',
  'password_hash',
  'password_confirmation',
  'token',
  'access_token',
  'refresh_token',
  'login_token',
  'secret',
  'api_key',
  'api_secret',
  'otp',
  'code',
  'pin',
  'authorization',
]);

/**
 * @description Renders a dynamic data table with support for pagination, sorting, filtering,
 * custom action buttons, bulk row selection with bulk delete, and multi-format export.
 * @usage Used across various admin modules to display entities like products, users, or orders.
 * @note Implements OnPush change detection and a processing map to prevent duplicate API
 * requests during user interaction.
 */
@Component({
  selector: 'app-table-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, ExportPopupBuilderComponent],
  templateUrl: './table-builder.component.html',
  styleUrls: ['../table-style.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableBuilderComponent implements OnDestroy, OnChanges {
  @Input() data: any[] = [];
  @Input('columns') columnDefinitions: ColumnDefinition[] = [];
  @Input() inputDefinitions: InputDefinition[] = [];
  @Input() tableCaption?: string;
  @Input() apiEndpoint: string = '';
  @Input() uploadsBaseUrl: string = '';
  @Input() buttons: TableButtons[] = [];
  @Input() isAdminTable: boolean = false;
  @Input() isFullWidth: boolean = true;
  @Input() currentFilters: any = {};

  /**
   * @description Doplňkové klíče k vynechání z exportu, nad rámec
   * `DEFAULT_EXPORT_EXCLUDED_KEYS` - pro pole, která jsou technická/nezajímavá/citlivá
   * jen na konkrétní stránce (např. `permissions` u administrátorů - desítky klíčů,
   * které nemá smysl v exportu vidět, nebo interní vazební ID), ne globálně napříč
   * celou appkou. ZERO-TOUCH pro stránky, které tenhle problém nemají - default `[]`
   * znamená beze změny; binding se přidává jen na těch pár stránkách, kde je to
   * relevantní, ne plošně napříč celým adminem.
   */
  @Input() excludeFromExport: string[] = [];

  /**
   * @description JEDINÝ zdroj sloupců, které export smí nabídnout jako checkbox -
   * `columnDefinitions` (tabulka) do exportu VŮBEC NEZASAHUJE, ani na určení, co se
   * nabídne, ani na formátování hodnot. Typicky stejné pole, jaké stránka předává do
   * `[itemDetailColumns]` na `app-details-builder` (`Core.ItemDetailsColumns[]`) - typ
   * je zde záměrně minimální (`key`/`displayName`/volitelně `type`/`format`), aby
   * `TableBuilderComponent` nemusel importovat konkrétní interface. `type`/`format` se
   * použijí pro formátování hodnoty v exportu (zatím jen `type: 'date'` - viz
   * `getExportValueForKey()`); ostatní typy se exportují jako syrová/best-effort
   * hodnota. Default `[]` = stránka žádná pole v exportu nenabízí.
   * @bugfix-note (2026-08-18v8) DŘÍV se checkbox seznam skládal ze DVOU zdrojů -
   * `columnDefinitions` (sloupce tabulky) PLUS `detailsColumns` (pole navíc), s
   * dodatečnou normalizací tečkových cest, aby se předešlo duplicitám (`roles` vs.
   * `roles.0.role_name`). Zjednodušeno na JEDINÝ zdroj - `detailsColumns` - aby tabulka
   * do exportu nezasahovala vůbec, ne jen "aby se sloupce nepotkaly duplicitně". Stránka,
   * která `detailsColumns` nepředá, tak nemá v exportu ŽÁDNÁ pole (ani ta z tabulky) -
   * je nutné binding vždy přidat, pokud má export na dané stránce něco obsahovat.
   */
  @Input() detailsColumns: { key: string; displayName: string; type?: string; format?: string }[] = [];

  /**
   * @description Kdy naposledy proběhlo úspěšné načtení dat této tabulky (ze sítě
   * nebo z čerstvé TTL cache) - zobrazuje se v toolbaru jako "Aktualizováno v HH:MM:SS".
   * Předává rodičovská stránka přes `PaginatedListStore.activeLastUpdatedAt`/
   * `trashLastUpdatedAt` (viz BaseDataComponent pass-through gettery).
   */
  @Input() lastUpdatedAt: Date | null = null;

  @Output() itemDeleted = new EventEmitter<any>();
  @Output() createFormOpened = new EventEmitter<void>();
  @Output() editFormOpened = new EventEmitter<any>();
  @Output() viewDetailsOpened = new EventEmitter<any>();
  @Output() generateFormOpened = new EventEmitter<any>();
  @Output() resetPasswordFormOpened = new EventEmitter<any>();
  @Output() openImagesModal = new EventEmitter<any>();
  @Output() openVariantsModal = new EventEmitter<any>();
  @Output() customerOrdersOpened = new EventEmitter<any>();

  /**
   * @description Emitováno kliknutím na "Aktualizovat" v toolbaru téhle tabulky.
   * Rodičovská stránka na to naváže voláním `forceFullRefresh(this.filters)`
   * (BaseDataComponent) - tvrdý refresh, obchází TTL cache.
   */
  @Output() refreshRequested = new EventEmitter<void>();

  web_logs_endpoint: string = 'web/logs';

  /** Řídí viditelnost popupu pro výběr exportního formátu (otevírá `exportToCSV()`). */
  showExportPopup = false;
  /** Blokuje popup a zobrazuje spinner po dobu stahování/generování souboru. */
  isExporting = false;
  /**
   * @description Když true, `handleExportFormatSelected()` exportuje jen vybrané řádky
   * (`this.data` filtrované na `selectedIds`) místo nového fetch celého datasetu -
   * nastaveno `onBulkExportClick()`, resetováno při zavření/dokončení popupu. Viz
   * refactor-note (2026-08-16v2) v hlavičce souboru.
   */
  exportSelectedOnly = false;

  // ── Hromadný výběr / hromadné mazání ─────────────────────────────────────
  /** ID vybraných řádků NA AKTUÁLNĚ ZOBRAZENÉ STRÁNCE - resetuje se při změně `data`. */
  selectedIds = new Set<any>();
  /** Otevřený/zavřený stav dropdown menu "Akce" v bulk-actions liště. */
  showBulkMenu = false;
  /** Blokuje opětovné spuštění hromadného mazání, dokud první běh neskončí. */
  bulkDeleting = false;

  public alertDialogService = inject(AlertDialogService);
  public authService = inject(AuthService);
  public permissionService = inject(PermissionService);

  private processingItemIds = new Set<any>();
  private destroy$ = new Subject<void>();

  private _crud?: EntityCrudService<any>;
  private _logCrud?: EntityCrudService<any>;

  /** CRUD pro řádky tabulky (aktuální `apiEndpoint`, lazy — @Input se může měnit). */
  private get crud(): EntityCrudService<any> {
    if (!this._crud) {
      this._crud = new EntityCrudService<any>(
        this.dataHandler, () => this.apiEndpoint, this.destroy$, () => this.cd.markForCheck()
      );
    }
    return this._crud;
  }

  /** Samostatná instance pro log endpoint — jiný cíl než `apiEndpoint`. */
  private get logCrud(): EntityCrudService<any> {
    if (!this._logCrud) {
      this._logCrud = new EntityCrudService<any>(
        this.dataHandler, () => this.web_logs_endpoint, this.destroy$
      );
    }
    return this._logCrud;
  }

  constructor(
    private dataHandler: DataHandler,
    private cd: ChangeDetectorRef,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  /**
   * @description Resetuje hromadný výběr při každé změně `data` (nová stránka, nové
   * filtry, refresh) - `selectedIds` drží ID jen z aktuálně zobrazené stránky, takže po
   * jejich výměně by staré ID stejně nic neznamenaly (a mohla by nastat záměna s ID na
   * nové stránce, kdyby se náhodou shodovala se starým výběrem).
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.selectedIds.clear();
      this.showBulkMenu = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Zavře dropdown menu "Akce" při kliknutí kamkoliv mimo něj. Samotné
   * kliknutí NA tlačítko/položky menu si stopne propagaci (viz šablona), takže sem
   * tenhle listener nedorazí a menu se předčasně nezavře hned po otevření.
   */
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showBulkMenu) {
      this.showBulkMenu = false;
      this.cd.markForCheck();
    }
  }

  /**
   * @description Resolves cell value based on column configuration and type, applying necessary
   * pipes (currency, date, boolean).
   */
  getCellValue(item: any, column: ColumnDefinition): any {
    const keys = column.key.split('.');
    const value = keys.reduce((obj, key) => obj?.[key], item);

    switch (column.type) {
      case 'currency': {
        if (value === undefined || value === null || value === '') return '';
        const currency = column.currencyCode ? column.currencyCode.toUpperCase() : 'EUR';
        const locale = 'cs-CZ';
        try {
          return (new CurrencyPipe(locale)).transform(value, currency, 'symbol-narrow', '1.2-2');
        } catch (e) {
          return `${value} ${currency}`;
        }
      }
      case 'date':
        return value ? (new DatePipe('cs-CZ')).transform(value, column.format || 'd.M.yyyy') : '';
      case 'boolean':
        return (value == true || value === 'true' || value == 1) ? 'Yes' : 'No';
      case 'image':
        return value ? `${this.uploadsBaseUrl}${value}` : '';
      default:
        const fieldDef = this.inputDefinitions.find(i => i.column_name === column.key);
        if (fieldDef?.options) {
          const option = fieldDef.options.find(opt => String(opt.value) === String(value));
          return option ? option.label : value;
        }
        return value;
    }
  }

  /**
   * @description Determines whether a row action button should render, based on its
   * optional `TableButtons.permission` field. Supports OR syntax ('klic1|klic2'), same
   * as the *appHasPermission directive and the backend CheckPermission middleware -
   * buttons without a `permission` set stay visible whenever `isActive` is true
   * (backwards compatible with existing button configs that don't define it yet).
   * @param button The row action button configuration to check.
   */
  isButtonVisible(button: TableButtons): boolean {
    if (!button.permission) return true;
    return button.permission.split('|').some(p => this.permissionService.hasPermission(p));
  }

  /**
   * @description Routes button actions to the corresponding event emitters.
   */
  handleAction(item: any, buttonAction: string): void {
    if (this.processingItemIds.has(item.id)) {
      console.warn(`Action for item ID ${item.id} is already in progress.`);
      return;
    }

    this.processingItemIds.add(item.id);

    setTimeout(() => {
      try {
        switch (buttonAction) {
          case 'generate_form': this.generateFormOpened.emit(item); break;
          case 'details': this.viewDetailsOpened.emit(item); break;
          case 'edit': this.editFormOpened.emit(item); break;
          case 'delete': this.onDeleteAction(item); break;
          case 'password_reset': this.resetPasswordFormOpened.emit(item); break;
          case 'custom_prod_var': this.openVariantsModal.emit(item); break;
          case 'custom_prod_img': this.openImagesModal.emit(item); break;
          case 'customer_orders': this.customerOrdersOpened.emit(item); break;
          default: console.warn('Unknown action type:', buttonAction);
        }
        this.cd.markForCheck();
      } finally {
        setTimeout(() => { this.processingItemIds.delete(item.id); }, 500);
      }
    }, 0);
  }

  /**
   * @description Triggers a confirmation dialog before proceeding with item deletion.
   */
  public onDeleteAction(item: any): void {
    this.confirmDialogService.open('Delete Confirmation', 'Are you sure you want to delete this item?')
      .then(result => {
        if (result) {
          this.crud.remove(item.id).subscribe({
            next: () => {
              this.removeItemFromLocal(item.id);
              this.selectedIds.delete(item.id);
              this.itemDeleted.emit(item);
              this.alertDialogService.open('Success', 'Item deleted.', 'success');
            },
            error: () => {
              this.processingItemIds.delete(item.id);
              this.alertDialogService.open('Error', 'Deletion failed.', 'danger');
            }
          });
        } else {
          this.processingItemIds.delete(item.id);
        }
      })
      .catch(() => { this.processingItemIds.delete(item.id); });
  }

  private removeItemFromLocal(id: any): void {
    const index = this.data.findIndex(d => d.id === id);
    if (index > -1) {
      this.data.splice(index, 1);
      this.cd.markForCheck();
    }
  }

  // ── Hromadný výběr / hromadné mazání / hromadný export ───────────────────

  /**
   * @description Jestli má tabulka vůbec dostat sloupec s výběrovými checkboxy - VŽDY
   * true. Sloupec slouží primárně "Exportovat vybrané", které je dostupné komukoliv, kdo
   * tabulku vůbec vidí (view permission už prokázal tím, že se `data` vůbec načetla -
   * export nečte nic navíc, jen formátuje už načtené řádky). "Smazat vybrané" v
   * dropdownu se řídí samostatně `canBulkDelete` - u tabulek bez `delete_button`
   * (např. logy, které backend vůbec nedovoluje mazat) se v menu prostě nezobrazí.
   */
  get canBulkSelect(): boolean {
    return true;
  }

  /**
   * @description Jestli je pro tuto tabulku dostupné i hromadné MAZÁNÍ - pouze pokud
   * `buttons` obsahuje aktivní `delete_button`, na který má přihlášený uživatel právo
   * (sdílí `isButtonVisible()` s řádkovým tlačítkem Smazat - žádný nový permission
   * klíč). Tabulky bez mazání (logy a další čistě auditní/read-only přehledy) tak v
   * dropdownu dostanou jen "Exportovat vybrané", bez "Smazat vybrané" - konzistentní s
   * tím, že by na to API stejně nemělo povolenou route.
   */
  get canBulkDelete(): boolean {
    const deleteBtn = this.buttons?.find(b => b.type === 'delete_button' && b.isActive);
    return !!deleteBtn && this.isButtonVisible(deleteBtn);
  }

  /**
   * @description ID řádků na aktuální stránce, které je vůbec možné vybrat - vylučuje
   * vlastní účet v `isAdminTable` (stejná podmínka jako `[disabled]` na řádkovém
   * tlačítku Smazat), aby "vybrat vše" nezaškrtlo i nesmazatelný řádek. Aplikuje se i
   * na tabulkách bez mazání (kde `isAdminTable` bývá `false`, takže je to no-op) -
   * jedna sdílená definice "vybratelnosti" pro export i mazání.
   */
  get selectableIds(): any[] {
    return (this.data || [])
      .filter(item => !(this.isAdminTable && item.id == this.authService.getUserId()))
      .map(item => item.id);
  }

  isSelected(id: any): boolean {
    return this.selectedIds.has(id);
  }

  /** @description Pro `[disabled]` na řádkovém checkboxu - stejné pravidlo jako u Smazat tlačítka. */
  isSelectionDisabled(item: any): boolean {
    return this.isAdminTable && item.id == this.authService.getUserId();
  }

  toggleSelection(id: any, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
    this.cd.markForCheck();
  }

  /** @description Hlavičkový checkbox je zaškrtnutý, jen když jsou vybrané ÚPLNĚ všechny vybratelné řádky na stránce. */
  get isAllOnPageSelected(): boolean {
    const ids = this.selectableIds;
    return ids.length > 0 && ids.every(id => this.selectedIds.has(id));
  }

  /** @description "Indeterminate" (vodorovná čárka) stav hlavičkového checkboxu - část, ale ne všechny řádky vybrané. */
  get isSomeOnPageSelected(): boolean {
    if (this.isAllOnPageSelected) return false;
    return this.selectableIds.some(id => this.selectedIds.has(id));
  }

  toggleSelectAllOnPage(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const ids = this.selectableIds;
    if (checked) {
      ids.forEach(id => this.selectedIds.add(id));
    } else {
      ids.forEach(id => this.selectedIds.delete(id));
    }
    this.cd.markForCheck();
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.showBulkMenu = false;
    this.cd.markForCheck();
  }

  /**
   * @description Přepne dropdown "Akce" - `stopPropagation()` v šabloně zabrání tomu,
   * aby tenhle klik zároveň spustil `onDocumentClick()` a menu hned zase zavřel.
   */
  toggleBulkMenu(): void {
    this.showBulkMenu = !this.showBulkMenu;
    this.cd.markForCheck();
  }

  /**
   * @description Hromadně smaže všechny vybrané řádky. NENÍ jeden hromadný request -
   * spustí `crud.remove(id)` PRO KAŽDÉ vybrané ID paralelně (`Promise.allSettled`),
   * takže backend vyhodnotí oprávnění/byznys pravidla pro každý záznam samostatně
   * (stejně jako by to udělal řádkový Smazat po jednom). Částečné selhání (např. mezi
   * vybranými je cizí sysadmin účet, který backend odmítne smazat) se promítne do
   * souhrnné hlášky - úspěšně smazané řádky se z lokálních dat i výběru odstraní vždy,
   * i když se část requestů nezdařila.
   */
  async onBulkDeleteClick(): Promise<void> {
    if (!this.canBulkDelete || this.selectedIds.size === 0 || this.bulkDeleting) return;
    this.showBulkMenu = false;

    const count = this.selectedIds.size;
    const confirmed = await this.confirmDialogService.open(
      'Smazat vybrané záznamy',
      `Opravdu chcete smazat ${count} vybraných záznamů? Tuto akci nelze vzít zpět.`
    );
    if (!confirmed) return;

    const ids = Array.from(this.selectedIds);
    this.bulkDeleting = true;
    this.cd.markForCheck();

    const results = await Promise.allSettled(
      ids.map(id => firstValueFrom(this.crud.remove(id)))
    );

    const succeededIds: any[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        succeededIds.push(ids[i]);
      }
    });
    const failedCount = ids.length - succeededIds.length;

    succeededIds.forEach(id => {
      this.removeItemFromLocal(id);
      this.selectedIds.delete(id);
    });

    this.bulkDeleting = false;

    if (failedCount === 0) {
      this.alertDialogService.open('Úspěch', `Smazáno ${succeededIds.length} záznamů.`, 'success');
    } else if (succeededIds.length === 0) {
      this.alertDialogService.open('Chyba', `Nepodařilo se smazat žádný z ${count} vybraných záznamů.`, 'danger');
    } else {
      this.alertDialogService.open(
        'Částečný úspěch',
        `Smazáno ${succeededIds.length} z ${count} záznamů. ${failedCount} se nepodařilo smazat (nedostatečné oprávnění nebo chráněný záznam).`,
        'warning'
      );
    }

    if (succeededIds.length > 0) {
      // Existující konzumenti (`(itemDeleted)="handleItemDeleted()"`) argument
      // ignorují a jen volají refreshData() - reuse stejného eventu tak nevyžaduje
      // žádnou úpravu HTML na jiných stránkách, které TableBuilderComponent používají.
      this.itemDeleted.emit(succeededIds);
    }

    this.cd.markForCheck();
  }

  /**
   * @description Otevře formátový export popup v REŽIMU "jen vybrané" - viz
   * refactor-note (2026-08-16v2) v hlavičce souboru. Žádný nový fetch se nespouští, jen
   * se nastaví `exportSelectedOnly`, které `handleExportFormatSelected()` respektuje.
   */
  onBulkExportClick(): void {
    if (this.selectedIds.size === 0) return;
    this.showBulkMenu = false;
    this.exportSelectedOnly = true;
    this.exportableColumnOptions = this.computeExportableColumnOptions();
    this.showExportPopup = true;
    this.cd.markForCheck();
  }

  /**
   * @description Emits a refresh request for this specific table. The parent page is
   * expected to respond by calling `forceFullRefresh()` (BaseDataComponent), which
   * bypasses the GenericTableService TTL cache and forces a real network fetch.
   */
  onRefreshClick(): void {
    this.refreshRequested.emit();
  }

  /**
   * @description Opens the export-format picker popup instead of downloading immediately.
   * @note Kept the historic method name `exportToCSV()` intact (rather than renaming it)
   * so every page component that calls `this.activeTable.exportToCSV()` from its toolbar
   * action keeps working unchanged.
   */
  exportToCSV(): void {
    this.exportSelectedOnly = false;
    this.exportableColumnOptions = this.computeExportableColumnOptions();
    this.showExportPopup = true;
    this.cd.markForCheck();
  }

  /**
   * @description Closes the export popup. No-op while a file is actively being generated,
   * so an accidental click can't leave `isExporting` in an inconsistent state.
   */
  closeExportPopup(): void {
    if (this.isExporting) return;
    this.showExportPopup = false;
    this.exportSelectedOnly = false;
    this.cd.markForCheck();
  }

  /**
   * @description Columns the admin may choose to include/exclude from the export,
   * shown as checkboxes in `ExportPopupBuilderComponent`. Built from `columnDefinitions`
   * filtered to `exportable !== false` (see `ColumnDefinition.exportable`) - columns
   * explicitly marked `exportable: false` (passwords, permission-key dumps, etc.) never
   * appear here, so the admin has no way to accidentally re-enable them. Empty array
   * (e.g. a table whose columns never opt out of export) means the popup renders no
   * column picker at all and export behaves exactly as before this feature.
   * @bugfix-note (2026-08-18) KRITICKÝ BUG - VÝBĚR SLOUPCŮ SE IGNOROVAL PŘI EXPORTU:
   * tohle bývalo GETTER (`get exportableColumnOptions()`), vyhodnocovaný Angularem PŘI
   * KAŽDÉM change detection průchodu (protože je bindovaný v šabloně jako `[columns]`).
   * `.filter().map()` pokaždé vrátil NOVOU INSTANCI pole - stejný obsah, jiná reference.
   * Jenže i jediná interakce UVNITŘ `ExportPopupBuilderComponent` (zaškrtnutí checkboxu)
   * spustí CD tick, který kvůli OnPush "dirty" propagaci nahoru přes rodiče přepočítal
   * i tenhle getter zde - `ExportPopupBuilderComponent.columns` Input tak dostal PŘI
   * KAŽDÉM KLIKU novou referenci pole, Angular to vyhodnotil jako změněný Input a
   * zavolal `ngOnChanges` na popupu, který (viz refactor-note tamtéž) NEPODMÍNĚNĚ
   * resetoval uživatelský výběr zpátky na "vše zaškrtnuto" - fakticky ihned po každém
   * kliknutí, ještě předtím, než uživatel stihl zvolit formát. Výsledkem byl vždy export
   * úplně všech sloupců bez ohledu na to, co bylo (dočasně) odškrtnuté.
   *
   * Oprava: `exportableColumnOptions` je teď PLAIN PROPERTY (ne getter), počítaná
   * VÝSLOVNĚ JEN JEDNOU - při otevření popupu (`exportToCSV()`/`onBulkExportClick()`,
   * přes `computeExportableColumnOptions()`). Po celou dobu, co je popup otevřený, tak
   * `columns` Input drží STABILNÍ referenci - žádný další CD průchod ji nemění, takže
   * `ngOnChanges` na popupu se po prvním otevření znovu nespustí a uživatelský výběr
   * přežije až do kliknutí na formát. Doplněna i druhá vrstva ochrany přímo v
   * `ExportPopupBuilderComponent.ngOnChanges()` (reset jen při reálné změně OBSAHU
   * klíčů, ne pouhé reference) pro případ, že by se podobný vzor objevil jinde.
   */
  exportableColumnOptions: ExportColumnOption[] = [];

  /**
   * @description Vypočítá aktuální seznam exportovatelných sloupců VÝHRADNĚ z
   * `detailsColumns` - `columnDefinitions` (tabulka) do toho nijak nezasahuje, viz
   * `detailsColumns` bugfix-note. Volá se výslovně při otevření export popupu, ne
   * automaticky při každé změně detekci.
   */
  private computeExportableColumnOptions(): ExportColumnOption[] {
    const excludedKeys = new Set([...DEFAULT_EXPORT_EXCLUDED_KEYS, ...this.excludeFromExport]);

    return this.detailsColumns
      .filter(col => !excludedKeys.has(col.key))
      .map(col => ({ key: col.key, label: col.displayName || col.key }));
  }

  /**
   * @description Resolves the dataset to export - either a full, freshly-fetched
   * unpaginated dataset (`loadDataAsCollection()`, default behaviour), or - when
   * `exportSelectedOnly` is set (bulk "Exportovat vybrané") - just the currently
   * selected rows taken directly from `this.data` (no network request, no new
   * endpoint). See refactor-note (2026-08-16v2) in the file header.
   */
  private async resolveExportData(): Promise<any[]> {
    if (this.exportSelectedOnly) {
      return (this.data || []).filter(item => this.selectedIds.has(item.id));
    }
    const responseData = await firstValueFrom(this.loadDataAsCollection());
    return Array.isArray(responseData) ? responseData : [];
  }

  /**
   * @description Builds and downloads the file in the chosen format, from either the
   * full dataset or just the selected rows (see `resolveExportData()`), restricted to
   * the columns the admin left checked in the popup.
   * @param selection Format + column selection chosen by the user in
   * `ExportPopupBuilderComponent` - `columnKeys: null` means no column restriction
   * (either the popup had no `exportable` columns to offer, or that concept simply
   * doesn't apply - see `buildExportRows()`).
   */
  async handleExportFormatSelected(selection: ExportSelection): Promise<void> {
    if (this.isExporting) return;
    this.isExporting = true;
    this.cd.markForCheck();

    const selectedOnly = this.exportSelectedOnly;
    const { format, columnKeys } = selection;

    try {
      const allData = await this.resolveExportData();

      if (allData.length === 0) {
        this.alertDialogService.open('Export', 'No data available for export.', 'warning');
        return;
      }

      const rows = this.buildExportRows(allData, columnKeys);
      const baseFilename = this.tableCaption || 'export';
      const filename = selectedOnly ? `${baseFilename}-vybrane` : baseFilename;

      switch (format) {
        case 'csv':  this.downloadCsv(rows, filename); break;
        case 'xlsx': await this.downloadXlsx(rows, filename); break;
        case 'json': this.downloadJson(rows, filename); break;
        case 'txt':  this.downloadTxt(rows, filename); break;
      }

      this.logExportActivity(allData.length, format, selectedOnly);
    } catch (error) {
      console.error('Export error:', error);
      this.alertDialogService.open('Error', 'An error occurred during export.', 'danger');
    } finally {
      this.isExporting = false;
      this.showExportPopup = false;
      this.exportSelectedOnly = false;
      this.cd.markForCheck();
    }
  }

  /**
   * @description Maps raw records to plain header->formatted-value objects. Exportuje
   * VÝHRADNĚ pole z `detailsColumns` - `columnDefinitions` (tabulka) do toho nijak
   * nezasahuje, viz `detailsColumns` bugfix-note. Formátování hodnot řeší
   * `getExportValueForKey()`.
   * @param data Raw records fetched from the API (unpaginated).
   * @param selectedColumnKeys Klíče polí, které admin nechal zaškrtnuté v popupu, nebo
   * `null` pro "bez omezení" (export všech `detailsColumns`).
   * @returns Array of plain objects keyed by header label, ready for any format builder.
   */
  private buildExportRows(data: any[], selectedColumnKeys: string[] | null = null): Record<string, any>[] {
    const excludedKeys = new Set([...DEFAULT_EXPORT_EXCLUDED_KEYS, ...this.excludeFromExport]);

    const exportColumns = this.detailsColumns
      .filter(col => !excludedKeys.has(col.key))
      .filter(col => selectedColumnKeys === null || selectedColumnKeys.includes(col.key));

    return data.map(item => {
      const row: Record<string, any> = {};
      exportColumns.forEach(col => {
        row[col.displayName || col.key] = this.getExportValueForKey(item, col);
      });
      return row;
    });
  }

  /**
   * @description Best-effort formátování hodnoty pole z `detailsColumns`. Podporuje
   * tečkové cesty (`roles.0.role_name`). Priorita formátování: (1) `InputDefinition`
   * podle `column_name` (checkbox -> syrový `'true'`/`'false'` string, ne lokalizované
   * "Yes"/"No" - jde o pole mimo přehled, kde je přesná strojově čitelná hodnota
   * žádanější; select -> label z options), (2) `detailCol.type === 'date'` -> formát
   * datem přes `DatePipe` (`detailCol.format`, default `'d.M.yyyy'`), (3) objekty/pole
   * (např. `context_data` payload u logů) se serializují do JSON stringu - PŘED
   * serializací projdou `redactSensitiveJson()`, aby citlivé klíče (2FA kódy, tokeny
   * apod. - viz `SENSITIVE_JSON_KEYS`) skryté uvnitř payloadu neunikly do exportu,
   * (4) syrová hodnota.
   */
  private getExportValueForKey(item: any, detailCol: { key: string; type?: string; format?: string }): any {
    const keys = detailCol.key.split('.');
    const value = keys.reduce((obj, k) => obj?.[k], item);
    if (value === null || value === undefined) return '';

    const inputDef = this.inputDefinitions.find(i => i.column_name === detailCol.key);
    if (inputDef?.type === 'checkbox') {
      return (value === true || value === 'true' || value == 1) ? 'true' : 'false';
    }
    if (inputDef?.options) {
      const option = inputDef.options.find(opt => String(opt.value) === String(value));
      if (option) return option.label;
    }

    if (detailCol.type === 'date') {
      try {
        return (new DatePipe('cs-CZ')).transform(value, detailCol.format || 'd.M.yyyy') ?? String(value);
      } catch {
        return String(value);
      }
    }

    if (typeof value === 'object') {
      try { return JSON.stringify(this.redactSensitiveJson(value)); } catch { return String(value); }
    }
    return value;
  }

  /**
   * @description Rekurzivně projde objekt/pole a nahradí hodnotu jakéhokoliv klíče
   * uvedeného v `SENSITIVE_JSON_KEYS` (case-insensitive) placeholderem `'••••••••'`.
   * Zbytek payloadu zůstává nedotčený a čitelný - jde o cílenou redakci konkrétních
   * klíčů, ne o skrytí celého pole (to řeší `DEFAULT_EXPORT_EXCLUDED_KEYS`/
   * `excludeFromExport` na úrovni celých top-level polí).
   */
  private redactSensitiveJson(value: any): any {
    if (Array.isArray(value)) {
      return value.map(v => this.redactSensitiveJson(v));
    }
    if (value && typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = SENSITIVE_JSON_KEYS.has(k.toLowerCase())
          ? '••••••••'
          : this.redactSensitiveJson(v);
      }
      return result;
    }
    return value;
  }

  /**
   * @description Sjednocené hlavičky přes VŠECHNY řádky (ne jen `rows[0]`) - jednotlivé
   * záznamy mohou mít mírně odlišnou sadu klíčů, takže brát hlavičky jen z prvního řádku
   * by mohlo některé sloupce v CSV/TXT/XLSX vynechat.
   */
  private getAllHeaders(rows: Record<string, any>[]): string[] {
    const headers = new Set<string>();
    rows.forEach(row => Object.keys(row).forEach(h => headers.add(h)));
    return Array.from(headers);
  }

  /**
   * @description Creates a temporary object URL for the given blob, triggers a browser
   * download via a synthetic anchor click, then revokes the URL to avoid leaking memory.
   */
  private triggerDownload(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private downloadCsv(rows: Record<string, any>[], filename: string): void {
    const headers = this.getAllHeaders(rows);
    let csv = headers.join(';') + '\n';
    rows.forEach(row => {
      csv += headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(';') + '\n';
    });
    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
  }

  private downloadTxt(rows: Record<string, any>[], filename: string): void {
    const headers = this.getAllHeaders(rows);
    let txt = headers.join('\t') + '\n';
    rows.forEach(row => {
      txt += headers.map(h => String(row[h] ?? '')).join('\t') + '\n';
    });
    this.triggerDownload(new Blob([txt], { type: 'text/plain;charset=utf-8;' }), `${filename}.txt`);
  }

  private downloadJson(rows: Record<string, any>[], filename: string): void {
    const json = JSON.stringify(rows, null, 2);
    this.triggerDownload(new Blob([json], { type: 'application/json;charset=utf-8;' }), `${filename}.json`);
  }

  /**
   * @description Lazy-loads SheetJS (`xlsx` package) so the (fairly heavy, ~700kB) bundle
   * only downloads for admins who actually export XLSX, not on every page that happens to
   * render a table. `header` je předán explicitně (sjednocené přes všechny řádky), ať
   * SheetJS nevezme sloupce jen z prvního záznamu.
   */
  private async downloadXlsx(rows: Record<string, any>[], filename: string): Promise<void> {
    const XLSX = await import('xlsx');
    const headers = this.getAllHeaders(rows);
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }

  /**
   * @description Fetches all data (ignoring pagination) for export - shared by every
   * format builder above.
   */
  private loadDataAsCollection() {
    const params = { ...this.currentFilters, no_pagination: 'true' };
    if (!params.sort_by) params.sort_by = 'id';
    if (!params.sort_direction) params.sort_direction = 'desc';
    return this.dataHandler.getCollection<any>(this.apiEndpoint, params);
  }

  /**
   * @description Logs the export action to `web_logs` - `event_type` carries the chosen
   * format (`export_csv`/`export_xlsx`/`export_json`/`export_txt`) instead of a single
   * generic `DATA_EXPORT`, so the audit trail shows exactly what was downloaded.
   * @param selectedOnly Whether this export came from bulk "Exportovat vybrané" rather
   * than the toolbar's full-dataset export - reflected in the log description so the
   * audit trail distinguishes "exported everything" from "exported N selected rows".
   */
  private logExportActivity(rowCount: number, format: ExportFormat, selectedOnly: boolean = false): void {
    const logData = {
      event_type: `export_${format}`,
      module: this.apiEndpoint,
      description: `User exported ${rowCount}${selectedOnly ? ' selected' : ''} records (${format.toUpperCase()}) from table: ${this.tableCaption || this.apiEndpoint}.`,
      affected_entity_type: 'collection',
      user_id_plain: this.authService.getUserId()?.toString(),
      user_plain: this.authService.getUserEmail()
    };
    this.logCrud.create(logData).subscribe({
      error: (err) => console.error('Failed to log export:', err)
    });
  }

  /**
   * @description Calculates the total number of columns including the bulk-select
   * checkbox column (if shown - viz `canBulkSelect`, teď vždy true) and action buttons
   * for the table layout. Počítá jen tlačítka, která jsou zároveň `isActive` I viditelná
   * podle `isButtonVisible()` - jinak by hlavička měla jiný počet sloupců než reálně
   * vykreslené řádky, kdykoliv je nějaké tlačítko permission schované.
   */
  get colspanValue(): number {
    const checkboxColumn = this.canBulkSelect ? 1 : 0;
    return checkboxColumn + this.columnDefinitions.length + (this.buttons?.filter(b => b.isActive && this.isButtonVisible(b)).length || 0);
  }
}