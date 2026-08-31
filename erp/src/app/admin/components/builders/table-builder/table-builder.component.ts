/**
 * @file table-builder.component.ts
 * @path src/app/admin/components/builders/table-builder/table-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A generic, highly configurable table component for displaying datasets with
 * built-in CRUD actions, multi-format export (CSV/XLSX/JSON/TXT), append-only import, and
 * localized formatting.
 *
 * @refactor-note (2025) Driv dedil z BaseDataComponent kvuli deleteData() a napojeni na
 * alert/auth sluzby - data ale vzdy prichazeji pres @Input, takze paginacni/kos/cache
 * polovinu BaseDataComponent tato komponenta nikdy nepouzivala. Nyni si sklada
 * EntityCrudService primo (pro delete + log export) a alert/auth sluzby injektuje sama.
 *
 * @refactor-note (2026-08) Export prepracovan z jedineho tlacitka "Export" (okamzite
 * stazeni) na formatovy picker (ExportPopupBuilderComponent) s volbou CSV/XLSX/JSON/TXT.
 * Metoda exportToCSV() byla ZAMERNE ponechana pod stejnym jmenem - jen ted otevira popup
 * misto primeho stahovani.
 *
 * @refactor-note (2026-08-2) Export ted zahrnuje CELY radek dat z API, ne jen sloupce
 * viditelne v columnDefinitions.
 *
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTEMU: radkova akcni tlacitka
 * (Edit/Delete/...) ted respektuji volitelne TableButtons.permission pole.
 *
 * @refactor-note (2026-08-6) Pridan table-level refresh: @Input() lastUpdatedAt a
 * @Output() refreshRequested.
 *
 * @refactor-note (2026-08-16) HROMADNY VYBER + HROMADNE MAZANI. Pridan sloupec
 * checkboxu, bulk-actions-bar, dropdown "Akce".
 *
 * @refactor-note (2026-08-16v2) EXPORTOVAT VYBRANE.
 *
 * @refactor-note (2026-08-18) VYBER SLOUPCU K EXPORTU.
 *
 * @refactor-note (2026-08-18v8 - FINALNI) Export je VYHRADNE rizen detailsColumns.
 *
 * @refactor-note (2026-08-22) HROMADNY APPEND-ONLY IMPORT - viz backlog task "import dat
 * do tabulek". Pridano tlacitko "Import" do interniho toolbaru (vedle "Aktualizovat") a
 * app-import-popup-builder popup - stejny princip jako export: JEDNO misto
 * (TableBuilderComponent), zadna uprava desitek stránkovych *.component.ts/.html
 * souboru. [resource]="apiEndpoint" je jediny vstup, ktery popup potrebuje - stejny
 * string musi byt zaregistrovany v backendovem config/importable_resources.php
 * (ImportController); pokud neni, popup to sam ohlasi (404 z backendu), tlacitko
 * Import tak zustava v UI VZDY viditelne (stejne jako Export nema zadnou permission
 * podminku na urovni teto komponenty - autorizaci vynucuje vyhradne backend). Import
 * samotny (upload, dry-run validace, potvrzeni zapisu) resi kompletne
 * ImportPopupBuilderComponent - TableBuilderComponent jen otevira/zavira popup a
 * po dokonceni preda importCompleted nahoru, at si stranka muze natvrdo refreshnout
 * data (nove radky se jinak do this.data samy nepromitnou).
 *
 * @refactor-note (2026-08-24) KONSOLIDACE TOOLBAR TLAČÍTEK: vlastní tlačítko "Import"
 * ODSTRANĚNO z interního toolbaru (viz .html stejné datum) - stěhuje se do stránkového
 * "Akce" dropdownu (ActionMenuBuilderComponent), který na `importData()` deleguje přes
 * ViewChild, stejně jako už dřív dělal `exportToCSV()`. `importData()` samotná zůstává
 * beze změny (public, volaná zvenku). Nový `@Output() resendActivationOpened` - stejný
 * vzor jako `resetPasswordFormOpened`, používá administrators.component.ts pro tlačítko
 * "Aktivace" (viz refactor-note 2026-08-24v2 níže).
 *
 * @refactor-note (2026-08-24v2) BACKLOG "efektivnější tlačítko pro akci 0-1x na účet":
 * `TableButtons` může nově nést volitelné `visibleWhen: (item) => boolean` (per-řádková
 * podmínka, na rozdíl od `permission`, což je globální per-uživatel kontrola). Přidány:
 * - `isButtonVisibleForItem(button, item)` - kombinuje permission + visibleWhen pro
 *   KONKRÉTNÍ řádek, používá se u vykreslení samotného <button> v <td>.
 * - `hasAnyRowForButton(button)` - zda alespoň jeden řádek na aktuální stránce (`data`)
 *   tlačítko potřebuje; bez `visibleWhen` vždy `true` (beze změny oproti dřívějšku).
 * - `isButtonColumnVisible(button)` - kombinace permission + hasAnyRowForButton, řídí
 *   vykreslení CELÉHO sloupce (hlavička i colspanValue) - u tabulek, kde žádný řádek na
 *   aktuální stránce podmínku nesplňuje, sloupec zmizí úplně, místo aby zůstal prázdný.
 * `isButtonVisible(button)` (jen permission) zůstává BEZE ZMĚNY - používají ji ostatní
 * metody výše jako stavební kámen, žádné volající místo mimo tento soubor se nemuselo
 * upravovat.
 *
 * @dependencies
 * - EntityCrudService: CRUD volani (delete radku/hromadne delete po jednom, POST log exportu).
 * - ConfirmDialogService: Facilitates safe delete operations (single i bulk).
 * - ExportPopupBuilderComponent: Formatovy picker popup pro export dat, vcetne vyberu sloupcu.
 * - ImportPopupBuilderComponent: Append-only import popup (sablona, upload, dry-run, commit).
 * - PermissionService: Vyhodnoceni TableButtons.permission pro radkova tlacitka i
 *   viditelnost "Smazat vybrane" v dropdownu (canBulkDelete).
 * - CurrencyPipe, DatePipe: Standard pipes for data formatting.
 * - xlsx (SheetJS): Lazy-loaded jen pri volbe XLSX exportu, viz downloadXlsx().
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
import { ImportPopupBuilderComponent } from '../import-popup-builder/import-popup-builder.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
const DEFAULT_EXPORT_EXCLUDED_KEYS = [
  'user_password_hash',
  'user_password_salt',
  'password',
  'password_hash',
  'is_deleted',
  'deleted_at',
];

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

@Component({
  selector: 'app-table-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, ExportPopupBuilderComponent, ImportPopupBuilderComponent, IconComponent],
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

  @Input() excludeFromExport: string[] = [];

  @Input() detailsColumns: { key: string; displayName: string; type?: string; format?: string; importable?: boolean }[] = [];

  @Input() lastUpdatedAt: Date | null = null;

  /**
   * @description Vypne položku "Smazat vybrané" v bulk-actions dropdownu, i když má
   * tabulka aktivní `delete_button` s dostatečným oprávněním. Použito na tabulkách,
   * kde je HROMADNÉ mazání záměrně nepodporováno na backendu (chybí `bulkDestroy()`)
   * kvůli citlivé per-záznam byznys logice, kterou nelze mechanicky replikovat -
   * viz core/users (UserController, sysadmin ochrana). Jednotlivé mazání (řádkové
   * tlačítko) tímto NENÍ dotčeno.
   */
  @Input() bulkDeleteDisabled: boolean = false;

  @Output() itemDeleted = new EventEmitter<any>();
  @Output() createFormOpened = new EventEmitter<void>();
  @Output() editFormOpened = new EventEmitter<any>();
  @Output() viewDetailsOpened = new EventEmitter<any>();
  @Output() generateFormOpened = new EventEmitter<any>();
  @Output() resetPasswordFormOpened = new EventEmitter<any>();
  /**
   * @description Tlačítko "Aktivace" v řádku (viditelné jen u řádků splňujících
   * `visibleWhen`, viz administrators.config.ts) - stránka na něj napojuje
   * POST core/users/{id}/resend-activation. Stejný vzor jako ostatní *Opened eventy -
   * TableBuilderComponent jen přeposílá, žádnou byznys logiku neřeší.
   */
  @Output() resendActivationOpened = new EventEmitter<any>();
  @Output() openImagesModal = new EventEmitter<any>();
  @Output() openVariantsModal = new EventEmitter<any>();
  @Output() customerOrdersOpened = new EventEmitter<any>();

  @Output() refreshRequested = new EventEmitter<void>();

  /**
   * @description Emitovano po uspesnem dokonceni importu (synchronnim i queued) - viz
   * refactor-note (2026-08-22) v hlavicce souboru. Rodicovska stranka na to navaze
   * stejne jako u itemDeleted/refreshRequested, typicky volanim forceFullRefresh(), at
   * se nove pridane zaznamy hned zobrazi (na rozdil od mazani tahle komponenta nema
   * lokalni kopii nove vytvorenych radku - musi prijit znovu z API).
   */
  @Output() importCompleted = new EventEmitter<void>();

  web_logs_endpoint: string = 'web/logs';

  showExportPopup = false;
  isExporting = false;
  exportSelectedOnly = false;

  /** Ridi viditelnost import popupu (otevira importData()) - viz refactor-note (2026-08-22). */
  showImportPopup = false;

  selectedIds = new Set<any>();
  showBulkMenu = false;
  bulkDeleting = false;

  public alertDialogService = inject(AlertDialogService);
  public authService = inject(AuthService);
  public permissionService = inject(PermissionService);

  private processingItemIds = new Set<any>();
  private destroy$ = new Subject<void>();

  private _crud?: EntityCrudService<any>;
  private _logCrud?: EntityCrudService<any>;

  private get crud(): EntityCrudService<any> {
    if (!this._crud) {
      this._crud = new EntityCrudService<any>(
        this.dataHandler, () => this.apiEndpoint, this.destroy$, () => this.cd.markForCheck()
      );
    }
    return this._crud;
  }

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

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showBulkMenu) {
      this.showBulkMenu = false;
      this.cd.markForCheck();
    }
  }

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
   * @description Permission-only kontrola (globální, per-přihlášený-uživatel) - beze
   * změny oproti dřívějšku. Stavební kámen pro isButtonVisibleForItem()/
   * isButtonColumnVisible() níže, ale sama zůstává použitelná nezávisle.
   */
  isButtonVisible(button: TableButtons): boolean {
    if (!button.permission) return true;
    return button.permission.split('|').some(p => this.permissionService.hasPermission(p));
  }

  /**
   * @description Vyhodnotí, zda se má tlačítko zobrazit na KONKRÉTNÍM řádku - kombinuje
   * permission kontrolu (isButtonVisible) s volitelnou per-řádkovou podmínkou
   * (`button.visibleWhen`). Bez `visibleWhen` je výsledek identický s isButtonVisible().
   * Použito při vykreslení samotného <button> uvnitř <td> (viz .html).
   */
  isButtonVisibleForItem(button: TableButtons, item: any): boolean {
    if (!this.isButtonVisible(button)) return false;
    return !button.visibleWhen || button.visibleWhen(item);
  }

  /**
   * @description Zda alespoň JEDEN řádek na aktuální stránce (`this.data`) tlačítko
   * potřebuje - řídí, jestli se sloupec v hlavičce vůbec vykreslí. Bez `visibleWhen`
   * (tlačítko nemá per-řádkovou podmínku) se chová jako dřív - sloupec se ukáže vždy,
   * když projde permission kontrola, bez ohledu na obsah dat.
   */
  hasAnyRowForButton(button: TableButtons): boolean {
    if (!button.visibleWhen) return true;
    return (this.data || []).some(item => button.visibleWhen!(item));
  }

  /**
   * @description Kombinovaná podmínka pro vykreslení CELÉHO sloupce (hlavička i
   * colspanValue) - permission i "má to na téhle stránce dat vůbec smysl" zároveň.
   * Používá se v šabloně u hlavičkových buněk místo samotného isButtonVisible().
   */
  isButtonColumnVisible(button: TableButtons): boolean {
    return this.isButtonVisible(button) && this.hasAnyRowForButton(button);
  }

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
          case 'resend_activation': this.resendActivationOpened.emit(item); break;
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

  get canBulkSelect(): boolean {
    return true;
  }

  get canBulkDelete(): boolean {
  if (this.bulkDeleteDisabled) return false;
  const deleteBtn = this.buttons?.find(b => b.type === 'delete_button' && b.isActive);
  return !!deleteBtn && this.isButtonVisible(deleteBtn);
}

  get selectableIds(): any[] {
    return (this.data || [])
      .filter(item => !(this.isAdminTable && item.id == this.authService.getUserId()))
      .map(item => item.id);
  }

  isSelected(id: any): boolean {
    return this.selectedIds.has(id);
  }

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

  get isAllOnPageSelected(): boolean {
    const ids = this.selectableIds;
    return ids.length > 0 && ids.every(id => this.selectedIds.has(id));
  }

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

  toggleBulkMenu(): void {
    this.showBulkMenu = !this.showBulkMenu;
    this.cd.markForCheck();
  }

  /**
   * @description Hromadně smaže všechny vybrané řádky - JEDNÍM HTTP requestem na
   * `{apiEndpoint}/bulk-delete` (konkrétní kontrolér dané tabulky musí mít metodu
   * `bulkDestroy()` - viz šablona/recipe v dokumentaci k tomuto refactoru), ne N
   * paralelními jednotlivými DELETE voláními jako dřív.
   * @refactor-note (2026-08-23) DŘÍVE: `Promise.allSettled` nad `crud.remove(id)` pro
   * KAŽDÉ vybrané ID zvlášť. Mezikrok (zavržený): centrální `core/bulk_delete`
   * endpoint s registrem resources - zahozeno, protože bezpečně rozhodnout "smí se
   * tenhle model mazat hromadně bez byznys pravidel" zvenku (bez pohledu do
   * `destroy()` KAŽDÉHO kontroleru) nejde spolehlivě udělat. Řešení: `bulkDestroy()`
   * žije PŘÍMO v konkrétním kontroleru, vedle `destroy()` - přirozeně tak sdílí
   * stejnou byznys logiku (vlastnictví, ochrana, úklid souvisejících souborů), ne
   * generický `Model::destroy($ids)` naslepo zvenku.
   * @note Endpoint musí existovat na daném resource, jinak backend vrátí 404
   * (zachyceno v `catch` bloku níže) - tabulky, které `bulkDestroy()` ještě nemají
   * implementovaný, prostě dostanou chybovou hlášku místo tichého selhání.
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

    try {
      const res = await firstValueFrom(
        this.dataHandler.post<{ deleted_count: number; skipped_count: number; requested: number }>(
          `${this.apiEndpoint}/bulk-delete`,
          { ids }
        )
      );

      ids.forEach(id => {
        this.removeItemFromLocal(id);
        this.selectedIds.delete(id);
      });

      if (res.skipped_count === 0) {
        this.alertDialogService.open('Úspěch', `Smazáno ${res.deleted_count} záznamů.`, 'success');
      } else if (res.deleted_count === 0) {
        this.alertDialogService.open('Chyba', `Nepodařilo se smazat žádný z ${res.requested} vybraných záznamů.`, 'danger');
      } else {
        this.alertDialogService.open(
          'Částečný úspěch',
          `Smazáno ${res.deleted_count} z ${res.requested} záznamů. ${res.skipped_count} nebylo nalezeno nebo se nepodařilo smazat.`,
          'warning'
        );
      }

      this.itemDeleted.emit(ids);
    } catch (err: any) {
      const msg = err?.status === 404
        ? 'Hromadné mazání pro tuto tabulku zatím není implementováno.'
        : err?.status === 403
          ? 'Nedostatečná oprávnění k hromadnému mazání.'
          : 'Hromadné mazání se nezdařilo.';
      this.alertDialogService.open('Chyba', msg, 'danger');
    } finally {
      this.bulkDeleting = false;
      this.cd.markForCheck();
    }
  }

  onBulkExportClick(): void {
    if (this.selectedIds.size === 0) return;
    this.showBulkMenu = false;
    this.exportSelectedOnly = true;
    this.exportableColumnOptions = this.computeExportableColumnOptions();
    this.importableColumnOptions = this.computeImportableColumnOptions();
    this.showExportPopup = true;
    this.cd.markForCheck();
  }

  onRefreshClick(): void {
    this.refreshRequested.emit();
  }

  exportToCSV(): void {
    this.exportSelectedOnly = false;
    this.exportableColumnOptions = this.computeExportableColumnOptions();
    this.importableColumnOptions = this.computeImportableColumnOptions();
    this.showExportPopup = true;
    this.cd.markForCheck();
  }

  closeExportPopup(): void {
    if (this.isExporting) return;
    this.showExportPopup = false;
    this.exportSelectedOnly = false;
    this.cd.markForCheck();
  }

  exportableColumnOptions: ExportColumnOption[] = [];

  /**
   * @description Podmnožina `detailsColumns` označená `importable: true` - nabízí se
   * v export popupu jako checkbox seznam v okamžiku, kdy admin zapne "Exportovat
   * v surovém formátu" (viz refactor-note 2026-08-23). Prázdné pole = resource ještě
   * nemá hotový import, `hasImportableColumns` bude `false` a přepínač se v popupu
   * vůbec nenabídne.
   */
  importableColumnOptions: ExportColumnOption[] = [];

  /**
   * @description Zda tahle tabulka vůbec má smysl nabízet "Exportovat v surovém
   * formátu" - jen pokud aspoň jeden sloupec v `detailsColumns` má `importable: true`.
   * Používá se jako `[showRawFormatOption]` binding na export popup.
   */
  get hasImportableColumns(): boolean {
    return this.detailsColumns.some(col => col.importable === true);
  }

  private computeExportableColumnOptions(): ExportColumnOption[] {
    const excludedKeys = new Set([...DEFAULT_EXPORT_EXCLUDED_KEYS, ...this.excludeFromExport]);

    return this.detailsColumns
      .filter(col => !excludedKeys.has(col.key))
      .map(col => ({ key: col.key, label: col.displayName || col.key }));
  }

  /**
   * @description Vypočítá seznam sloupců pro RAW export - jen ty s `importable: true`,
   * label = TECHNICKÝ název sloupce (`col.key`), ne český popisek, protože v raw
   * módu je hlavička souboru přesně to, co import zpětně očekává jako název sloupce.
   */
  private computeImportableColumnOptions(): ExportColumnOption[] {
    return this.detailsColumns
      .filter(col => col.importable === true)
      .map(col => ({ key: col.key, label: col.key }));
  }

  private async resolveExportData(): Promise<any[]> {
    if (this.exportSelectedOnly) {
      return (this.data || []).filter(item => this.selectedIds.has(item.id));
    }
    const responseData = await firstValueFrom(this.loadDataAsCollection());
    return Array.isArray(responseData) ? responseData : [];
  }

  async handleExportFormatSelected(selection: ExportSelection): Promise<void> {
    if (this.isExporting) return;
    this.isExporting = true;
    this.cd.markForCheck();

    const selectedOnly = this.exportSelectedOnly;
    const { format, columnKeys, rawFormat } = selection;

    try {
      const allData = await this.resolveExportData();

      if (allData.length === 0) {
        this.alertDialogService.open('Export', 'No data available for export.', 'warning');
        return;
      }

      const rows = rawFormat
        ? this.buildRawExportRows(allData, columnKeys)
        : this.buildExportRows(allData, columnKeys);

      const baseFilename = this.tableCaption || 'export';
      const suffix = (selectedOnly ? '-vybrane' : '') + (rawFormat ? '-raw' : '');
      const filename = `${baseFilename}${suffix}`;

      switch (format) {
        case 'csv':  this.downloadCsv(rows, filename); break;
        case 'xlsx': await this.downloadXlsx(rows, filename); break;
        case 'json': this.downloadJson(rows, filename); break;
        case 'txt':  this.downloadTxt(rows, filename); break;
      }

      this.logExportActivity(allData.length, format, selectedOnly, rawFormat);
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
   * @description Maps raw records to plain header->RAW-value objects, pro export
   * kompatibilní se zpětným importem (viz refactor-note 2026-08-23 v hlavičce souboru).
   * Na rozdíl od buildExportRows():
   * - hlavička sloupce je TECHNICKÝ název (col.key), ne český popisek - musí přesně
   *   sedět s tím, co ImportFileParser::assertHeadersMatch() na dané resource čeká,
   * - hodnoty se NEFORMÁTUJÍ (žádný select->label překlad, žádný DatePipe) - import
   *   zpět čeká syrovou hodnotu ve stejném tvaru, v jakém by přišla z API.
   */
  private buildRawExportRows(data: any[], selectedColumnKeys: string[] | null = null): Record<string, any>[] {
    const importableColumns = this.detailsColumns.filter(col => col.importable === true);
    const exportColumns = importableColumns.filter(
      col => selectedColumnKeys === null || selectedColumnKeys.includes(col.key)
    );

    return data.map(item => {
      const row: Record<string, any> = {};
      exportColumns.forEach(col => {
        row[col.key] = this.getRawExportValueForKey(item, col.key);
      });
      return row;
    });
  }

  /**
   * @description Vrátí SYROVOU hodnotu pole (žádné formátování/label překlad) - podporuje
   * tečkové cesty stejně jako getExportValueForKey(). null/undefined se převádí na
   * prázdný string kvůli konzistenci s ostatními export formáty, objekty/pole se pro
   * jistotu serializují do JSON stringu.
   */
  private getRawExportValueForKey(item: any, key: string): any {
    const keys = key.split('.');
    const value = keys.reduce((obj, k) => obj?.[k], item);
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return value;
  }

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

  private getAllHeaders(rows: Record<string, any>[]): string[] {
    const headers = new Set<string>();
    rows.forEach(row => Object.keys(row).forEach(h => headers.add(h)));
    return Array.from(headers);
  }

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

  private async downloadXlsx(rows: Record<string, any>[], filename: string): Promise<void> {
    const XLSX = await import('xlsx');
    const headers = this.getAllHeaders(rows);
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }

  private loadDataAsCollection() {
    const params = { ...this.currentFilters, no_pagination: 'true' };
    if (!params.sort_by) params.sort_by = 'id';
    if (!params.sort_direction) params.sort_direction = 'desc';
    return this.dataHandler.getCollection<any>(this.apiEndpoint, params);
  }

  private logExportActivity(rowCount: number, format: ExportFormat, selectedOnly: boolean = false, rawFormat: boolean = false): void {
    const logData = {
      event_type: rawFormat ? `export_raw_${format}` : `export_${format}`,
      module: this.apiEndpoint,
      description: `User exported ${rowCount}${selectedOnly ? ' selected' : ''} records (${format.toUpperCase()}${rawFormat ? ', RAW/import-compatible' : ''}) from table: ${this.tableCaption || this.apiEndpoint}.`,
      affected_entity_type: 'collection',
      user_id_plain: this.authService.getUserId()?.toString(),
      user_plain: this.authService.getUserEmail()
    };
    this.logCrud.create(logData).subscribe({
      error: (err) => console.error('Failed to log export:', err)
    });
  }

  // ── Import (append-only) ─────────────────────────────────────────────────

  /**
   * @description Otevre import popup. Na rozdil od exportu neni potreba nic
   * predpocitavat - popup si sablonu i validaci resi sam volanim core/import/*
   * endpointu s resource = this.apiEndpoint. Voláno zvenku přes ViewChild
   * (stránkový "Akce" dropdown, akce `triggerImport`) - viz refactor-note 2026-08-24
   * v hlavičce souboru. Bez vlastního tlačítka v interním toolbaru.
   */
  importData(): void {
    this.showImportPopup = true;
    this.cd.markForCheck();
  }

  closeImportPopup(): void {
    this.showImportPopup = false;
    this.cd.markForCheck();
  }

  /**
   * @description Po dokonceni importu (i queued) jen preda event nahoru - na rozdil od
   * mazani tahle komponenta nema lokalni kopii nove vytvorenych zaznamu, rodicovska
   * stranka si musi data natvrdo znovu natahnout z API.
   */
  onImportCompleted(): void {
    this.importCompleted.emit();
  }

  get colspanValue(): number {
    const checkboxColumn = this.canBulkSelect ? 1 : 0;
    return checkboxColumn + this.columnDefinitions.length + (this.buttons?.filter(b => b.isActive && this.isButtonColumnVisible(b)).length || 0);
  }
}