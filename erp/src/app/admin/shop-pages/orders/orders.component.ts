/**
 * @file orders.component.ts
 * @path src/app/admin/shop-pages/orders/orders.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the lifecycle of customer orders, including creation, editing, status tracking, and inventory validation.
 * @dependencies
 * - BaseDataComponent: Inherits standard CRUD operations for order management.
 * - ConfirmDialogService: Facilitates user confirmation for sensitive deletions.
 * - Core Providers: Handles API communication and dependency injection.
 * - Config.create* factory functions: i18n-aware definitions - viz refactor-note
 *   (2026-09-09) níže.
 *
 * @bugfix-note (2026-09-09) BACKLOG "vícejazyčná administrace" side-effect fixes:
 * 1) `PAYMENT_STATUS_OPTIONS` chybějící `unpaid` hodnota doplněna - viz
 *    orders.config.ts hlavička.
 * 2) Duplicitní lokální `orderTabButtons` pole (bez permission kontroly na koš
 *    tabu) ODSTRANĚNO - `tabButtonsConfigs` teď staví ze `Config.createOrderTabButtons()`
 *    S permission kontrolou (stejný vzor jako `toolbarButtons`).
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.*` konstanty nahrazeny `Config.create*()` factory funkcemi. Všechny
 * `alertDialogService.open()`/`confirmDialog.open()` volání a natvrdo psané texty
 * nahrazeny `t()` voláním. `console.error()` volání (dev diagnostika) přeloženy do
 * angličtiny - stejná konvence jako `products.component.ts`. Timeline kroky
 * v šabloně teď volají existující `getStatusLabel(step.key)` místo vlastního
 * natvrdo psaného labelu v poli - odstraňuje duplicitní zdroj pravdy pro stavové
 * texty. `formatCurrency()` natvrdo `'cs-CZ'` nahrazeno `this.i18n.getDateLocale()`
 * - měna zůstává EUR (obchodní rozhodnutí, nesouvisí s jazykem UI).
 */

