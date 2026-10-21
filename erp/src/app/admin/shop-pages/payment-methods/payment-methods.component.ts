/**
 * @file payment-methods.component.ts
 * @path src/app/admin/shop-pages/payment-methods/payment-methods.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the administration of store payment methods, including configuration, filtering, and data export.
 * @dependencies
 * - BaseDataComponent: Provides base CRUD functionality and state management for entities.
 * - TableBuilderComponent: Used for rendering and exporting the payment method data list.
 * - SHARED_UI_BUILDERS: Provides standard UI components like forms and tables.
 * - Config.create* factory functions: i18n-aware definitions - viz refactor-note
 *   (2026-09-09) níže.
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.PAYMENT_*` konstanty nahrazeny `Config.create*()` factory funkcemi.
 * `graphColumns` přestalo být `readonly`. `'Úspěch'`/`'Chyba'`/'Aktualizace selhala.'/
 * 'Nepodařilo se načíst detail.' nahrazeny `t()` voláním.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './payment-methods.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/**
 * @description Component for managing shop payment method settings.
 * @usage Enables administrators to view, filter, edit, and export payment method configurations.
 * @note Extends BaseDataComponent to leverage standard data handling routines while maintaining specific configuration mapping for payment entities.
 */
@Component({
  selector: 'app-payment-methods',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './payment-methods.component.html',
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentMethodsComponent extends BaseDataComponent<any> implements Core.OnInit {

  protected override translationSection: string = 'shop-payment-methods';

  public override t(key: string): string {
    return this.i18n.getValue(`shop-payment-methods.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'shop/payment_methods';

  columns: Core.ColumnDefinition[] = [];

  override filters: Core.FilterParams = {
    sort_by: 'sort_order',
    sort_direction: 'asc'
  };

  /** @refactor-note (2026-09-09) Přestalo být `readonly` - viz hlavička souboru. */
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createPaymentButtons(this.i18n);
      this.formFields = Config.createPaymentFormFields(this.i18n);
      this.columns = Config.createPaymentColumns(this.i18n);
      this.filterColumns = Config.createPaymentFilterColumns(this.i18n);
      this.detailsColumns = Config.createPaymentDetailsColumns(this.i18n);
      this.graphColumns = this.detailsColumns
        .filter(col => col.chartable === true)
        .map(col => ({
          key: col.key,
          label: col.displayName,
          aggregation: col.chartAggregation ?? 'count',
          possibleValues: col.chartPossibleValues,
        }));
      this.cd.markForCheck();
    });
  }

  /**
   * @description Computes the toolbar configuration dynamically.
   * @returns Array of buttons, filtered by user permissions and current UI state (e.g., filter visibility).
   */
  get toolbarButtons(): Core.Button[] {
    return Config.createPaymentToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
        case 'triggerImport':
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? this.t('toolbar_show_active') : this.t('toolbar_show_trash');
          updatedBtn.isActive = this.showTrashTable;
          break;
      }

      return updatedBtn;
    });
  }

  /**
   * @description Dispatches actions triggered from the toolbar.
   * @param action The specific action identifier (e.g., 'toggleFilters', 'exportActiveTable').
   */
  override handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      openGraphBuilder: () => this.openGraphBuilder(),
      exportActiveTable: () => this.exportActiveTable()
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void { this.forceFullRefresh(this.filters); }

  /**
   * @description Resets filters to default sorting order and refreshes data.
   */
  override clearFilters(): void {
    this.filters = { sort_by: 'sort_order', sort_direction: 'asc' };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Handles form submission by calling the API update service.
   * @param formData The data object submitted from the edit form.
   * @refactor-note (2026-09-09) Natvrdo 'Úspěch'/'Chyba'/'Aktualizace selhala.'
   * nahrazeny `t()` voláním.
   */
  override handleFormSubmitted(formData: any): void {
    if (!formData.id) return;

    this.updateData(formData.id, formData)
      .pipe(Core.finalize(() => { this.showCreateForm = false; this.cd.markForCheck(); }))
      .subscribe({
        next: () => {
          this.alertDialogService.open(
            this.i18n.getValue('shared.success'),
            formData.id ? this.t('crud_updated_message') : this.t('crud_created_message'),
            'success'
          );
          this.refreshData();
        },
        error: (err: any) => this.alertDialogService.open(
          this.i18n.getValue('shared.error'),
          err.error?.message || this.t('update_failed_message'),
          'danger'
        )
      });
  }

  /**
   * @description Fetches detailed information for a specific payment method.
   * @param item The record whose details are to be viewed.
   */
  override handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => { this.selectedItemForDetails = details; this.showDetails = true; this.cd.markForCheck(); },
      error: (err: any) => this.alertDialogService.open(
        this.i18n.getValue('shared.error'),
        err.error?.message || this.t('load_details_failed_message'),
        'danger'
      )
    });
  }

}