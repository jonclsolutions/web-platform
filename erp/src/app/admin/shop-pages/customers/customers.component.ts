/**
 * @file customers.component.ts
 * @path src/app/admin/shop-pages/customers/customers.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the administration of shop customers, including CRUD operations, order history lookups, and data filtering.
 * @dependencies
 * - BaseDataComponent: Provides base CRUD functionality and pagination state management.
 * - TableBuilderComponent: Used for rendering the primary customer data grid.
 * - Config.create* factory functions: i18n-aware definitions - viz refactor-note
 *   (2026-09-09) níže.
 *
 * (Earlier bugfix-note 2026-08-31 for duplicate error toasts is unchanged.)
 *
 * @bugfix-note (2026-09-09) `formatCurrency()` mělo default `currency = 'CZK'`,
 * zatímco zbytek e-shopu (products, orders) pracuje výhradně v EUR - historie
 * objednávek zákazníka tak zobrazovala částky v CZK místo EUR. Opraveno default
 * na `'EUR'`.
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.CUSTOMER_*` konstanty nahrazeny `Config.create*()` factory funkcemi.
 * `graphColumns` přestalo být `readonly`. Všechny natvrdo psané texty a
 * `alertDialogService.open()` volání nahrazeny `t()` voláním. `formatCurrency()`/
 * `formatDate()` natvrdo `'cs-CZ'` nahrazeno `this.i18n.getDateLocale()`.
 * Status/payment status CSS třídy (`getStatusClass()`/`getPaymentStatusClass()`)
 * beze změny - jde o technické CSS class názvy, ne uživatelský text (skutečný
 * label přichází z `order.status_label`/`order.payment_status_label`, které vrací
 * backend).
 * @bugfix-note (2026-10-23) The `translations$` subscription of the constructor was never
 *   closed (one leaked subscriber on the root i18n service per page visit) - it now ends with
 *   the component (`takeUntilDestroyed()`).
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './customers.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomersComponent extends BaseDataComponent<any> implements Core.OnInit {

  protected override translationSection: string = 'shop-customers';

  public override t(key: string): string {
    return this.i18n.getValue(`shop-customers.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'shop/customers';

  customerColumns: Core.ColumnDefinition[] = [];
  trashCustomerColumns: Core.ColumnDefinition[] = [];

  showOrdersModal = false;
  selectedCustomerForOrders: any | null = null;
  customerOrders: any[] = [];
  customerOrdersLoading = false;
  customerOrdersError: string | null = null;
  ordersCurrentPage = 1;
  ordersTotalPages = 1;
  ordersTotalItems = 0;
  ordersPerPage = 10;
  ordersExpandedId: number | null = null;

  override filters: Core.FilterParams = {
    sort_by: 'created_at',
    sort_direction: 'desc'
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

    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createCustomerButtons(this.i18n);
      this.formFields = Config.createCustomerFormFields(this.i18n);
      this.customerColumns = Config.createCustomerColumns(this.i18n);
      this.trashCustomerColumns = Config.createCustomerTrashColumns(this.i18n);
      this.filterColumns = Config.createCustomerFilterColumns(this.i18n);
      this.detailsColumns = Config.createCustomerDetailsColumns(this.i18n);
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

  get toolbarButtons(): Core.Button[] {
    return Config.createCustomerToolbarButtons(this.i18n).map(btn => {
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

  override handleToolbarAction(action: string): void {
    // @refactor-note (2026-10-23) `triggerImport` removed with the toolbar button: the API has no
    //   customer import (open finding #25, the button answered 404).
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      openGraphBuilder: () => this.openGraphBuilder(),
      exportActiveTable: () => this.exportActiveTable(),
      toggleTable: () => this.toggleTable()
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  override clearFilters(): void {
    this.filters = { sort_by: 'created_at', sort_direction: 'desc' };
    this.currentPage = 1;
    this.refreshData();
  }

  /** Confirmation of the anonymisation. */
  private confirmDialog = inject(ConfirmDialogService);

  /**
   * @description GDPR erasure of a customer that keeps the orders (open finding #22): asks
   *   first, then POST shop/customers/{id}/anonymize and reloads the table.
   * @param item Customer row.
   * @returns Promise settled when the dialog / request finished.
   * @note A permanent delete of a customer with orders is refused by the API (409) - the
   *   orders are accounting documents; this action is the alternative.
   */
  async anonymizeCustomer(item: any): Promise<void> {
    if (!item?.id) return;
    const confirmed = await this.confirmDialog.open(
      this.t('anonymize_confirm_title'),
      this.t('anonymize_confirm_message').replace('{name}', item.full_name ?? item.email ?? String(item.id)),
      { confirm: this.t('btn_anonymize') }
    );
    if (!confirmed) return;

    this.dataHandler.post<any>(`${this.apiEndpoint}/${item.id}/anonymize`, {}).subscribe({
      next: () => {
        this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('anonymize_done_message'), 'success');
        this.refreshData();
      }
    });
  }

  // =============================================
  // ORDER HISTORY MODAL
  // =============================================

  showCustomerOrders(item: any): void {
    this.selectedCustomerForOrders = item;
    this.showOrdersModal = true;
    this.customerOrders = [];
    this.customerOrdersError = null;
    this.ordersCurrentPage = 1;
    this.ordersExpandedId = null;
    document.body.classList.add('modal-open');
    this.loadCustomerOrders(1);
    this.cd.markForCheck();
  }

  closeOrdersModal(): void {
    this.showOrdersModal = false;
    this.selectedCustomerForOrders = null;
    this.customerOrders = [];
    this.customerOrdersError = null;
    this.ordersExpandedId = null;
    document.body.classList.remove('modal-open');
    this.cd.markForCheck();
  }

  loadCustomerOrders(page: number): void {
    if (!this.selectedCustomerForOrders?.id) return;

    this.customerOrdersLoading = true;
    this.customerOrdersError = null;
    this.cd.markForCheck();

    const url = `shop/orders?customer_id=${this.selectedCustomerForOrders.id}&per_page=${this.ordersPerPage}&page=${page}&sort_by=created_at&sort_direction=desc`;

    this.dataHandler.get<any>(url)
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.customerOrders = response.data ?? [];
          this.ordersTotalPages = response.last_page ?? 1;
          this.ordersTotalItems = response.total ?? 0;
          this.ordersCurrentPage = response.current_page ?? 1;
          this.customerOrdersLoading = false;
          this.cd.markForCheck();
        },
        error: () => {
          this.customerOrdersError = this.t('load_orders_failed_message');
          this.customerOrdersLoading = false;
          this.cd.markForCheck();
        }
      });
  }

  ordersChangePage(page: number): void {
    if (page < 1 || page > this.ordersTotalPages || page === this.ordersCurrentPage) return;
    this.ordersCurrentPage = page;
    this.loadCustomerOrders(page);
  }

  toggleOrderExpand(orderId: number): void {
    this.ordersExpandedId = this.ordersExpandedId === orderId ? null : orderId;
    this.cd.markForCheck();
  }

  getOrderPages(): number[] {
    const pages: number[] = [];
    const total = this.ordersTotalPages;
    const current = this.ordersCurrentPage;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (current > 3) pages.push(-1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  get maxDisplayedOrdersCount(): number {
    return Math.min(this.ordersCurrentPage * this.ordersPerPage, this.ordersTotalItems);
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      processing: 'status-processing',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      returned: 'status-returned',
      canceled: 'status-canceled',
    };
    return map[status] ?? 'status-pending';
  }

  getPaymentStatusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'pay-pending',
      paid: 'pay-paid',
      failed: 'pay-failed',
      refunded: 'pay-refunded',
      cod: 'pay-cod',
    };
    return map[status] ?? 'pay-pending';
  }

  /**
   * @bugfix-note (2026-09-09) Default `currency` byl `'CZK'`, zatímco zbytek
   * e-shopu pracuje výhradně v EUR - viz hlavička souboru.
   * @refactor-note (2026-09-09) Natvrdo `'cs-CZ'` nahrazeno `this.i18n.getDateLocale()`.
   */
  formatCurrency(value: number, currency = 'EUR'): string {
    return new Intl.NumberFormat(this.i18n.getDateLocale(), { style: 'currency', currency }).format(value ?? 0);
  }

  /** @refactor-note (2026-09-09) Natvrdo `'cs-CZ'` nahrazeno `this.i18n.getDateLocale()`. */
  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat(this.i18n.getDateLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

}