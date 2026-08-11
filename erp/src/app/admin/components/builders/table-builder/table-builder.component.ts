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
 * @dependencies
 * - EntityCrudService: CRUD volání (delete řádku, POST log exportu).
 * - ConfirmDialogService: Facilitates safe delete operations.
 * - ExportPopupBuilderComponent: Formátový picker popup pro export dat.
 * - CurrencyPipe, DatePipe: Standard pipes for data formatting.
 * - xlsx (SheetJS): Lazy-loaded jen při volbě XLSX exportu, viz downloadXlsx().
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ChangeDetectorRef, OnDestroy, OnChanges, SimpleChanges, inject
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subject } from 'rxjs';

import { DataHandler } from '../../../../core/services/data-handler.service';
import { EntityCrudService } from '../../../../core/services/entitiy-crud.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ColumnDefinition } from '../../../../shared/interfaces/generic-form-column-definiton';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { ExportFormat } from '../../../../shared/interfaces/export-format';
import { ExportPopupBuilderComponent } from '../export-popup-builder/export-popup-builder.component';

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
 * @description Renders a dynamic data table with support for pagination, sorting, filtering,
 * custom action buttons, and multi-format export.
 * @usage Used across various admin modules to display entities like products, users, or orders.
 * @note Implements OnPush change detection and a processing map to prevent duplicate API
 * requests during user interaction.
 */
