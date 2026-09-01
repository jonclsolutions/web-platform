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
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z `error:` callbacků (handleFormSubmitted, handleViewDetails) -
 * `DataHandler.handleError()` je jediné autoritativní místo pro chybový toast.
 * `loadCustomerOrders()` používá lokální `customerOrdersError` stav (ne toast),
 * beze změny.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './customers.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, SHARED_UI_BUILDERS, ActionMenuBuilderComponent,GraphBuilderComponent],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomersComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  tableCaption: string = 'Zákazníci';

  override apiEndpoint: string = 'shop/customers';

  buttons = Config.CUSTOMER_BUTTONS;
  formFields = Config.CUSTOMER_FORM_FIELDS;
  customerColumns = Config.CUSTOMER_COLUMNS;
  trashCustomerColumns = Config.CUSTOMER_TRASH_COLUMNS;
  filterColumns = Config.CUSTOMER_FILTER_COLUMNS;
  detailsColumns = Config.CUSTOMER_DETAILS_COLUMNS;

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

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
showGraphBuilder = false;
  readonly graphColumns: GraphColumnOption[] = Config.CUSTOMER_DETAILS_COLUMNS
     .filter(col => col.chartable === true)
     .map(col => ({
       key: col.key,
       label: col.displayName,
      aggregation: col.chartAggregation ?? 'count',
      possibleValues: col.chartPossibleValues
     }));
  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

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
        case 'triggerImport':
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? 'Zobrazit aktivní' : 'Koš';
          updatedBtn.isActive = this.showTrashTable;
          break;
      }

      return updatedBtn;
    });
  }

  handleToolbarAction(action: string): void {
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

  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

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

  handleFormSubmitted(formData: any): void {
    const request$ = formData.id ? this.updateData(formData.id, formData) : this.postData(formData);
    request$.pipe(Core.finalize(() => {
      this.showCreateForm = false;
      this.cd.markForCheck();
    })).subscribe({
      next: () => {
        this.alertDialogService.open('Úspěch', formData.id ? 'Požadavek byl upraven.' : 'Požadavek byl vytvořen.', 'success');
        this.refreshData();
      }
    });
  }

  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
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

  formatCurrency(value: number, currency = 'CZK'): string {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(value ?? 0);
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

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
  openGraphBuilder(): void {
    this.showGraphBuilder = true;
    this.cd.markForCheck();
  }

  closeGraphBuilder(): void {
    this.showGraphBuilder = false;
    this.cd.markForCheck();
  }
}