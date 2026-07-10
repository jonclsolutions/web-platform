/**
 * @file table-builder.component.ts
 * @path src/app/admin/components/builders/table-builder/table-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A generic, highly configurable table component for displaying datasets with
 * built-in CRUD actions, CSV export, and localized formatting.
 *
 * @refactor-note (2025) Dříve dědil z BaseDataComponent kvůli `deleteData()` a napojení na
 * alert/auth služby — data ale vždy přicházejí přes `@Input`, takže paginační/koš/cache
 * polovinu BaseDataComponent tato komponenta nikdy nepoužívala. Nyní si skládá
 * `EntityCrudService` přímo (pro delete + log export) a alert/auth služby injektuje sama.
 *
 * @dependencies
 * - EntityCrudService: CRUD volání (delete řádku, POST log exportu).
 * - ConfirmDialogService: Facilitates safe delete operations.
 * - CurrencyPipe, DatePipe: Standard pipes for data formatting.
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

/**
 * @description Renders a dynamic data table with support for pagination, sorting, filtering,
 * and custom action buttons.
 * @usage Used across various admin modules to display entities like products, users, or orders.
 * @note Implements OnPush change detection and a processing map to prevent duplicate API
 * requests during user interaction.
 */
@Component({
  selector: 'app-table-builder',
  standalone: true,
  imports: [FormsModule],
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
   * @description Fetches all data (ignoring pagination) to generate and download a CSV file.
   */
  async exportToCSV() {
    try {
      this.cd.markForCheck();
      const responseData = await firstValueFrom(this.loadDataAsCollection());
      const allData: any[] = Array.isArray(responseData) ? responseData : [];
      if (allData.length > 0) {
        let csv = this.columnDefinitions.map(col => col.header || col.key).join(';') + '\n';
        allData.forEach(item => {
          csv += this.columnDefinitions.map(col => `"${String(this.getCellValue(item, col) || '').replace(/"/g, '""')}"`).join(';') + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${this.tableCaption || 'export'}.csv`;
        link.click();
        this.logExportActivity(allData.length);
      } else {
        this.alertDialogService.open('Export', 'No data available for export.', 'warning');
      }
    } catch (error) {
      console.error('Export error:', error);
      this.alertDialogService.open('Error', 'An error occurred during export.', 'danger');
    } finally {
      this.cd.markForCheck();
    }
  }

  private logExportActivity(rowCount: number): void {
    const logData = {
      event_type: 'DATA_EXPORT',
      module: this.apiEndpoint,
      description: `User exported ${rowCount} records from table: ${this.tableCaption || this.apiEndpoint}.`,
      affected_entity_type: 'collection',
      user_id_plain: this.authService.getUserId()?.toString(),
      user_plain: this.authService.getUserEmail()
    };
    this.logCrud.create(logData).subscribe({
      error: (err) => console.error('Failed to log export:', err)
    });
  }

  private loadDataAsCollection() {
    const params = { ...this.currentFilters, no_pagination: 'true' };
    if (!params.sort_by) params.sort_by = 'id';
    if (!params.sort_direction) params.sort_direction = 'desc';
    return this.dataHandler.getCollection<any>(this.apiEndpoint, params);
  }

  /**
   * @description Calculates the total number of columns including action buttons for the table
   * layout.
   */
  get colspanValue(): number {
    return this.columnDefinitions.length + (this.buttons?.filter(b => b.isActive).length || 0);
  }
}