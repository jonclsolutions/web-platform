/**
 * @file trash-table-builder.component.ts
 * @path src/app/admin/components/trash-table-builder/trash-table-builder.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2025
 * @description Specialized table component for managing deleted records ("trash"), allowing for permanent deletion or restoration.
 * @dependencies
 * - BaseDataComponent: Inherits core CRUD and data lifecycle management.
 * - ConfirmDialogService: Ensures safe irreversible operations (permanent delete).
 * - SHARED_UI_BUILDERS: Provides UI components like toolbars and buttons.
 */

import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import * as Core from '../../../../shared/imports/core-providers';
import { ColumnDefinition } from '../../../../shared/interfaces/generic-form-column-definiton';
import { BaseDataComponent } from '../../base-data/base-data.component';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';
import { SHARED_UI_BUILDERS } from '../../../../shared/imports/shared-ui-builders';

/**
 * @description A dedicated table view for displaying soft-deleted records with utility actions to restore or purge data.
 * @usage Used in admin modules to provide a "Trash" view for data recovery.
 * @note Extends BaseDataComponent to leverage standard pagination and API interaction while adding specific trash-related logic.
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
export class TrashTableBuilderComponent extends BaseDataComponent<any> implements Core.OnInit, Core.OnChanges {
  @Input() override data: any[] = [];
  @Input('columns') columnDefinitions: ColumnDefinition[] = [];
  @Input() tableCaption?: string;
  @Input() override apiEndpoint: string = '';
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

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private confirmDialogService: ConfirmDialogService,
  ) {
    super(dataHandler, cd, genericTableService);
  }

  /**
   * @description Handles toolbar interactions, specifically for the bulk-delete action.
   * @param action The triggered action identifier.
   */
  handleToolbarAction(action: string): void {
    if (action === 'deleteAll') {
      this.deleteAll();
    }
  }

  override ngOnChanges(changes: Core.SimpleChanges): void {
    super.ngOnChanges(changes);
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  /**
   * @description Renders formatted cell content based on column definition type.
   * @param item The source data object.
   * @param column Configuration defining how to format the data.
   * @returns {any} Localized/formatted string or raw value.
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
   * @param item The target item for the action.
   * @param action 'restore' or 'delete'.
   */
  handleAction(item: any, action: string): void {
    if (!item.id) return;

    switch (action) {
      case 'restore':
        this.confirmDialogService.open('Restore Confirmation', 'Are you sure you want to restore this item?').then(result => {
          if (result) {
            this.restoreDataFromApi(item.id).subscribe({
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
            this.deleteData(item.id, true).subscribe({
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
          this.hardDeleteAllTrashedDataFromApi().subscribe({
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