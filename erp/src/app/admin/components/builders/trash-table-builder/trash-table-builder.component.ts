/**
 * @file trash-table-builder.component.ts
 * @path src/app/admin/components/builders/trash-table-builder/trash-table-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Specialized table component for managing deleted records ("trash"), allowing for
 * permanent deletion or restoration.
 *
 * @dependencies
 * - EntityCrudService: Inherits core CRUD and data lifecycle management.
 * - ConfirmDialogService: Ensures safe irreversible operations (permanent delete).
 * - PermissionService: Evaluates `deletePermission` for restore / delete / delete-all.
 * - IconComponent: Shared SVG icon set of the row buttons.
 * - AdminLocalizationService: i18n of the admin UI.
 */

import {
  Component, Input, ChangeDetectionStrategy, Output, EventEmitter,
  ChangeDetectorRef, OnDestroy, OnChanges, SimpleChanges, inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

import { DataHandler } from '../../../../core/services/data-handler.service';
import { EntityCrudService } from '../../../../core/services/entitiy-crud.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { PermissionService } from '../../../../core/auth/services/permission.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { ColumnDefinition } from '../../../../shared/interfaces/generic-form-column-definiton';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';
import * as Core from '../../../../shared/imports/core-providers';
import { ButtonBuilderComponent } from '../button-builder/button-builder.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

/**
 * @description A dedicated table view for displaying soft-deleted records with utility actions
 * to restore or purge data.
 * @usage Used in admin modules to provide a "Trash" view for data recovery.
 * @note Composes `EntityCrudService` for restore / delete / hard-delete-all - does not extend
 * BaseDataComponent (the pagination / trash logic belongs to the parent page component).
 */
@Component({
  selector: 'app-trash-table-builder',
  standalone: true,
  imports: [
    FormsModule,
    ButtonBuilderComponent,
    IconComponent
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

  /**
   * @description Permission key (or several separated by `|` - OR) required for Restore, Delete
   * Permanently AND the bulk Delete All - on the backend all three fall under the same granular
   * `{resource}-delete` key (see api.php). When not set, all actions stay visible (backward
   * compatibility with pages that do not pass this Input yet).
   */
  @Input() deletePermission?: string;

  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('trash-table-builder'); }
  public t(key: string): string { return this.i18n.getValue(`trash-table-builder.${key}`); }

  buttons: TableButtons[] = [];

  public isFullWidth: boolean = true;

  @Output() itemRestored = new EventEmitter<void>();
  @Output() itemDeletedPermanently = new EventEmitter<void>();

  public alertDialogService = inject(AlertDialogService);
  public permissionService = inject(PermissionService);

  private destroy$ = new Subject<void>();
  private _crud?: EntityCrudService<any>;

  /** CRUD of the rows of the trash table (current `apiEndpoint`, lazy). */
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
  ) {
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.buttons = [
        { display_name: this.t('btn_restore'), header_name: this.t('btn_restore'), isActive: true, type: 'confirm_button', action: 'restore', icon: 'restore' },
        { display_name: this.t('btn_delete_permanently'), header_name: this.t('btn_delete_permanently'), isActive: true, type: 'delete_button', action: 'delete', icon: 'purge' },
      ];
      this.cd.markForCheck();
    });
  }

  /**
   * @description Whether restore/delete/delete-all should be visible at all, based on
   * `deletePermission`. Supports OR syntax ('klic1|klic2'), same as *appHasPermission -
   * `true` when `deletePermission` is not set (backwards compatible default).
   */
  get canManageTrash(): boolean {
    if (!this.deletePermission) return true;
    return this.deletePermission.split('|').some(p => this.permissionService.hasPermission(p));
  }

  /**
   * @description Bulk "Delete All" toolbar button config. A getter (not a static array) -
   * `showIf` is derived from `canManageTrash`, so the bulk action hides like the row buttons
   * when the user lacks `deletePermission`.
   */
  get deleteAllButtonConfig(): Core.Button[] {
    return [
      {
        action: 'deleteAll',
        label: this.t('btn_empty_trash'),
        icon: '',
        class: 'btn-trash small-btn',
        isActive: false,
        showIf: this.canManageTrash
      }
    ];
  }

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
        const currency = column.currencyCode ? column.currencyCode.toUpperCase() : 'EUR';
        const locale = this.i18n.getDateLocale();

        try {
          return (new CurrencyPipe(locale)).transform(value, currency, 'symbol-narrow', '1.2-2');
        } catch (e) {
          return `${value} ${currency}`;
        }
      }

      case 'date':
        return value ? (new DatePipe(this.i18n.getDateLocale())).transform(value, column.format || 'shortDate') : '';
      case 'boolean':
        return (value == true || value === 'true' || value == 1)
          ? this.i18n.getValue('shared.yes')
          : this.i18n.getValue('shared.no');
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
        this.confirmDialogService.open(this.t('restore_confirm_title'), this.t('restore_confirm_message')).then(result => {
          if (result) {
            this.crud.restore(item.id).subscribe({
              next: () => {
                this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('item_restored_message'), 'success');
                this.removeItemFromLocalData(item.id);
                this.itemRestored.emit();
              }
            });
          }
        });
        break;

      case 'delete':
        this.confirmDialogService.open(this.t('permanent_delete_confirm_title'), this.t('permanent_delete_confirm_message')).then(result => {
          if (result) {
            this.crud.remove(item.id, { forceDelete: true }).subscribe({
              next: () => {
                this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('item_deleted_permanently_message'), 'success');
                this.removeItemFromLocalData(item.id);
                this.itemDeletedPermanently.emit();
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
      this.alertDialogService.open(this.t('warning_title'), this.t('no_items_to_delete_message'), 'warning');
      return;
    }

    this.confirmDialogService.open(this.t('delete_all_confirm_title'), this.t('delete_all_confirm_message'))
      .then(result => {
        if (result) {
          this.crud.hardDeleteAllTrashed().subscribe({
            next: (res: any) => {
              if (res?.skipped_count > 0) {
                this.alertDialogService.open(
                  this.t('warning_title'),
                  this.t('some_items_kept_message')
                    .replace('{deleted}', String(res.deleted_count ?? 0))
                    .replace('{skipped}', String(res.skipped_count)),
                  'warning'
                );
              } else {
                this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('all_items_deleted_message'), 'success');
                this.data = [];
              }
              this.itemDeletedPermanently.emit();
              this.cd.markForCheck();
            }
          });
        }
      });
  }

  /**
   * @description Calculates colspan for empty or error message rows. The row buttons
   * (Restore / Delete) count as one column only when `canManageTrash` - otherwise an extra
   * empty column without buttons would appear.
   */
  get colspanValue(): number {
    const activeButtonsCount = this.canManageTrash
      ? (this.buttons?.filter(b => b.isActive).length || 0)
      : 0;
    return this.columnDefinitions.length + (activeButtonsCount > 0 ? 1 : 0);
  }
}