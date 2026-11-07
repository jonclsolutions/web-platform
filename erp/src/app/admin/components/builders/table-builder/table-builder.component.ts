/**
 * @file table-builder.component.ts
 * @path src/app/admin/components/builders/table-builder/table-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description A generic, highly configurable table component for displaying datasets with
 * built-in CRUD actions, multi-format export (CSV/XLSX/JSON/TXT), append-only import, and
 * localized formatting.
 *
 * @dependencies
 * - EntityCrudService: CRUD calls (row delete, POST of the export log).
 * - ConfirmDialogService: Facilitates safe delete operations (single and bulk).
 * - ExportPopupBuilderComponent: Format picker popup of the data export, incl. the column choice.
 * - ImportPopupBuilderComponent: Append-only import popup (template, upload, dry-run, commit).
 * - PermissionService: Evaluates TableButtons.permission for the row buttons and the
 *   visibility of "Delete selected" in the dropdown (canBulkDelete).
 * - CurrencyPipe, DatePipe: Standard pipes for data formatting.
 * - xlsx (SheetJS): Lazy-loaded only when the XLSX export is chosen, see downloadXlsx().
 * - IconComponent: Shared SVG icon set of the row buttons.
 * - AdminLocalizationService: Static i18n of the admin UI (NOT the web / e-shop content).
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ChangeDetectorRef, OnDestroy, OnChanges, SimpleChanges, HostListener, inject
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';

import { DataHandler } from '../../../../core/services/data-handler.service';
import { EntityCrudService } from '../../../../core/services/entity-crud.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { PermissionService } from '../../../../core/auth/services/permission.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
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
/**
 * @description One row of the allowed-values hint of the import - shown in
 * ImportPopupBuilderComponent on the "upload" step, so the user does not fill a CSV column
 * blindly and risk the import validation (Store*Request `in:...` rule) refusing the row for an
 * unknown value.
 */
export interface ImportEnumHint {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

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
   * @description Offers "Delete selected" in the bulk-actions dropdown (still only with an active
   * `delete_button` the user has the permission of). OPT-IN: set it only on a table whose API
   * resource has `POST {apiEndpoint}/bulk-delete` (a controller `bulkDestroy()`) - by default the
   * action is hidden, so a table without that endpoint never offers an action ending in a 404
   * (VT-14). Tables without bulk deletion on purpose (core/users - sysadmin protection; shop
   * orders, customers, products, coupons, shipping methods; security events - purge instead)
   * leave it off. Single deletion (row button) is NOT affected.
   */
  @Input() bulkDeleteEnabled: boolean = false;

  @Output() itemDeleted = new EventEmitter<any>();
  @Output() createFormOpened = new EventEmitter<void>();
  @Output() editFormOpened = new EventEmitter<any>();
  @Output() viewDetailsOpened = new EventEmitter<any>();
  @Output() generateFormOpened = new EventEmitter<any>();
  @Output() resetPasswordFormOpened = new EventEmitter<any>();
  /**
   * @description "Activation" button in the row (visible only on rows matching `visibleWhen`,
   * see administrators.config.ts) - the page wires it to POST core/users/{id}/resend-activation.
   * Same pattern as the other *Opened events - TableBuilderComponent only forwards it, no
   * business logic.
   */
  @Output() resendActivationOpened = new EventEmitter<any>();
  @Output() openImagesModal = new EventEmitter<any>();
  @Output() openVariantsModal = new EventEmitter<any>();
  @Output() customerOrdersOpened = new EventEmitter<any>();
  /** Row action 'anonymize' (GDPR erasure that keeps the orders, shop customers - finding #22). */
  @Output() anonymizeRequested = new EventEmitter<any>();

  @Output() refreshRequested = new EventEmitter<void>();

  /**
   * @description Emitted after a successful import (synchronous or queued). The parent page
   * reacts like to itemDeleted / refreshRequested, typically with forceFullRefresh(), so the new
   * records show at once (unlike deletion, this component has no local copy of newly created
   * rows - they must come from the API again).
   */
  @Output() importCompleted = new EventEmitter<void>();

  web_logs_endpoint: string = 'web/logs';

  showExportPopup = false;
  isExporting = false;
  exportSelectedOnly = false;

  /** Controls the visibility of the import popup (opened by importData()). */
  showImportPopup = false;

  selectedIds = new Set<any>();
  showBulkMenu = false;
  bulkDeleting = false;

  public alertDialogService = inject(AlertDialogService);
  public authService = inject(AuthService);
  public permissionService = inject(PermissionService);

  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('table-builder'); }
  public t(key: string): string { return this.i18n.getValue(`table-builder.${key}`); }

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
  /**
 * @description Derives the allowed-values hint of the import - only the columns that are
 * `importable: true` (see `detailsColumns`) AND have an `options` list on the matching
 * `InputDefinition` (enum columns like status / priority / thema). Plain text columns (no
 * `options`) are left out - they have no restriction, the legend would be empty / confusing.
 */
