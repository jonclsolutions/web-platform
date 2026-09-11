/**
 * @file trash-table-builder.component.ts
 * @path src/app/admin/components/builders/trash-table-builder/trash-table-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Specialized table component for managing deleted records ("trash"), allowing for
 * permanent deletion or restoration.
 *
 * (Earlier refactor-notes for EntityCrudService composition, permission granularization,
 * SVG icons, and duplicate error toast removal are unchanged - see version history.)
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `AdminLocalizationService` injektována manuálně (komponenta nededí `BaseDataComponent`,
 * stejný vzor jako `TableBuilderComponent`/`GraphBuilderComponent`). `buttons`
 * (dřív statické pole s natvrdo anglickým textem) přesunuto do konstruktoru, plněné
 * `translations$.subscribe()`. `getCellValue()` `date`/`currency`/`boolean` case
 * sjednoceny s `TableBuilderComponent`:
 * - `currency`: locale podle `column.currencyCode` (ne natvrdo `'cs-CZ'`/`'de-DE'`).
 * - `date`: `this.i18n.getDateLocale()` místo natvrdo `'cs-CZ'`.
 * - `boolean`: `shared.yes`/`shared.no` místo natvrdo anglického `'Yes'`/`'No'`.
 * Všechny `alertDialogService.open()`/`confirmDialogService.open()` texty a natvrdo
 * psaný `'Vysypat koš'` label nahrazeny `t()` voláním.
 *
 * @dependencies
 * - EntityCrudService: Inherits core CRUD and data lifecycle management.
 * - ConfirmDialogService: Ensures safe irreversible operations (permanent delete).
 * - PermissionService: Vyhodnocení `deletePermission` pro restore/delete/delete-all.
 * - IconComponent: Sdílená sada SVG ikon pro řádková tlačítka.
 * - AdminLocalizationService: i18n admin UI - viz refactor-note výše.
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
 * @note Skládá si `EntityCrudService` pro restore/delete/hard-delete-all — nededí z
 * BaseDataComponent (nikdy nepoužíval jeho paginační/koš logiku, tu vlastní rodičovská
 * stránková komponenta).
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
   * @description Permission klíč (nebo víc oddělených `|` - OR) požadovaný pro Restore,
   * Delete Permanently I hromadné Delete All - všechny tři spadají na backendu pod
   * stejný granulární `{resource}-delete` klíč (viz api.php). Když není nastaven,
   * všechny akce zůstávají viditelné (zpětná kompatibilita se stránkami, které tenhle
   * Input ještě nepředávají).
   */
  @Input() deletePermission?: string;

  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('trash-table-builder'); }
  public t(key: string): string { return this.i18n.getValue(`trash-table-builder.${key}`); }

  /** @refactor-note (2026-09-09) Přestalo být statické pole - plněno v konstruktoru přes `translations$`. */
  buttons: TableButtons[] = [];

  public isFullWidth: boolean = true;

  @Output() itemRestored = new EventEmitter<void>();
  @Output() itemDeletedPermanently = new EventEmitter<void>();

  public alertDialogService = inject(AlertDialogService);
  public permissionService = inject(PermissionService);

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
  ) {
    this.i18n.translations$.subscribe(() => {
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
   * @description Bulk "Delete All" toolbar button config. Je to getter (ne statické
   * pole) - `showIf` se dopočítává z `canManageTrash`, ať se hromadná akce schová
   * stejně jako řádková tlačítka, když uživatel nemá `deletePermission`.
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
   * @refactor-note (2026-09-09) `currency`/`date`/`boolean` case sjednoceny s
   * `TableBuilderComponent` - viz hlavička souboru.
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
   * @refactor-note (2026-09-09) Všechny texty nahrazeny `t()` voláním.
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
   * @refactor-note (2026-09-09) Všechny texty nahrazeny `t()` voláním.
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
            next: () => {
              this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('all_items_deleted_message'), 'success');
              this.data = [];
              this.itemDeletedPermanently.emit();
              this.cd.markForCheck();
            }
          });
        }
      });
  }

  /**
   * @description Calculates colspan for empty or error message rows. Řádková tlačítka
   * (Restore/Delete) se počítají jako jeden souhrnný sloupec jen pokud `canManageTrash`
   * - jinak by se objevil prázdný sloupec navíc bez tlačítek.
   */
  get colspanValue(): number {
    const activeButtonsCount = this.canManageTrash
      ? (this.buttons?.filter(b => b.isActive).length || 0)
      : 0;
    return this.columnDefinitions.length + (activeButtonsCount > 0 ? 1 : 0);
  }
}