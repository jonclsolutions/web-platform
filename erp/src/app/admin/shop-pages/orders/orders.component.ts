import { Component, ViewChild, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { 
  ORDER_BUTTONS, 
  ORDER_COLUMNS, 
  TRASH_ORDER_COLUMNS, 
  FILTER_COLUMNS, 
  TOOLBAR_BUTTONS,
  STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS
} from './orders.config';
import { Order, OrderItem, Product, ProductVariant, PaymentMethod, ShippingMethod, Coupon } from './order-specific.interface';

interface CouponValidationResult {
  valid: boolean;
  error?: string;
}

type TableMode = 'all' | 'pending_tasks' | 'trash';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, SHARED_UI_BUILDERS],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersComponent extends BaseDataComponent<Order> implements OnInit, OnDestroy {
  override apiEndpoint: string = 'shop/orders';
  @ViewChild('activeTable') activeTable!: any;

  currentMode: TableMode = 'all';

  private orderTabButtons: Core.Button[] = [
    { action: 'all', label: 'Všechny objednávky', icon: '📦', class: 'btn-filter', isActive: true },
    { action: 'pending_tasks', label: 'K vyřízení', icon: '⏳', class: 'btn-filter', isActive: false },
    { action: 'trash', label: 'Koš', icon: '🗑️', class: 'btn-filter', isActive: false }
  ];

  // Data (Odebráno pole pro zákazníky)
  products: Product[] = [];
  variants: ProductVariant[] = [];
  paymentMethods: PaymentMethod[] = [];
  shippingMethods: ShippingMethod[] = [];
  coupons: Coupon[] = [];
  statusOptions = STATUS_OPTIONS;
  paymentStatusOptions = PAYMENT_STATUS_OPTIONS;

  summaryTaxAmount = 0;

  // UI State
  showOrderForm = false;
  showDetailsModal = false;
  override showTrashTable = false;
  showFiltersPanel = false;

  // Data Being Edited
  selectedOrderForDetail: Order | null = null;
  editingOrder: Order | null = null;
  editingItemIdx: number | null = null;

  couponValidation: CouponValidationResult = { valid: true };

  private isProcessing = false;

  filters: Core.FilterParams = {
    sort_by: 'created_at',
    sort_direction: 'desc'
  };

  buttons = ORDER_BUTTONS;
  orderColumns = ORDER_COLUMNS;
  trashOrderColumns = TRASH_ORDER_COLUMNS;
  filterColumns = FILTER_COLUMNS;
  toolbarButtons = TOOLBAR_BUTTONS;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router,
    private confirmDialog: ConfirmDialogService
  ) {
    super(dataHandler, cd, genericTableService);
  }

  get tabButtonsConfigs(): Core.Button[] {
    return this.orderTabButtons.map(btn => ({
      ...btn,
      isActive: this.currentMode === btn.action
    }));
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

  private toggleBodyScroll(lock: boolean): void {
    if (lock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

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

  // ========== LOAD DEPENDENCIES ==========

  private loadDependencies(): void {
    // Smazáno načítání zákazníků (loadCustomers)
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
        error: (err) => console.error('Chyba při načítání produktů:', err)
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
        error: (err) => console.error('Chyba při načítání variant:', err)
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
        error: (err) => console.error('Chyba při načítání způsobů platby:', err)
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
        error: (err) => console.error('Chyba při načítání způsobů dopravy:', err)
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
        error: (err) => console.error('Chyba při načítání kuponů:', err)
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

  // ========== TOOLBAR ACTIONS ==========

  handleToolbarAction(action: string): void {
    if (this.isProcessing) return;

    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
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

  // ========== FILTROVÁNÍ ==========

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

  // ========== DETAIL OBJEDNÁVKY ==========

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
        this.alertDialogService.open('Chyba', 'Nepodařilo se načíst detaily objednávky.', 'danger');
      }
    });
  }

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

  // ========== VYTVOŘENÍ/EDITACE OBJEDNÁVKY ==========

  handleCreateFormOpened(): void {
    if (this.isProcessing) return;

    this.couponValidation = { valid: true };
    this.editingOrder = {
      // 👤 Kontaktní údaje přidané napřímo
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      company: '',

      // 📦 Stavy
      status: 'pending',
      payment_status: 'unpaid',

      // 📍 Adresa doručení
      shipping_address: '',
      shipping_city: '',
      shipping_postal_code: '',
      shipping_country: 'Česká republika',

      // 🎫 Vazby na metody
      payment_method_id: 0,
      shipping_method_id: 0,
      coupon_id: null,

      // 💰 Finance
      total_amount: 0,      
      shipping_amount: 0,   
      tax_amount: 0,        
      discount_amount: 0,   
      final_amount: 0,      

      // 📦 Položky objednávky
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
        // 🌟 Mapování kontaktních dat ze zákazníka zpět do plochého formuláře objednávky při editaci
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
        this.alertDialogService.open('Chyba', 'Nepodařilo se načíst objednávku.', 'danger');
      }
    });
  }

  // ========== POLOŽKY OBJEDNÁVKY ==========

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

  async deleteOrderItem(index: number): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      'Smazat položku',
      'Opravdu chcete smazat tuto položku z objednávky?'
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

  // ========== VÝPOČTY A VALIDACE ==========

  validateCouponRealtime(coupon: Coupon, totalAmount: number): CouponValidationResult {
    if (!coupon) return { valid: true };
    if (!coupon.is_active) return { valid: false, error: 'Tento kupón není aktivní.' };

    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) return { valid: false, error: 'Platnost kupónu ještě nezačala.' };
    if (coupon.valid_until && new Date(coupon.valid_until) < now) return { valid: false, error: 'Platnost kupónu již vypršela.' };

    const maxUsage = coupon.max_usage ?? 0;
    if (maxUsage > 0 && (coupon.usage_count || 0) >= maxUsage) return { valid: false, error: 'Tento kupón již byl vyčepan.' };

    const minAmount = Number(coupon.min_order_amount ?? 0);
    if (minAmount > 0 && totalAmount < minAmount) {
      return { 
        valid: false, 
        error: `Minimální hodnota objednávky pro tento kupón je ${this.formatCurrency(minAmount)}.` 
      };
    }
    return { valid: true };
  }

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

  // ========== SAVE OBJEDNÁVKA ==========

 saveOrder(): void {
    if (this.isProcessing || !this.editingOrder || !this.validateOrder()) return;

    this.isProcessing = true;
    
    // 🌟 PŘEBUDOVANÝ PAYLOAD: Posíláme striktně plochá data zákazníka
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
      // Pro update přidáme delete_items a použijeme PUT spoofing přes POST
      payload.delete_items = (this.editingOrder.items || [])
        .filter(i => i._delete && i.id)
        .map(i => i.id!);
        
      request = this.dataHandler.post(`${this.apiEndpoint}/${this.editingOrder.id}`, {
        ...payload,
        _method: 'PUT'
      });
    } else {
      // 🚨 PRO JISTOTU: Odstraníme jakýkoliv pozůstatek customer_id při zakládání
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
        this.alertDialogService.open('Úspěch', 'Objednávka byla uložena.', 'success');
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
              console.error('Nepodařilo se zaktualizovat data v detailu objednávky.');
            }
          });
        }
      },
      error: (err) => {
        // Zde vypíšeme detailní chyby z Laravelu do konzole, abychom viděli přesný breakdown
        console.error('Chyba validace z backendu:', err.error);
        const message = err.error?.message || 'Chyba při ukládání objednávky.';
        this.alertDialogService.open('Chyba', message, 'danger');
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

  // ========== HELPERS ==========

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

  private validateOrder(): boolean {
    if (!this.editingOrder) return false;

    if (this.editingOrder.coupon_id && !this.couponValidation.valid) {
      this.alertDialogService.open('Chyba kupónu', this.couponValidation.error || 'Kupón není platný.', 'warning');
      return false;
    }
    
    // 🌟 UPRAVENÁ VALIDACE: Místo customer_id kontrolujeme nová textová pole
    if (!this.editingOrder.email) {
      this.alertDialogService.open('Validace', 'Zadejte e-mailovou adresu.', 'warning');
      return false;
    }
    if (!this.editingOrder.first_name || !this.editingOrder.last_name) {
      this.alertDialogService.open('Validace', 'Vyplňte jméno a příjmení zákazníka.', 'warning');
      return false;
    }
    if (!this.editingOrder.phone) {
      this.alertDialogService.open('Validace', 'Zadejte telefonní číslo.', 'warning');
      return false;
    }
    if (!this.editingOrder.payment_method_id) {
      this.alertDialogService.open('Validace', 'Vyberte způsob platby.', 'warning');
      return false;
    }
    if (!this.editingOrder.shipping_method_id) {
      this.alertDialogService.open('Validace', 'Vyberte způsob dopravy.', 'warning');
      return false;
    }
    if (!this.editingOrder.items || this.editingOrder.items.filter(i => !i._delete).length === 0) {
      this.alertDialogService.open('Validace', 'Objednávka musí obsahovat alespoň jednu položku.', 'warning');
      return false;
    }
    if (!this.editingOrder.shipping_address || !this.editingOrder.shipping_city || !this.editingOrder.shipping_postal_code) {
      this.alertDialogService.open('Validace', 'Kompletně vyplňte adresu doručení.', 'warning');
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

formatCurrency(value: number): string {
  return new Intl.NumberFormat('cs-CZ', {
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
}