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
 * - SHARED_UI_BUILDERS: Provides common UI components used throughout the module.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './customers.config';

/**
 * @description Orchestrates the customer management dashboard, handling client lists, profile details, and associated order history.
 * @usage Used by store administrators to view and manage customer accounts.
 * @note Supports modal-based order history viewing with specialized formatting for statuses and financial data.
 */
@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, SHARED_UI_BUILDERS],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomersComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'shop/customers';

  buttons = Config.CUSTOMER_BUTTONS;
  formFields = Config.CUSTOMER_FORM_FIELDS;
  customerColumns = Config.CUSTOMER_COLUMNS;
  trashCustomerColumns = Config.CUSTOMER_TRASH_COLUMNS;
  filterColumns = Config.CUSTOMER_FILTER_COLUMNS;
  detailsColumns = Config.CUSTOMER_DETAILS_COLUMNS;

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

  // Order management state
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

  filters: Core.FilterParams = {
    sort_by: 'created_at',
    sort_direction: 'desc'
  };

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

  /**
   * @description Configures toolbar buttons dynamically based on current module state (e.g., trash view, filter visibility).
   * @returns {Core.Button[]} A collection of enabled and configured toolbar buttons.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.CUSTOMER_TOOLBAR_BUTTONS.map(btn => {
      let updatedBtn = { ...btn };
      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }
      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? 'Skrýt filtry' : 'Filtry';
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
          if (updatedBtn.showIf !== false) updatedBtn.showIf = !this.showTrashTable;
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? 'Zpět na seznam' : 'Koš';
          break;
      }
      return updatedBtn;
    });
  }

  /**
   * @description Maps toolbar action identifiers to corresponding component methods.
   * @param action Identifier of the clicked toolbar button.
   */
  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
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

  /**
   * @description Applies user-selected filters and resets the current page to one.
   * @param newFilters The filter parameters to merge.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Clears current filters and resets the list to default sort order.
   */
  clearFilters(): void {
    this.filters = { sort_by: 'created_at', sort_direction: 'desc' };
    this.currentPage = 1;
    this.refreshData();
  }

  handlePageChange(page: number): void {
    this.onHandlePageChange(page, this.filters);
  }

  handleItemsPerPageChange(value: number): void {
    this.onHandleItemsPerPageChange(value, this.filters);
  }

  /**
   * @description Triggers the CSV export functionality on the active table component.
   */
  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = true;
  }

  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = { ...item };
    this.showCreateForm = true;
  }

  /**
   * @description Submits customer form data and refreshes the data grid upon success.
   * @param formData The form data to be persisted.
   */
  handleFormSubmitted(formData: any): void {
    const request$ = formData.id ? this.updateData(formData.id, formData) : this.postData(formData);
    request$.pipe(Core.finalize(() => {
      this.showCreateForm = false;
      this.cd.markForCheck();
    })).subscribe({
      next: () => this.refreshData(),
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Uložení zákazníka selhalo.', 'danger')
    });
  }

  /**
   * @description Fetches and displays deep-dive details for a specific customer.
   * @param item The customer record to inspect.
   */
  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Nepodařilo se načíst detail zákazníka.', 'danger')
    });
  }

  // =============================================
  // ORDER HISTORY MODAL
  // =============================================

  /**
   * @description Opens the orders history modal for the specified customer.
   * @param item The target customer record.
   */
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

  /**
   * @description Closes the modal and cleans up the UI/body state.
   */
  closeOrdersModal(): void {
    this.showOrdersModal = false;
    this.selectedCustomerForOrders = null;
    this.customerOrders = [];
    this.customerOrdersError = null;
    this.ordersExpandedId = null;
    document.body.classList.remove('modal-open');
    this.cd.markForCheck();
  }

  /**
   * @description Loads a paginated list of orders for the currently selected customer.
   * @param page The target page index.
   */
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
          this.customerOrdersError = 'Nepodařilo se načíst objednávky zákazníka.';
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

  /**
   * @description Generates a pagination array for the order history view, including ellipsis logic.
   * @returns {number[]} Array of page numbers or indicators.
   */
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

  /**
   * @description Returns the CSS class for order statuses based on status type.
   * @param status The status string from the API.
   * @returns {string} The CSS class name.
   */
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

  formatCurrency(value: number, currency = 'CZK'): string {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(value ?? 0);
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  // =============================================

  handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
  }

  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }

  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }
}