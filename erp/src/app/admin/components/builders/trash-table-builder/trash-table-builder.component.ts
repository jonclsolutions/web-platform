/**
 * @file trash-table-builder.component.ts
 * @path src/app/admin/components/builders/trash-table-builder/trash-table-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Specialized table component for managing deleted records ("trash"), allowing for
 * permanent deletion or restoration.
 *
 * @refactor-note (2025) Dříve dědil z BaseDataComponent — data ale vždy přicházejí přes
 * `@Input` a paginační/koš/cache polovinu BaseDataComponent tato komponenta nikdy
 * nevyužívala (o to se stará rodičovská "smart" stránka). Nyní si skládá
 * `EntityCrudService` přímo (restore/delete/hard-delete-all).
 *
 * @dependencies
 * - EntityCrudService: Inherits core CRUD and data lifecycle management.
 * - ConfirmDialogService: Ensures safe irreversible operations (permanent delete).
 * - SHARED_UI_BUILDERS: Provides UI components like toolbars and buttons.
 */

import {
  Component, Input, ChangeDetectionStrategy, Output, EventEmitter,
  ChangeDetectorRef, OnDestroy, OnChanges, SimpleChanges, inject
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

import { DataHandler } from '../../../../core/services/data-handler.service';
import { EntityCrudService } from '../../../../core/services/entitiy-crud.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { ColumnDefinition } from '../../../../shared/interfaces/generic-form-column-definiton';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';
import { SHARED_UI_BUILDERS } from '../../../../shared/imports/shared-ui-builders';
import * as Core from '../../../../shared/imports/core-providers';

/**
 * @description A dedicated table view for displaying soft-deleted records with utility actions
 * to restore or purge data.
 * @usage Used in admin modules to provide a "Trash" view for data recovery.
 * @note Skládá si `EntityCrudService` pro restore/delete/hard-delete-all — nededí z
 * BaseDataComponent (nikdy nepoužíval jeho paginační/koš logiku, tu vlastní rodičovská
 * stránková komponenta).
 */
@Component({
  selector: 'app-trash-table-builder',
  standalone: true,
  imports: [
    FormsModule,
    SHARED_UI_BUILDERS
  ],
  templateUrl: './trash-table-builder.component.html',
  styleUrls: ['../table-style.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrashTableBuilderComponent implements OnDestroy, OnChanges {
  @Input() data: any[] = [];
  @Input('columns') columnDefinitions: ColumnDefinition[] = [];
  @Input() tableCaption?: string;
  @Input() apiEndpoint: string = '';
  @Input() uploadsBaseUrl: string = '';

  buttons: TableButtons[] = [
    { display_name: '♻️', header_name: "Restore", isActive: true, type: 'confirm_button', action: "restore" },
    { display_name: '🧨', header_name: "Delete Permanently", isActive: true, type: 'delete_button', action: "delete" },
  ];

  deleteAllButtonConfig: Core.Button[] = [
    {
      action: 'deleteAll',
      label: 'Delete All',
      icon: '🗑️',
      class: 'btn-trash small-btn',
      isActive: false,
      showIf: true
    }
  ];

  public isFullWidth: boolean = true;

  @Output() itemRestored = new EventEmitter<void>();
  @Output() itemDeletedPermanently = new EventEmitter<void>();

  public alertDialogService = inject(AlertDialogService);

  private destroy$ = new Subject<void>();
  private _crud?: EntityCrudService<any>;

  /** CRUD pro řádky koš tabulky (aktuální `apiEndpoint`, lazy). */
  private get crud(): EntityCrudService<any> {
    if (!this._crud) {
      this._crud = new EntityCrudService<any>(
        this.dataHandler, () => this.apiEndpoint, this.destroy$, () => this.cd.markForCheck()
      );
    }
    return this._crud;
  }

  constructor(
    private dataHandler: DataHandler,
    private cd: ChangeDetectorRef,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  /**
   * @description Handles toolbar interactions, specifically for the bulk-delete action.
   */
  handleToolbarAction(action: string): void {
    if (action === 'deleteAll') {
      this.deleteAll();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Renders formatted cell content based on column definition type.
   */
  getCellValue(item: any, column: ColumnDefinition): any {
    const keys = column.key.split('.');
    const value = keys.reduce((obj, key) => obj?.[key], item);

    switch (column.type as any) {
      case 'currency': {
        if (value === undefined || value === null || value === '') return '';
        const currency = column.currencyCode ? column.currencyCode.toUpperCase() : 'CZK';
        const locale = currency === 'CZK' ? 'cs-CZ' : 'de-DE';

        try {
          return (new CurrencyPipe(locale)).transform(value, currency, 'symbol-narrow', '1.2-2');
        } catch (e) {
          return `${value} ${currency}`;
        }
      }

      case 'date':
        return value ? (new DatePipe('cs-CZ')).transform(value, column.format || 'shortDate') : '';
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'image':
        return value ? `${this.uploadsBaseUrl}${value}` : '';
      case 'array':
        return Array.isArray(value) ? value.join(', ') : value;
      case 'object':
        return this.isObject(value) ? JSON.stringify(value) : value;
      default:
        return value;
    }
  }

  isObject(value: any): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * @description Manages row-level restoration and deletion logic.
   */
  handleAction(item: any, action: string): void {
    if (!item.id) return;

    switch (action) {
      case 'restore':
        this.confirmDialogService.open('Restore Confirmation', 'Are you sure you want to restore this item?').then(result => {
          if (result) {
            this.crud.restore(item.id).subscribe({
              next: () => {
                this.alertDialogService.open('Success', 'Item successfully restored.', 'success');
                this.removeItemFromLocalData(item.id);
                this.itemRestored.emit();
              },
              error: () => {
                this.alertDialogService.open('Error', 'An error occurred while restoring the item.', 'danger');
              }
            });
          }
        });
        break;

      case 'delete':
        this.confirmDialogService.open('Permanent Delete Confirmation', 'Are you sure you want to PERMANENTLY delete this item? This action is irreversible!').then(result => {
          if (result) {
            this.crud.remove(item.id, { forceDelete: true }).subscribe({
              next: () => {
                this.alertDialogService.open('Success', 'Item permanently deleted.', 'success');
                this.removeItemFromLocalData(item.id);
                this.itemDeletedPermanently.emit();
              },
              error: () => {
                this.alertDialogService.open('Error', 'An error occurred while deleting the item.', 'danger');
              }
            });
          }
        });
        break;
    }
  }

  private removeItemFromLocalData(id: number): void {
    const index = this.data.findIndex(dataItem => dataItem.id === id);
    if (index > -1) {
      this.data.splice(index, 1);
      this.cd.markForCheck();
    }
  }

  /**
   * @description Executes a permanent wipe of all trashed items after user confirmation.
   */
  deleteAll(): void {
    if (this.data.length === 0) {
      this.alertDialogService.open('Warning', 'No items available to delete.', 'warning');
      return;
    }

    this.confirmDialogService.open('Delete All Permanently', 'Are you sure you want to PERMANENTLY delete ALL items? This action is irreversible!')
      .then(result => {
        if (result) {
          this.crud.hardDeleteAllTrashed().subscribe({
            next: () => {
              this.alertDialogService.open('Success', 'All items permanently deleted.', 'success');
              this.data = [];
              this.itemDeletedPermanently.emit();
              this.cd.markForCheck();
            },
            error: () => {
              this.alertDialogService.open('Error', 'An error occurred during mass deletion.', 'danger');
            }
          });
        }
      });
  }

  /**
   * @description Calculates colspan for empty or error message rows.
   */
  get colspanValue(): number {
    const activeButtonsCount = this.buttons?.filter(b => b.isActive).length || 0;
    return this.columnDefinitions.length + (activeButtonsCount > 0 ? 1 : 0);
  }
}