import { Component, ViewChild, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import * as Config from './orders.config';
import { Order, OrderItem, Product, ProductVariant, PaymentMethod, ShippingMethod, Coupon } from './';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

interface CouponValidationResult {
  valid: boolean;
  error?: string;
}

type TableMode = 'all' | 'pending_tasks' | 'trash';

/**
 * @description Controller for the orders dashboard, providing UI for managing order statuses, financial details, and item composition.
 * @usage Acts as the main interface for store administrators to process incoming orders and handle post-purchase support.
 * @note Implements a custom modal-based flow for order creation and editing, requiring manual form validation and total recalculation.
 */
@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, SHARED_UI_BUILDERS, GraphBuilderComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersComponent extends BaseDataComponent<Order> implements OnInit, OnDestroy {
  override apiEndpoint: string = 'shop/orders';
  @ViewChild('activeTable') activeTable!: any;

  protected override translationSection: string = 'shop-orders';

  public override t(key: string): string {
    return this.i18n.getValue(`shop-orders.${key}`);
  }

  tableCaption: string = '';

  currentMode: TableMode = 'all';

  products: Product[] = [];
  variants: ProductVariant[] = [];
  paymentMethods: PaymentMethod[] = [];
  shippingMethods: ShippingMethod[] = [];
  coupons: Coupon[] = [];
  statusOptions: { value: string; label: string }[] = [];
  paymentStatusOptions: { value: string; label: string }[] = [];

  summaryTaxAmount = 0;

  showOrderForm = false;
  showDetailsModal = false;
  showFiltersPanel = false;

  selectedOrderForDetail: Order | null = null;
  editingOrder: Order | null = null;
  editingItemIdx: number | null = null;

  couponValidation: CouponValidationResult = { valid: true };

  private isProcessing = false;

  filters: Core.FilterParams = {
    sort_by: 'created_at',
    sort_direction: 'desc'
  };

  buttons: Core.TableButtons[] = [];
  orderColumns: Core.ColumnDefinition[] = [];
  trashOrderColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  toolbarButtons: Core.Button[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];

  /** @bugfix-note (2026-09-09) Přestalo být samostatné - viz hlavička souboru. */
  private orderTabButtons: Core.Button[] = [];

  showGraphBuilder = false;

  /** @refactor-note (2026-09-09) Přestalo být `readonly` - přepočítáno v i18n subscribe. */
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router,
    private confirmDialog: ConfirmDialogService
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createOrderButtons(this.i18n);
      this.orderColumns = Config.createOrderColumns(this.i18n);
      this.trashOrderColumns = Config.createTrashOrderColumns(this.i18n);
      this.filterColumns = Config.createFilterColumns(this.i18n);
      this.toolbarButtons = Config.createToolbarButtons(this.i18n);
      this.detailsColumns = Config.createOrderDetailsColumns(this.i18n);
      this.orderTabButtons = Config.createOrderTabButtons(this.i18n);
      this.statusOptions = Config.createStatusOptions(this.i18n);
      this.paymentStatusOptions = Config.createPaymentStatusOptions(this.i18n);
      this.graphColumns = this.detailsColumns
        .filter(col => col.chartable === true)
        .map(col => ({
          key: col.key,
          label: col.displayName,
          aggregation: col.chartAggregation ?? 'count',
          possibleValues: col.chartPossibleValues,
        }));
      this.updateFilterOptions();
      this.cd.markForCheck();
    });
  }

  /**
   * @returns Map of tab configurations with active state synchronized to current
   * table mode, filtered by permission - viz bugfix-note v hlavičce souboru.
   */
  get tabButtonsConfigs(): Core.Button[] {
    return this.orderTabButtons.map(btn => {
      const updatedBtn = { ...btn, isActive: this.currentMode === btn.action };
      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }
      return updatedBtn;
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
    this.loadDependencies();
    this.refreshData();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.toggleBodyScroll(false);
  }

  /**
   * @description Locks or unlocks background scrolling when modals are active.
   * @param lock Boolean indicating if the body should be locked.
   */
  private toggleBodyScroll(lock: boolean): void {
    if (lock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  /**
   * @description Switches between table modes and applies corresponding API filter parameters.
   * @param mode The selected target view (all, pending_tasks, or trash).
   */
  setTableMode(mode: any): void {
    this.currentMode = mode;
    this.currentPage = 1;

    this.filters = {
      sort_by: 'created_at',
      sort_direction: 'desc'
    };

    if (mode === 'trash') {
      this.showTrashTable = true;
      this.filters['only_trashed'] = 'true';
    } else {
      this.showTrashTable = false;
      delete this.filters['only_trashed'];

      if (mode === 'pending_tasks') {
        this.filters['status'] = 'pending,confirmed,processing,shipped';
      }
    }

    this.refreshData();
    this.cd.detectChanges();
  }

  /**
   * @description Orchestrates the initialization of all required lookup collections.
   */
  private loadDependencies(): void {
    this.loadProducts();
    this.loadVariants();
    this.loadPaymentMethods();
    this.loadShippingMethods();
    this.loadCoupons();
    this.updateFilterOptions();
  }

  private loadProducts(): void {
    this.dataHandler.getCollection<Product>('shop/products?no_pagination=true')
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.products = data;
          this.cd.markForCheck();
        },
        error: (err) => console.error('Error loading products:', err)
      });
  }

  private loadVariants(): void {
    this.dataHandler.getCollection<any>('shop/products?no_pagination=true')
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.variants = [];
          products.forEach((product: any) => {
            if (product.variants && product.variants.length > 0) {
              product.variants.forEach((variant: any) => {
                this.variants.push({
                  ...variant,
                  product_id: product.id,
                  product_name: product.name
                });
              });
            }
          });
          this.cd.markForCheck();
        },
        error: (err) => console.error('Error loading variants:', err)
      });
  }

  private loadPaymentMethods(): void {
    this.dataHandler.getCollection<any>('shop/payment_methods?no_pagination=true')
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.paymentMethods = data;
          this.cd.markForCheck();
        },
        error: (err) => console.error('Error loading payment methods:', err)
      });
  }

  private loadShippingMethods(): void {
    this.dataHandler.getCollection<ShippingMethod>('shop/shipping_methods?no_pagination=true')
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.shippingMethods = data;
          this.cd.markForCheck();
        },
        error: (err) => console.error('Error loading shipping methods:', err)
      });
  }

  private loadCoupons(): void {
    this.dataHandler.getCollection<Coupon>('shop/coupons?no_pagination=true')
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.coupons = data;
          this.cd.markForCheck();
        },
        error: (err) => console.error('Error loading coupons:', err)
      });
  }

  private updateFilterOptions(): void {
    const statusFilter = this.filterColumns.find(f => f.key === 'status');
    if (statusFilter) {
      statusFilter.options = this.statusOptions;
    }

    const paymentFilter = this.filterColumns.find(f => f.key === 'payment_status');
    if (paymentFilter) {
      paymentFilter.options = this.paymentStatusOptions;
    }

    this.cd.markForCheck();
  }

  /**
   * @description Maps toolbar button actions to their corresponding method calls.
   * @param action The identifier of the triggered toolbar action.
   */
  handleToolbarAction(action: string): void {
    if (this.isProcessing) return;

    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      openGraphBuilder: () => this.openGraphBuilder(),
      toggleTable: () => this.setTableMode(this.currentMode === 'trash' ? 'all' : 'trash'),
      exportActiveTable: () => this.exportActiveTable()
    };

    if (actions[action]) actions[action]();
  }

  exportActiveTable(): void {
    if (this.activeTable) {
      this.activeTable.exportToCSV();
    }
  }

  override toggleFilters(): void {
    this.showFiltersPanel = !this.showFiltersPanel;
    this.cd.markForCheck();
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
    this.setTableMode(this.currentMode);
  }

  handlePageChange(page: number): void {
    this.onHandlePageChange(page, this.filters);
  }

  handleItemsPerPageChange(value: number): void {
    this.onHandleItemsPerPageChange(value, this.filters);
  }

  /**
   * @description Fetches full order details for the display modal.
   * @param item The summary order object from the table.
   */
  handleViewDetails(item: Order): void {
    if (this.isProcessing || !item.id) return;

    this.isProcessing = true;
    this.loadingService.show();

    this.getItemDetails(item.id).pipe(
      Core.finalize(() => {
        this.loadingService.hide();
        this.isProcessing = false;
        this.cd.markForCheck();
      }),
      Core.takeUntil(this.destroy$)
    ).subscribe({
      next: (fullOrder) => {
        this.selectedOrderForDetail = fullOrder;
        this.showDetailsModal = true;
        this.toggleBodyScroll(true);
        this.cd.markForCheck();
      },
      error: () => {
        this.alertDialogService.open(this.i18n.getValue('shared.error'), this.t('load_details_failed_message'), 'danger');
      }
    });
  }

  /**
   * @description Checks if a specific status has been reached in the linear status workflow.
   * @param currentStatus The current order status.
   * @param stepKey The target workflow step to check against.
   * @returns Boolean indicating if the step is reached or passed.
   */
  isStatusReached(currentStatus: string, stepKey: string): boolean {
    const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepKey);

    if (currentIndex === -1 || stepIndex === -1) {
      return false;
    }
    return stepIndex <= currentIndex;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedOrderForDetail = null;
    this.toggleBodyScroll(false);
    this.cd.markForCheck();
  }

  /**
   * @description Initializes an empty object for new order creation.
   */
  handleCreateFormOpened(): void {
    if (this.isProcessing) return;

    this.couponValidation = { valid: true };
    this.editingOrder = {
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      company: '',

      status: 'pending',
      payment_status: 'unpaid',

      shipping_address: '',
      shipping_city: '',
      shipping_postal_code: '',
      shipping_country: this.t('default_shipping_country'),

      payment_method_id: 0,
      shipping_method_id: 0,
      coupon_id: null,

      total_amount: 0,
      shipping_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      final_amount: 0,

      items: [],
      notes: ''
    };

    this.showOrderForm = true;
    this.toggleBodyScroll(true);
    this.cd.markForCheck();
  }

  handleEditFormOpened(order: Order, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isProcessing) return;
    this.openEditOrderForm(order);
  }

  /**
   * @description Loads existing order data into the editing form, mapping complex structures back to the view model.
   * @param order The summary order record to be edited.
   */
  openEditOrderForm(order: Order): void {
    if (this.isProcessing || !order.id) return;

    this.isProcessing = true;
    this.loadingService.show();

    this.getItemDetails(order.id).pipe(
      Core.finalize(() => {
        this.loadingService.hide();
        this.isProcessing = false;
        this.cd.markForCheck();
      }),
      Core.takeUntil(this.destroy$)
    ).subscribe({
      next: (fullOrder) => {
        this.editingOrder = {
          ...fullOrder,
          email: fullOrder.customer?.email || '',
          first_name: fullOrder.customer?.first_name || '',
          last_name: fullOrder.customer?.last_name || '',
          phone: fullOrder.customer?.phone || '',
          company: fullOrder.customer?.company || ''
        };
        this.showOrderForm = true;
        this.toggleBodyScroll(true);
        this.recalculateTotals();
        this.cd.markForCheck();
      },
      error: () => {
        this.alertDialogService.open(this.i18n.getValue('shared.error'), this.t('load_order_failed_message'), 'danger');
      }
    });
  }

  /**
   * @description Appends a default new item row to the current order items list.
   */
  addOrderItem(): void {
    if (!this.editingOrder) return;
    if (!this.editingOrder.items) {
      this.editingOrder.items = [];
    }

    this.editingOrder.items.push({
      product_id: 0,
      product_name: '',
      product_variant_id: 0,
      variant_name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      vat_rate: 21
    });

    this.cd.markForCheck();
  }

  /**
   * @description Handles item deletion by marking items for removal or splicing them from the local list.
   * @param index The index of the item to delete.
   */
  async deleteOrderItem(index: number): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      this.t('delete_item_confirm_title'),
      this.t('delete_item_confirm_message')
    );

    if (confirmed && this.editingOrder?.items) {
      const item = this.editingOrder.items[index];
      if (item.id) {
        item._delete = true;
      } else {
        this.editingOrder.items.splice(index, 1);
      }
      this.recalculateTotals();
      this.cd.markForCheck();
    }
  }

  onItemQuantityChange(item: OrderItem): void {
    item.total_price = item.quantity * item.unit_price;
    this.recalculateTotals();
    this.cd.markForCheck();
  }

  onItemPriceChange(item: OrderItem): void {
    item.total_price = item.quantity * item.unit_price;
    this.recalculateTotals();
    this.cd.markForCheck();
  }

  getTrashToolbarButtons(): any[] {
    return this.toolbarButtons.filter(btn =>
      btn.action !== 'handleCreateFormOpened' &&
      btn.action !== 'exportActiveTable'
    );
  }

  /**
   * @description Performs validation checks for coupon usage limits and order thresholds.
   * @param coupon The coupon entity.
   * @param totalAmount The current subtotal to validate against.
   * @returns Validation result object containing status and error messages.
   */
  validateCouponRealtime(coupon: Coupon, totalAmount: number): CouponValidationResult {
    if (!coupon) return { valid: true };
    if (!coupon.is_active) return { valid: false, error: this.t('coupon_error_inactive') };

    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) return { valid: false, error: this.t('coupon_error_not_started') };
    if (coupon.valid_until && new Date(coupon.valid_until) < now) return { valid: false, error: this.t('coupon_error_expired') };

    const maxUsage = coupon.max_usage ?? 0;
    if (maxUsage > 0 && (coupon.usage_count || 0) >= maxUsage) return { valid: false, error: this.t('coupon_error_exhausted') };

    const minAmount = Number(coupon.min_order_amount ?? 0);
    if (minAmount > 0 && totalAmount < minAmount) {
      return {
        valid: false,
        error: this.t('coupon_error_min_amount').replace('{amount}', this.formatCurrency(minAmount))
      };
    }
    return { valid: true };
  }

  /**
   * @description Recalculates final order values based on line items, shipping, payment fees, and coupon discounts.
   */
  recalculateTotals(): void {
    if (!this.editingOrder) return;

    const items = (this.editingOrder.items || []).filter(i => !i._delete);

    let productsTotal = 0;
    items.forEach(item => {
      productsTotal += (Number(item.quantity || 0) * Number(item.unit_price || 0));
    });
    this.editingOrder.total_amount = productsTotal;

    let discount = 0;
    if (this.editingOrder.coupon_id) {
      const idToFind = Number(this.editingOrder.coupon_id);
      const coupon = this.coupons.find(c => Number(c.id) === idToFind);

      if (coupon) {
        this.couponValidation = this.validateCouponRealtime(coupon, productsTotal);
        if (this.couponValidation.valid) {
          discount = (coupon.discount_type === 'percent')
            ? (productsTotal * Number(coupon.discount_value)) / 100
            : Number(coupon.discount_value);
        } else {
          discount = 0;
        }
      }
    } else {
      this.couponValidation = { valid: true };
      discount = 0;
    }

    this.editingOrder.discount_amount = Math.min(discount, productsTotal);
    this.editingOrder.shipping_amount = this.getShippingMethodPrice(this.editingOrder.shipping_method_id);
    const paymentFee = this.getPaymentMethodPrice(this.editingOrder.payment_method_id);

    this.editingOrder.final_amount = (productsTotal - this.editingOrder.discount_amount) +
                                     this.editingOrder.shipping_amount +
                                     paymentFee;

    this.cd.markForCheck();
  }

  /**
   * @description Persists order data to the backend via POST or PUT, handling deletion of individual items.
   */
  saveOrder(): void {
    if (this.isProcessing || !this.editingOrder || !this.validateOrder()) return;

    this.isProcessing = true;

    const payload: any = {
      email: this.editingOrder.email,
      first_name: this.editingOrder.first_name,
      last_name: this.editingOrder.last_name,
      phone: this.editingOrder.phone,
      company: this.editingOrder.company || null,

      payment_method_id: Number(this.editingOrder.payment_method_id),
      shipping_method_id: Number(this.editingOrder.shipping_method_id),
      coupon_id: this.editingOrder.coupon_id || null,
      status: this.editingOrder.status,
      payment_status: this.editingOrder.payment_status,
      shipping_address: this.editingOrder.shipping_address,
      shipping_city: this.editingOrder.shipping_city,
      shipping_postal_code: this.editingOrder.shipping_postal_code,
      shipping_country: this.editingOrder.shipping_country,
      notes: this.editingOrder.notes,
      items: (this.editingOrder.items || []).filter(i => !i._delete).map(i => ({
        id: i.id || null,
        product_id: Number(i.product_id),
        product_variant_id: i.product_variant_id ? Number(i.product_variant_id) : null,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        vat_rate: i.vat_rate ? Number(i.vat_rate) : 21
      }))
    };

    this.loadingService.show();

    let request;
    if (this.editingOrder.id) {
      payload.delete_items = (this.editingOrder.items || [])
        .filter(i => i._delete && i.id)
        .map(i => i.id!);

      request = this.dataHandler.post(`${this.apiEndpoint}/${this.editingOrder.id}`, {
        ...payload,
        _method: 'PUT'
      });
    } else {
      delete payload.customer_id;
      request = this.dataHandler.post(this.apiEndpoint, payload);
    }

    request.pipe(
      Core.finalize(() => {
        this.loadingService.hide();
        this.isProcessing = false;
        this.cd.markForCheck();
      }),
      Core.takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('order_saved_message'), 'success');
        this.showOrderForm = false;
        this.editingOrder = null;
        this.toggleBodyScroll(false);
        this.refreshData();

        if (this.showDetailsModal && this.selectedOrderForDetail?.id) {
          this.loadingService.show();
          this.getItemDetails(this.selectedOrderForDetail.id).pipe(
            Core.finalize(() => {
              this.loadingService.hide();
              this.cd.markForCheck();
            }),
            Core.takeUntil(this.destroy$)
          ).subscribe({
            next: (updatedOrder) => {
              this.selectedOrderForDetail = updatedOrder;
              this.toggleBodyScroll(true);
            },
            error: () => {
              console.error('Failed to refresh order details after save.');
            }
          });
        }
      },
      error: (err) => {
        console.error('Backend validation error:', err.error);
        const message = err.error?.message || this.t('save_order_failed_message');
        this.alertDialogService.open(this.i18n.getValue('shared.error'), message, 'danger');
      }
    });
  }

  onVariantSelected(item: OrderItem, index: number) {
    const variantId = Number(item.product_variant_id);
    const selectedVariant = this.variants.find(v => Number(v.id) === variantId);

    if (selectedVariant) {
      item.product_id = selectedVariant.product_id;
      item.product_name = selectedVariant.product_name || selectedVariant.variant_name || '';
      item.variant_name = selectedVariant.variant_name;
      item.unit_price = selectedVariant.price_with_vat;
      item.vat_rate = selectedVariant.vat_rate;
      item.total_price = item.quantity * item.unit_price;
      this.recalculateTotals();
    }
  }

  /**
   * @description Calculates summary tax information grouped by VAT rates for invoice transparency.
   * @returns Object containing net amount, VAT breakdown, and total inclusive amount.
   */
  calculateSummaryTotals() {
    if (!this.editingOrder || !this.editingOrder.items) {
      return { baseAmount: 0, vatGroups: [], withVat: 0 };
    }

    const totalBeforeDiscount = this.editingOrder.items
      .filter(item => !item._delete)
      .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    const discountAmount = this.editingOrder.discount_amount || 0;
    const discountFactor = totalBeforeDiscount > 0
      ? (totalBeforeDiscount - discountAmount) / totalBeforeDiscount
      : 1;

    let totalBaseAfterDiscount = 0;
    const vatBreakdown: { [key: number]: number } = {};

    this.editingOrder.items.forEach(item => {
      if (!item._delete) {
        const lineTotalAfterDiscount = (item.quantity * item.unit_price) * discountFactor;
        const rate = item.vat_rate || 21;
        const itemVat = lineTotalAfterDiscount * (rate / (100 + rate));
        const itemBase = lineTotalAfterDiscount - itemVat;

        totalBaseAfterDiscount += itemBase;
        if (!vatBreakdown[rate]) vatBreakdown[rate] = 0;
        vatBreakdown[rate] += itemVat;
      }
    });

    return {
      baseAmount: totalBaseAfterDiscount,
      vatGroups: Object.keys(vatBreakdown).map(rate => ({
        rate: Number(rate),
        amount: vatBreakdown[Number(rate)]
      })),
      withVat: totalBeforeDiscount - discountAmount
    };
  }

  getCouponCode(couponId: any): string {
    if (!couponId) return '-';
    const idToFind = Number(couponId);
    const coupon = this.coupons.find(c => Number(c.id) === idToFind);
    return coupon ? coupon.code : 'N/A';
  }

  getPaymentMethodName(methodId: any): string {
    if (!methodId || methodId == 0) return '-';
    const idToFind = Number(methodId);
    const method = this.paymentMethods.find(m => Number(m.id) === idToFind);
    return method ? method.name : 'N/A';
  }

  getPaymentMethodPrice(methodId: any): number {
    if (!methodId || methodId == 0) return 0;
    const idToFind = Number(methodId);
    const method = this.paymentMethods.find(m => Number(m.id) === idToFind);
    return method ? Number(method.price) : 0;
  }

  getShippingMethodName(methodId: any): string {
    if (!methodId || methodId == 0) return '-';
    const idToFind = Number(methodId);
    const method = this.shippingMethods.find(s => Number(s.id) === idToFind);
    return method ? method.name : 'N/A';
  }

  getShippingMethodPrice(methodId: any): number {
    if (!methodId || methodId == 0) return 0;
    const idToFind = Number(methodId);
    const method = this.shippingMethods.find(s => Number(s.id) === idToFind);
    return method ? Number(method.base_price) : 0;
  }

  getCouponDisplayValue(couponOrId: any): string {
    let coupon = typeof couponOrId === 'object' ? couponOrId : null;
    if (!coupon && couponOrId) {
      const idToFind = Number(couponOrId);
      coupon = this.coupons.find(c => Number(c.id) === idToFind);
    }
    if (!coupon) return '';
    return coupon.discount_type === 'percent'
      ? `-${coupon.discount_value}%`
      : `-${this.formatCurrency(coupon.discount_value)}`;
  }

  getCouponTypeLabel(couponId: any): string {
    if (!couponId) return '';
    const idToFind = Number(couponId);
    const coupon = this.coupons.find(c => Number(c.id) === idToFind);
    if (!coupon) return '';
    return coupon.discount_type === 'percent'
      ? `${coupon.discount_value}%`
      : this.formatCurrency(coupon.discount_value);
  }

  getCouponValidationClass(): string {
    if (!this.editingOrder?.coupon_id) return '';
    return this.couponValidation.valid ? 'is-valid' : 'is-invalid';
  }

  /**
   * @description Performs form validation for order creation/updates, ensuring required billing and shipping information is provided.
   * @returns Boolean indicating if the order form is valid for submission.
   */
  private validateOrder(): boolean {
    if (!this.editingOrder) return false;

    if (this.editingOrder.coupon_id && !this.couponValidation.valid) {
      this.alertDialogService.open(this.t('coupon_error_title'), this.couponValidation.error || this.t('coupon_error_generic'), 'warning');
      return false;
    }

    if (!this.editingOrder.email) {
      this.alertDialogService.open(this.t('validation_title'), this.t('validation_email_required'), 'warning');
      return false;
    }
    if (!this.editingOrder.first_name || !this.editingOrder.last_name) {
      this.alertDialogService.open(this.t('validation_title'), this.t('validation_name_required'), 'warning');
      return false;
    }
    if (!this.editingOrder.phone) {
      this.alertDialogService.open(this.t('validation_title'), this.t('validation_phone_required'), 'warning');
      return false;
    }
    if (!this.editingOrder.payment_method_id) {
      this.alertDialogService.open(this.t('validation_title'), this.t('validation_payment_method_required'), 'warning');
      return false;
    }
    if (!this.editingOrder.shipping_method_id) {
      this.alertDialogService.open(this.t('validation_title'), this.t('validation_shipping_method_required'), 'warning');
      return false;
    }
    if (!this.editingOrder.items || this.editingOrder.items.filter(i => !i._delete).length === 0) {
      this.alertDialogService.open(this.t('validation_title'), this.t('validation_items_required'), 'warning');
      return false;
    }
    if (!this.editingOrder.shipping_address || !this.editingOrder.shipping_city || !this.editingOrder.shipping_postal_code) {
      this.alertDialogService.open(this.t('validation_title'), this.t('validation_address_required'), 'warning');
      return false;
    }
    return true;
  }

  closeOrderForm(): void {
    this.showOrderForm = false;
    this.editingOrder = null;
    this.toggleBodyScroll(false);
    this.cd.markForCheck();
  }

  getProductName(productId: number): string {
    if (!productId) return '-';
    return this.products.find(p => Number(p.id) === Number(productId))?.name || 'N/A';
  }

  /**
   * @description Formats numbers to currency strings.
   * @param value The amount to format.
   * @returns {string} Formatted EUR currency string.
   * @refactor-note (2026-09-09) BUGFIX - natvrdo `'cs-CZ'` nahrazeno
   * `this.i18n.getDateLocale()`. Měna zůstává EUR (obchodní rozhodnutí,
   * nesouvisí s jazykem UI).
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat(this.i18n.getDateLocale(), {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(value);
  }

  getStatusLabel(status: string): string {
    return this.statusOptions.find(o => o.value === status)?.label || status;
  }

  getPaymentStatusLabel(status: string): string {
    return this.paymentStatusOptions.find(o => o.value === status)?.label || status;
  }

  getVisibleItems(order: Order | null): OrderItem[] {
    return (order?.items || []).filter(i => !i._delete);
  }

  openGraphBuilder(): void {
    this.showGraphBuilder = true;
    this.cd.markForCheck();
  }

  closeGraphBuilder(): void {
    this.showGraphBuilder = false;
    this.cd.markForCheck();
  }
}