@Component({
  selector: 'app-table-builder',
  standalone: true,
  imports: [FormsModule, ExportPopupBuilderComponent],
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
   * `DEFAULT_EXPORT_EXCLUDED_KEYS` - pro pole, která jsou technická/nezajímavá jen na
   * konkrétní stránce (např. interní vazební ID, které nemá pro danou entitu smysl
   * exportovat), ne globálně napříč celou appkou.
   */
  @Input() excludeFromExport: string[] = [];

  @Output() itemDeleted = new EventEmitter<any>();
  @Output() createFormOpened = new EventEmitter<void>();
  @Output() editFormOpened = new EventEmitter<any>();
  @Output() viewDetailsOpened = new EventEmitter<any>();
  @Output() generateFormOpened = new EventEmitter<any>();
  @Output() resetPasswordFormOpened = new EventEmitter<any>();
  @Output() openImagesModal = new EventEmitter<any>();
  @Output() openVariantsModal = new EventEmitter<any>();
  @Output() customerOrdersOpened = new EventEmitter<any>();

  web_logs_endpoint: string = 'web/logs';

  /** Řídí viditelnost popupu pro výběr exportního formátu (otevírá `exportToCSV()`). */
  showExportPopup = false;
  /** Blokuje popup a zobrazuje spinner po dobu stahování/generování souboru. */
  isExporting = false;

  public alertDialogService = inject(AlertDialogService);
  public authService = inject(AuthService);

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

  ngOnChanges(changes: SimpleChanges): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  /**
   * @description Opens the export-format picker popup instead of downloading immediately.
   * @note Kept the historic method name `exportToCSV()` intact (rather than renaming it)
   * so every page component that calls `this.activeTable.exportToCSV()` from its toolbar
   * action keeps working unchanged.
   */
  exportToCSV(): void {
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
    this.cd.markForCheck();
  }

  /**
   * @description Fetches the full (unpaginated) dataset once, then builds and downloads
   * the file in the chosen format. Ignores current pagination by design, same as the
   * original CSV-only behaviour it replaces.
   * @param format Format chosen by the user in ExportPopupBuilderComponent.
   */
  async handleExportFormatSelected(format: ExportFormat): Promise<void> {
    if (this.isExporting) return;
    this.isExporting = true;
    this.cd.markForCheck();

    try {
      const responseData = await firstValueFrom(this.loadDataAsCollection());
      const allData: any[] = Array.isArray(responseData) ? responseData : [];

      if (allData.length === 0) {
        this.alertDialogService.open('Export', 'No data available for export.', 'warning');
        return;
      }

      const rows = this.buildExportRows(allData);
      const filename = this.tableCaption || 'export';

      switch (format) {
        case 'csv':  this.downloadCsv(rows, filename); break;
        case 'xlsx': await this.downloadXlsx(rows, filename); break;
        case 'json': this.downloadJson(rows, filename); break;
        case 'txt':  this.downloadTxt(rows, filename); break;
      }

      this.logExportActivity(allData.length, format);
    } catch (error) {
      console.error('Export error:', error);
      this.alertDialogService.open('Error', 'An error occurred during export.', 'danger');
    } finally {
      this.isExporting = false;
      this.showExportPopup = false;
      this.cd.markForCheck();
    }
  }

  /**
   * @description Maps raw records to plain header->formatted-value objects. Exportuje
   * CELÝ řádek dat z API (kromě vyloučených klíčů - viz `DEFAULT_EXPORT_EXCLUDED_KEYS`
   * a `@Input() excludeFromExport`), ne jen sloupce viditelné v tabulce. Sloupce z
   * `columnDefinitions` se formátují stejně jako dřív přes `getCellValue()`; pole navíc
   * se formátují best-effort podle odpovídající `InputDefinition`.
   * @param data Raw records fetched from the API (unpaginated).
   * @returns Array of plain objects keyed by header label, ready for any format builder.
   */
  private buildExportRows(data: any[]): Record<string, any>[] {
    const columnKeys = this.columnDefinitions.map(c => c.key);
    const excludedKeys = new Set([...DEFAULT_EXPORT_EXCLUDED_KEYS, ...this.excludeFromExport]);
    const extraKeys = this.collectExtraKeys(data, columnKeys, excludedKeys);

    return data.map(item => {
      const row: Record<string, any> = {};

      this.columnDefinitions.forEach(col => {
        if (excludedKeys.has(col.key)) return;
        row[col.header || col.key] = this.getCellValue(item, col) ?? '';
      });

      extraKeys.forEach(key => {
        row[this.getExportHeaderForKey(key)] = this.getExportValueForKey(item, key);
      });

      return row;
    });
  }

  /**
   * @description Zjistí všechny klíče přítomné v datech, které nejsou pokryté
   * `columnDefinitions` ani vyloučené (`excludedKeys`) - napříč VŠEMI záznamy (ne jen
   * prvním), pro případ, že by nějaké pole bylo `null`/chybělo jen u některých řádků.
   * Pořadí zachovává první výskyt klíče v datech.
   */
  private collectExtraKeys(data: any[], columnKeys: string[], excludedKeys: Set<string>): string[] {
    const seen = new Set<string>([...columnKeys, ...excludedKeys]);
    const ordered: string[] = [];
    data.forEach(item => {
      Object.keys(item || {}).forEach(key => {
        if (seen.has(key)) return;
        seen.add(key);
        ordered.push(key);
      });
    });
    return ordered;
  }

  /**
   * @description Hlavička sloupce navíc - použije label z odpovídající `InputDefinition`,
   * pokud existuje, jinak surový klíč z API.
   */
  private getExportHeaderForKey(key: string): string {
    const inputDef = this.inputDefinitions.find(i => i.column_name === key);
    return inputDef?.label || key;
  }

  /**
   * @description Best-effort formátování hodnoty pole navíc podle odpovídající
   * `InputDefinition`. Checkbox se exportuje jako syrový `'true'`/`'false'` string (ne
   * přeložené "Yes"/"No" jako u viditelných sloupců typu `boolean` - jde o pole mimo
   * přehled, kde je přesná strojově čitelná hodnota žádanější než lokalizovaný text).
   * Select pole dostane label z options, jinak se použije syrová hodnota; objekty/pole
   * (např. `roles` relace) se serializují do JSON stringu.
   */
  private getExportValueForKey(item: any, key: string): any {
    const value = item?.[key];
    if (value === null || value === undefined) return '';

    const inputDef = this.inputDefinitions.find(i => i.column_name === key);

    if (inputDef?.type === 'checkbox') {
      return (value === true || value === 'true' || value == 1) ? 'true' : 'false';
    }
    if (inputDef?.options) {
      const option = inputDef.options.find(opt => String(opt.value) === String(value));
      if (option) return option.label;
    }
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
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
   */
  private logExportActivity(rowCount: number, format: ExportFormat): void {
    const logData = {
      event_type: `export_${format}`,
      module: this.apiEndpoint,
      description: `User exported ${rowCount} records (${format.toUpperCase()}) from table: ${this.tableCaption || this.apiEndpoint}.`,
      affected_entity_type: 'collection',
      user_id_plain: this.authService.getUserId()?.toString(),
      user_plain: this.authService.getUserEmail()
    };
    this.logCrud.create(logData).subscribe({
      error: (err) => console.error('Failed to log export:', err)
    });
  }

  /**
   * @description Calculates the total number of columns including action buttons for the table
   * layout.
   */
  get colspanValue(): number {
    return this.columnDefinitions.length + (this.buttons?.filter(b => b.isActive).length || 0);
  }
}