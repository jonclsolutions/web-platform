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
  ChangeDetectorRef, OnDestroy, OnChanges, SimpleChanges, inject, TemplateRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

import { DataHandler } from '../../../../core/services/data-handler.service';
import { EntityCrudService } from '../../../../core/services/entity-crud.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { PermissionService } from '../../../../core/auth/services/permission.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { ColumnDefinition } from '../../../../shared/interfaces/generic-form-column-definiton';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';
import * as Core from '../../../../shared/imports/core-providers';
import { ButtonBuilderComponent } from '../button-builder/button-builder.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { adminDateFormat, adminDateKind } from '../../../shared-date/admin-date-format';
import { BadgeTone, badgeToneOf } from '../badge-tones';
import { TableCardLayout, cardLayoutOf, cardMetaNeedsLabel, columnFits, phoneQuery as phoneMediaQuery } from '../table-cards';
import { AdminModalComponent } from '../../admin-modal/admin-modal.component';
import { RecordActionsComponent } from '../../record-actions/record-actions.component';

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
    NgTemplateOutlet,
    ButtonBuilderComponent,
    IconComponent,
    AdminModalComponent,
    RecordActionsComponent
  ],
  templateUrl: './trash-table-builder.component.html',
  styleUrls: ['../../../shared-styles/modal.css', '../table-style.css'],
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
  /** Footer content of the page (its paging), on the right of the one-row footer - as in the table builder. */
  @Input() footer: TemplateRef<unknown> | null = null;
  /**
   * Fields of the form of the page (as for the active table): a value of a select field shows
   * its translated option ("Podpora stávajícího projektu"), not its stored code ("support").
   */
  @Input() inputDefinitions: InputDefinition[] = [];
  /**
   * Phone (≤ 640px, 2026-11): the deleted records are the same compact cards as the active table
   * (table-cards.ts); a tap opens a window with all the values and the actions Restore / Delete
   * permanently (without the trash permission only the values). false keeps the table.
   */
  @Input() mobileCards: boolean = true;
  /**
   * Column widths by their content - the same as the active table (table-cards.ts
   * `columnFits`): short columns fit their content, texts share the rest. false = equal columns.
   */
  @Input() autoColumnWidths: boolean = true;

  /** The window is phone-sized (matchMedia, updated on a change). */
  isPhone = false;

  /** Record opened from its card (the window with its values and actions), null = closed. */
  openedItem: any | null = null;

  private phoneQuery: MediaQueryList | null = phoneMediaQuery();

  private readonly onPhoneQueryChange = (event: MediaQueryListEvent): void => {
    this.isPhone = event.matches;
    if (!this.isPhone) this.openedItem = null;
    this.cd.markForCheck();
  };

  /** Columns of the card, cached for the current column definitions. */
  private cardLayoutCache: { columns: ColumnDefinition[]; layout: TableCardLayout } | null = null;

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
    this.isPhone = !!this.phoneQuery?.matches;
    this.phoneQuery?.addEventListener('change', this.onPhoneQueryChange);
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

  // ══════════════════════════════════════════════════════════════════════
  // PHONE CARDS (`mobileCards`) + the window of a deleted record
  // ══════════════════════════════════════════════════════════════════════

  /** @description The rows are shown as cards: `mobileCards` on and a phone-sized window. */
  get showCards(): boolean {
    return this.mobileCards && this.isPhone;
  }

  /** @description Which columns go where on the card (table-cards.ts), cached per column set. */
  get cardLayout(): TableCardLayout {
    const columns = this.columnDefinitions || [];
    if (this.cardLayoutCache?.columns !== columns) this.cardLayoutCache = { columns, layout: cardLayoutOf(columns) };
    return this.cardLayoutCache.layout;
  }

  /** @description The column is fitted to its content (`autoColumnWidths`, table-cards.ts). */
  columnFits(column: ColumnDefinition): boolean {
    return columnFits(column);
  }

  /**
   * @description The table has a text column sharing the spare width; without one (all columns
   *   short) the short columns share it themselves (`auto-widths--all-fit`).
   */
  get hasFlexColumn(): boolean {
    return (this.columnDefinitions || []).some(col => !col.hidden && !columnFits(col));
  }

  /** @description A short value of a card needs its header (not an e-mail, a phone, a price …). */
  cardMetaNeedsLabel(column: ColumnDefinition): boolean {
    return cardMetaNeedsLabel(column);
  }

  /**
   * @description Title of a card (and of its window) - the values of the title columns joined
   *   by a space, the ID when they are empty.
   * @param item Deleted record.
   */
  cardTitle(item: any): string {
    const text = this.cardLayout.titles
      .map(column => this.getCellValue(item, column))
      .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
      .join(' ');
    return text || `#${item?.id ?? ''}`;
  }

  /** @description Columns shown in the window of a deleted record - every shown column. */
  get recordColumns(): ColumnDefinition[] {
    return (this.columnDefinitions || []).filter(col => !col.hidden);
  }

  /**
   * @description Actions of the window: Restore and Delete permanently - only with the trash
   *   permission (without it the window only shows the values).
   */
  get cardActions(): TableButtons[] {
    return this.canManageTrash ? this.buttons.filter(button => button.isActive) : [];
  }

  /** @description A tap on a card opens the window of the record. */
  openCard(item: any): void {
    this.openedItem = item;
    this.cd.markForCheck();
  }

  /**
   * @description Enter / Space on a focused card opens its window.
   * @param event Keyboard event.
   * @param item Deleted record.
   */
  onCardKeydown(event: KeyboardEvent, item: any): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.openCard(item);
  }

  /** @description Closes the window of the record. */
  closeCard(): void {
    this.openedItem = null;
    this.cd.markForCheck();
  }

  /**
   * @description An action of the window: the window closes and the action runs as from its row
   *   button (with its own confirmation).
   * @param action 'restore' or 'delete'.
   */
  onCardAction(action: string): void {
    const item = this.openedItem;
    this.closeCard();
    if (item) this.handleAction(item, action);
  }

  ngOnDestroy(): void {
    this.phoneQuery?.removeEventListener('change', this.onPhoneQueryChange);
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Tone of the coloured label of a cell (a column with `tones`, badge-tones.ts),
   *   null without one or for an empty value - the same labels as in the main table.
   * @param item Row.
   * @param column Column.
   */
  badgeTone(item: any, column: ColumnDefinition): BadgeTone | null {
    if (!column.tones) return null;
    const value = (column.toneKey ?? column.key).split('.').reduce((obj: any, key) => obj?.[key], item);
    return badgeToneOf(column.tones, value);
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
        // The ONE admin format (admin-date-format.ts); a table never shows seconds.
        return value ? (new DatePipe(this.i18n.getDateLocale())).transform(value, adminDateFormat(this.i18n, adminDateKind(column.format, 'date') === 'date' ? 'date' : 'datetime')) : '';
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
      default: {
        // A select field: its translated option, like in the active table.
        const fieldDef = this.inputDefinitions.find(field => field.column_name === column.key);
        if (fieldDef?.options) {
          const option = fieldDef.options.find(opt => String(opt.value) === String(value));
          return option ? option.label : value;
        }
        return value;
      }
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