get importEnumHints(): ImportEnumHint[] {
  return this.detailsColumns
    .filter(col => col.importable === true)
    .map(col => {
      const fieldDef = this.inputDefinitions.find(i => i.column_name === col.key);
      if (!fieldDef?.options || fieldDef.options.length === 0) return null;
      return { key: col.key, label: col.displayName, options: fieldDef.options };
    })
    .filter((hint): hint is ImportEnumHint => hint !== null);
}

  constructor(
    private dataHandler: DataHandler,
    private cd: ChangeDetectorRef,
    private confirmDialogService: ConfirmDialogService,
  ) {
    this.i18n.translations$.pipe(takeUntil(this.destroy$)).subscribe(() => this.cd.markForCheck());
  }

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
        const locale = this.i18n.getDateLocale();  // admin language, was 'cs-CZ' (finding #50)
        try {
          return (new CurrencyPipe(locale)).transform(value, currency, 'symbol-narrow', '1.2-2');
        } catch (e) {
          return `${value} ${currency}`;
        }
      }
      case 'date':
        return value ? (new DatePipe(this.i18n.getDateLocale())).transform(value, column.format || 'd.M.yyyy') : '';
      case 'boolean':
        return (value == true || value === 'true' || value == 1)
          ? this.i18n.getValue('shared.yes')
          : this.i18n.getValue('shared.no');
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
   * @description Permission-only check (global, per logged-in user). Building block of
   * isButtonVisibleForItem() / isButtonColumnVisible() below, usable on its own as well.
   */
  isButtonVisible(button: TableButtons): boolean {
    if (!button.permission) return true;
    return button.permission.split('|').some(p => this.permissionService.hasPermission(p));
  }

  /**
   * @description Decides whether the button is shown on a SPECIFIC row - combines the
   * permission check (isButtonVisible) with the optional per-row condition
   * (`button.visibleWhen`). Without `visibleWhen` the result equals isButtonVisible(). Used when
   * rendering the <button> inside the <td> (see .html).
   */
  isButtonVisibleForItem(button: TableButtons, item: any): boolean {
    if (!this.isButtonVisible(button)) return false;
    return !button.visibleWhen || button.visibleWhen(item);
  }

  /**
   * @description Whether at least ONE row of the current page (`this.data`) needs the button -
   * decides whether the column header is rendered at all. Without `visibleWhen` (no per-row
   * condition) the column is always shown when the permission check passes, regardless of the
   * data.
   */
  hasAnyRowForButton(button: TableButtons): boolean {
    if (!button.visibleWhen) return true;
    return (this.data || []).some(item => button.visibleWhen!(item));
  }

  /**
   * @description Combined condition for rendering the WHOLE column (header and colspanValue) -
   * the permission and "does it make sense on this page of data" at once. Used by the header
   * cells of the template instead of isButtonVisible() alone.
   */
  isButtonColumnVisible(button: TableButtons): boolean {
    return this.isButtonVisible(button) && this.hasAnyRowForButton(button);
  }

  /**
   * @description Aria label of the checkbox of a specific row (contains the record ID). A method
   * instead of an inline .replace() in the template - more readable and easier to test.
   */
  rowSelectAriaLabel(id: any): string {
    return this.strings.select_row_aria.replace('{id}', String(id));
  }

  /**
   * @description Text of the bulk bar "{count} selected" - see rowSelectAriaLabel() above for why
   * a getter and not inline interpolation in the template.
   */
  get bulkCountLabel(): string {
    return this.strings.bulk_count_label.replace('{count}', String(this.selectedIds.size));
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
          case 'anonymize': this.anonymizeRequested.emit(item); break;
          default: console.warn('Unknown action type:', buttonAction);
        }
        this.cd.markForCheck();
      } finally {
        setTimeout(() => { this.processingItemIds.delete(item.id); }, 500);
      }
    }, 0);
  }

  public onDeleteAction(item: any): void {
    this.confirmDialogService.open(this.t('confirm_delete_title'), this.t('confirm_delete_message'))
      .then(result => {
        if (result) {
          this.crud.remove(item.id).subscribe({
            next: () => {
              this.removeItemFromLocal(item.id);
              this.selectedIds.delete(item.id);
              this.itemDeleted.emit(item);
              this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('delete_success_message'), 'success');
            },
            error: () => {
              this.processingItemIds.delete(item.id);
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
    if (!this.bulkDeleteEnabled) return false;
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
   * @description Bulk-deletes all selected rows with ONE HTTP request to
   * `{apiEndpoint}/bulk-delete` (the controller of the table must have a `bulkDestroy()`
   * method), not N parallel single DELETE calls.
   * @note Offered only with `bulkDeleteEnabled` (tables whose resource has the endpoint); a
   * failure (e.g. a missing endpoint) is still caught in the `catch` block below and shown as an
   * error message, never a silent failure.
   */
  async onBulkDeleteClick(): Promise<void> {
    if (!this.canBulkDelete || this.selectedIds.size === 0 || this.bulkDeleting) return;
    this.showBulkMenu = false;

    const count = this.selectedIds.size;
    const confirmed = await this.confirmDialogService.open(
      this.t('confirm_bulk_delete_title'),
      this.t('confirm_bulk_delete_message').replace('{count}', String(count))
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
        this.alertDialogService.open(
          this.i18n.getValue('shared.success'),
          this.t('bulk_delete_success_message').replace('{deleted}', String(res.deleted_count)),
          'success'
        );
      } else if (res.deleted_count === 0) {
        this.alertDialogService.open(
          this.t('bulk_delete_fail_title'),
          this.t('bulk_delete_fail_message').replace('{requested}', String(res.requested)),
          'danger'
        );
      } else {
        this.alertDialogService.open(
          this.t('bulk_delete_partial_title'),
          this.t('bulk_delete_partial_message')
            .replace('{deleted}', String(res.deleted_count))
            .replace('{requested}', String(res.requested))
            .replace('{skipped}', String(res.skipped_count)),
          'warning'
        );
      }

      this.itemDeleted.emit(ids);
    } catch (err) {
      // DataHandler.handleError() already showed a toast for this HTTP error.
      // No further action needed here.
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
   * @description Subset of `detailsColumns` marked `importable: true` - offered in the export
   * popup as a checkbox list once the admin switches on "Export in raw format". An empty array =
   * the resource has no import yet, `hasImportableColumns` is `false` and the toggle is not
   * offered at all.
   */
  importableColumnOptions: ExportColumnOption[] = [];

  /**
   * @description Whether offering "Export in raw format" makes sense for this table - only when
   * at least one column of `detailsColumns` has `importable: true`. Used as the
   * `[showRawFormatOption]` binding of the export popup.
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
   * @description Computes the column list of the RAW export - only `importable: true` columns,
   * label = the TECHNICAL column name (`col.key`), not the human label, because in raw mode the
   * file header is exactly what the import expects as the column name.
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
        this.alertDialogService.open(this.t('export_no_data_title'), this.t('export_no_data_message'), 'warning');
        return;
      }

      const rows = rawFormat
        ? this.buildRawExportRows(allData, columnKeys)
        : this.buildExportRows(allData, columnKeys);

      const baseFilename = this.tableCaption || 'export';
      // Suffix in the admin language (was the Czech '-vybrane' always, finding #50).
      const suffix = (selectedOnly ? `-${this.i18n.getValue('table-builder.export_selected_suffix')}` : '') + (rawFormat ? '-raw' : '');
      const filename = `${baseFilename}${suffix}`;

      switch (format) {
        case 'csv':  this.downloadCsv(rows, filename); break;
        case 'xlsx': await this.downloadXlsx(rows, filename); break;
        case 'json': this.downloadJson(rows, filename); break;
        case 'txt':  this.downloadTxt(rows, filename); break;
      }

      this.logExportActivity(allData.length, format, selectedOnly, rawFormat);
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) {
        console.error('Export error:', error);
        this.alertDialogService.open(this.i18n.getValue('shared.error'), this.t('export_error_message'), 'danger');
      }
    } finally {
      this.isExporting = false;
      this.showExportPopup = false;
      this.exportSelectedOnly = false;
      this.cd.markForCheck();
    }
  }

  /**
   * @description Maps raw records to plain header->RAW-value objects for an export compatible
   * with the import. Unlike buildExportRows():
   * - the column header is the TECHNICAL name (col.key), not the human label - it must match
   *   exactly what ImportFileParser::assertHeadersMatch() expects for the resource,
   * - values are NOT formatted (no select->label translation, no DatePipe) - the import
   *   expects the raw value in the same shape as the API returns it.
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
   * @description Returns the RAW value of the field (no formatting / label translation) -
   * supports dot paths like getExportValueForKey(). null / undefined become an empty string for
   * consistency with the other export formats, objects / arrays are serialized to a JSON string.
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
        return (new DatePipe(this.i18n.getDateLocale())).transform(value, detailCol.format || 'd.M.yyyy') ?? String(value);
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
   * @description Opens the import popup. Unlike the export nothing has to be precomputed - the
   * popup handles the template and the validation itself through the core/import/* endpoints
   * with resource = this.apiEndpoint. Called from outside through ViewChild (the page "Actions"
   * dropdown, action `triggerImport`). No own button in the internal toolbar.
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
   * @description After an import (also queued) only passes the event up - unlike deletion this
   * component has no local copy of the newly created records, the parent page must reload the
   * data from the API.
   */
  onImportCompleted(): void {
    this.importCompleted.emit();
  }

  get colspanValue(): number {
    const checkboxColumn = this.canBulkSelect ? 1 : 0;
    return checkboxColumn + this.columnDefinitions.length + (this.buttons?.filter(b => b.isActive && this.isButtonColumnVisible(b)).length || 0);
  }
}