import { Component, ViewChild, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { PRODUCT_BUTTONS, PRODUCT_COLUMNS, TRASH_PRODUCT_COLUMNS, FILTER_COLUMNS, TOOLBAR_BUTTONS, PRODUCT_FORM_FIELDS } from './products.config';
import { Variant, ProductImage, Category, Supplier, Product } from './product-specific.interface';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, SHARED_UI_BUILDERS],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsComponent extends BaseDataComponent<Product> implements OnInit, OnDestroy {
  override apiEndpoint: string = 'shop/products';
  @ViewChild('activeTable') activeTable!: any;
  
  categories: Category[] = [];
  suppliers: Supplier[] = [];

  showProductForm = false;
  showVariantsModal = false;
  showImagesModal = false;
  showDetailsModal = false;
  override showTrashTable = false;
  showFiltersPanel = false;

  selectedProductForDetail: any = null;
  selectedProduct: Product | null = null;
  editingProduct: any = null;
  editingVariantIdx: number | null = null;
  editingVariantImages: ProductImage[] = [];

  // 1. PŘIDEJ PROSTŘEDNÍK PRO DATA KOŠE DO KLASY (k ostatním show... proměnným)
  override trashData: Product[] = [];
  private isProcessing = false;

  filters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };

  buttons = PRODUCT_BUTTONS;
  productColumns = PRODUCT_COLUMNS;
  trashProductColumns = TRASH_PRODUCT_COLUMNS;
  filterColumns = FILTER_COLUMNS;
  toolbarButtons = TOOLBAR_BUTTONS;
  formFields: any[] = [];
  // Pole aktuálně vybraných objektů kategorií pro zobrazení čipů ve formuláři
  selectedFormCategories: Category[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router,
    private confirmDialog: ConfirmDialogService
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
    this.formFields = JSON.parse(JSON.stringify(PRODUCT_FORM_FIELDS));
    this.loadCategories();
    this.loadSuppliers();
    this.refreshData();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.toggleBodyScroll(false);
  }

  // ========== ASYNCHRONNÍ TRANSFORMACE DAT PRO PLOCHÉ KLÍČE TABULKY ==========
override fetchPaginatedData(
    isTrash: boolean, 
    page: number, 
    perPage: number, 
    filters: Core.FilterParams
  ): Core.Observable<Core.PaginatedResponse<Product>> {
    
    return super.fetchPaginatedData(isTrash, page, perPage, filters).pipe(
      Core.map((response: Core.PaginatedResponse<Product>) => {
        if (response && response.data) {
          response.data = response.data.map((product: any) => {
            
            // Bezpečné mapování cen na sjednocené ploché klíče bez _flat
            if (product.prices) {
              product.price_czk = product.prices.price_czk_with_vat ?? 0;
              product.price_eur = product.prices.price_eur_with_vat ?? 0;
            } else {
              product.price_czk = 0;
              product.price_eur = 0;
            }

            product.category_name = product.category ? product.category.name : '-';
            product.supplier_name = product.supplier ? product.supplier.name : '-';

            return product;
          });

          // FIX: Rozdělení kam se data uloží podle toho, zda načítáme koš nebo aktivní data
          if (isTrash) {
            this.trashData = response.data;
          } else {
            this.data = response.data;
          }
        }
        return response;
      }),
      Core.tap(() => {
        this.cd.markForCheck();
      })
    );
  }

  private toggleBodyScroll(lock: boolean): void {
    if (lock) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  // ========== TOOLBAR ACTIONS ==========

  handleToolbarAction(action: string): void {
console.log('Kliknuto na akci z toolbaru:', action);
    if (this.isProcessing) return;
    
    const actions: { [key: string]: () => void } = {
      
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      toggleTrash: () => this.toggleTrash(),
      exportActiveTable: () => this.exportActiveTable()
    };
    
    if (actions[action]) actions[action]();
  }

  getTrashToolbarButtons(): any[] {
    return this.toolbarButtons.filter(btn => 
      btn.action !== 'handleCreateFormOpened' && 
      btn.action !== 'exportActiveTable'
    );
  }

  exportActiveTable(): void {
    if (this.activeTable) {
      this.activeTable.exportToCSV();
    } else {
      console.error('Nebyla nalezena aktivní tabulka pro export.');
    }
  }

  override toggleFilters(): void {
    this.showFiltersPanel = !this.showFiltersPanel;
    this.cd.markForCheck();
  }

toggleTrash(): void {
    this.showTrashTable = !this.showTrashTable;
    if (this.showTrashTable) {
      const trashFilters = { ...this.filters, only_trashed: 'true' };
      this.forceFullRefresh(trashFilters);
    } else {
      this.refreshData();
    }
    this.cd.markForCheck(); // Zajistí, že Angular ihned zareaguje na změnu showTrashTable
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
    this.filters = { sort_by: 'id', sort_direction: 'desc' };
    this.refreshData();
  }

  handlePageChange(page: number): void {
    this.onHandlePageChange(page, this.filters);
  }

  handleItemsPerPageChange(value: number): void {
    this.onHandleItemsPerPageChange(value, this.filters);
  }

  // ========== KATEGORIE & DODAVATELÉ ==========

  private loadCategories(): void {
    this.dataHandler.getCollection<Category>('shop/categories?no_pagination=true')
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.categories = data;
          this.updateFormFieldsOptions();
          this.cd.markForCheck();
        },
        error: (err) => console.error('Chyba při načítání kategorií:', err)
      });
  }

  private loadSuppliers(): void {
    this.dataHandler.getCollection<Supplier>('shop/suppliers?no_pagination=true')
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.suppliers = data;
          this.updateFormFieldsOptions();
          this.cd.markForCheck();
        },
        error: (err) => console.error('Chyba při načítání dodavatelů:', err)
      });
  }

  private updateFormFieldsOptions(): void {
    this.formFields.forEach(field => {
      if (field.column_name === 'category_id') {
        field.options = this.categories.map(c => ({ value: c.id, label: c.name }));
      }
      if (field.column_name === 'supplier_id') {
        field.options = this.suppliers.map(s => ({ value: s.id, label: s.name }));
      }
    });

    this.filterColumns.forEach(filter => {
      if (filter.key === 'category_id') {
        filter.options = this.categories.map(c => ({ value: c.id, label: c.name }));
      }
      if (filter.key === 'supplier_id') {
        filter.options = this.suppliers.map(s => ({ value: s.id, label: s.name }));
      }
    });
  }

  // ========== DETAIL PRODUKTU ==========

  handleViewDetails(item: any): void {
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
      next: (fullProduct: any) => {
        if (fullProduct.prices) {
          fullProduct.price_czk = fullProduct.prices.price_czk_with_vat || 0;
          fullProduct.cost_price_czk = fullProduct.prices.cost_price_czk || 0;
          fullProduct.price_eur = fullProduct.prices.price_eur_with_vat || 0;
          fullProduct.cost_price_eur = fullProduct.prices.cost_price_eur || 0;
        }
        
        fullProduct.category_name = fullProduct.category ? fullProduct.category.name : '-';
        fullProduct.supplier_name = fullProduct.supplier ? fullProduct.supplier.name : '-';

        if (fullProduct.variants) {
          fullProduct.variants = fullProduct.variants.map((v: any) => ({
            ...v,
            vat_rate: v.prices?.vat_rate ?? v.vat_rate ?? 21,
            price_with_vat_czk: v.prices?.price_czk_with_vat ?? v.price_with_vat_czk ?? 0,
            price_without_vat_czk: v.prices?.price_czk_without_vat ?? v.price_without_vat_czk ?? 0,
            price_with_vat_eur: v.prices?.price_eur_with_vat ?? v.price_with_vat_eur ?? 0,
            price_without_vat_eur: v.prices?.price_eur_without_vat ?? v.price_without_vat_eur ?? 0,
          }));
        }

        this.selectedProductForDetail = fullProduct;
        this.showDetailsModal = true;
        this.toggleBodyScroll(true);
        this.cd.markForCheck();
      },
      error: () => {
        this.alertDialogService.open('Chyba', 'Nepodařilo se načíst detaily.', 'danger');
      }
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedProductForDetail = null;
    this.toggleBodyScroll(false);
    this.cd.markForCheck();
  }

  // ========== EDITACE PRODUKTU ==========

 openEditProductForm(product: Product, event?: Event): void {
  if (event) event.stopPropagation();
  if (this.isProcessing || !product.id) return;

  this.isProcessing = true;
  this.loadingService.show();
  
  this.getItemDetails(product.id).pipe(
    Core.finalize(() => {
      this.loadingService.hide();
      this.isProcessing = false;
      this.cd.markForCheck();
    }),
    Core.takeUntil(this.destroy$)
  ).subscribe({
    next: (fullProduct: any) => {
      if (fullProduct.prices) {
        fullProduct.price_czk = fullProduct.prices.price_czk_with_vat || 0;
        fullProduct.price_eur = fullProduct.prices.price_eur_with_vat || 0;
        
        // 🌟 DOPLŇ TYTO DVA ŘÁDKY SEM:
        fullProduct.cost_price_czk = fullProduct.prices.cost_price_czk || 0;
        fullProduct.cost_price_eur = fullProduct.prices.cost_price_eur || 0;
      }

      if (fullProduct.variants) {
        fullProduct.variants = fullProduct.variants.map((v: any) => ({
          ...v,
          vat_rate: v.prices?.vat_rate ?? v.vat_rate ?? 21,
          price_with_vat_czk: v.prices?.price_czk_with_vat ?? v.price_with_vat_czk ?? 0,
          price_without_vat_czk: v.prices?.price_czk_without_vat ?? v.price_without_vat_czk ?? 0,
          price_with_vat_eur: v.prices?.price_eur_with_vat ?? v.price_with_vat_eur ?? 0,
          price_without_vat_eur: v.prices?.price_eur_without_vat ?? v.price_without_vat_eur ?? 0,
          // 🌟 POKUD MÁŠ POŘIZOVACÍ CENY I U VARIANT, DOPLŇ JE I SEM:
          cost_price_czk: v.prices?.cost_price_czk ?? 0,
          cost_price_eur: v.prices?.cost_price_eur ?? 0,
        }));
      }

      this.editingProduct = { ...fullProduct };
      this.updateFormFieldsOptions();
      this.showProductForm = true;
      this.toggleBodyScroll(true);
      this.cd.markForCheck();
    },
    error: () => {
      this.alertDialogService.open('Chyba', 'Nepodařilo se načíst detail produktu.', 'danger');
    }
  });
}




  openVariantsModal(product: Product, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.selectedProduct = product;
    this.loadingService.show();
    
    this.getItemDetails(product.id).pipe(
      Core.finalize(() => {
        this.loadingService.hide();
        this.isProcessing = false;
        this.cd.markForCheck();
      }),
      Core.takeUntil(this.destroy$)
    ).subscribe({
      next: (fullProduct: any) => {
        if (fullProduct.prices) {
          fullProduct.price_czk = fullProduct.prices.price_czk_with_vat || 0;
          fullProduct.cost_price_czk = fullProduct.prices.cost_price_czk || 0;
          fullProduct.price_eur = fullProduct.prices.price_eur_with_vat || 0;
          fullProduct.cost_price_eur = fullProduct.prices.cost_price_eur || 0;
        }

        if (fullProduct.variants) {
          fullProduct.variants = fullProduct.variants.map((v: any) => ({
            ...v,
            vat_rate: v.prices?.vat_rate ?? v.vat_rate ?? 21,
            price_with_vat_czk: v.prices?.price_czk_with_vat ?? v.price_with_vat_czk ?? 0,
            price_without_vat_czk: v.prices?.price_czk_without_vat ?? v.price_without_vat_czk ?? 0,
            price_with_vat_eur: v.prices?.price_eur_with_vat ?? v.price_with_vat_eur ?? 0,
            price_without_vat_eur: v.prices?.price_eur_without_vat ?? v.price_without_vat_eur ?? 0,
          }));
        }
        this.editingProduct = { ...fullProduct };
        this.showVariantsModal = true;
        this.toggleBodyScroll(true);
        this.cd.markForCheck();
      },
      error: () => {
        this.isProcessing = false;
        this.alertDialogService.open('Chyba', 'Nepodařilo se načíst produkt.', 'danger');
      }
    });
  }

  // ========== VARIANTY ==========

  addVariant(): void {
    if (!this.editingProduct) return;
    if (!this.editingProduct.variants) {
      this.editingProduct.variants = [];
    }
    this.editingProduct.variants.push({
      variant_name: '',
      attribute_1_name: '',
      attribute_1_value: '',
      attribute_2_name: '',
      attribute_2_value: '',
      sku_variant: '',
      price_with_vat_czk: 0,
      price_without_vat_czk: 0,
      price_with_vat_eur: 0,
      price_without_vat_eur: 0,
      vat_rate: 21,
      stock_quantity: 0,
      images: []
    });
    this.cd.markForCheck();
  }

  async deleteVariant(index: number): Promise<void> {
    if (!this.editingProduct?.variants) return;
    const variant = this.editingProduct.variants[index];

    const confirmed = await this.confirmDialog.open(
      'Smazat variantu', 
      `Opravdu chcete smazat variantu ${variant.variant_name || ''}?`
    );

    if (confirmed) {
      if (variant.id) {
        variant._delete = true;
      } else {
        this.editingProduct.variants.splice(index, 1);
      }
      this.cd.markForCheck();
    }
  }

  editVariantImages(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingVariantIdx = index;
    const variant = this.editingProduct?.variants?.[index];
    if (variant) {
      this.editingVariantImages = JSON.parse(JSON.stringify(variant.images || []));
    } else {
      this.editingVariantImages = [];
    }
    this.cd.markForCheck();
  }

  addVariantImage(): void {
    this.editingVariantImages.push({
      image_path: '',
      alt_text: '',
      is_primary: false,
      sort_order: this.editingVariantImages.length,
      file: undefined
    });
    this.cd.markForCheck();
  }

  deleteVariantImage(index: number): void {
    const img = this.editingVariantImages[index];
    if (img.id) {
      img._delete = true;
    } else {
      this.editingVariantImages.splice(index, 1);
    }
    this.cd.markForCheck();
  }

  onFileSelected(event: any, index: number): void {
    const file: File = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.alertDialogService.open('Příliš velký soubor', 'Obrázek může mít maximálně 5MB.', 'warning');
      event.target.value = '';
      return;
    }

    if (this.editingProduct?.images) {
      this.editingProduct.images[index].file = file;
      this.editingProduct.images[index].image_path = file.name;
      
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.editingProduct!.images![index].url = e.target.result;
        this.cd.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  onVariantImageFileSelected(event: any, index: number): void {
    const file: File = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.alertDialogService.open('Příliš velký soubor', 'Obrázek může mít maximálně 5MB.', 'warning');
      event.target.value = '';
      return;
    }

    if (this.editingVariantImages[index]) {
      this.editingVariantImages[index].file = file; 
      this.editingVariantImages[index].image_path = file.name;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.editingVariantImages[index].url = e.target.result;
        this.cd.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  get currentEditingVariant() {
    if (this.editingVariantIdx === null || !this.editingProduct?.variants) return null;
    return this.editingProduct.variants[this.editingVariantIdx];
  }

  saveVariantImages(): void {
    if (this.editingVariantIdx !== null && this.editingProduct?.variants?.[this.editingVariantIdx]) {
      this.editingProduct.variants[this.editingVariantIdx].images = this.editingVariantImages.map(img => ({
        ...img,
        variant_id: this.editingProduct?.variants?.[this.editingVariantIdx!]?.id 
      }));

      this.editingVariantIdx = null;
      this.editingVariantImages = [];
      this.cd.markForCheck();
    }
  }

  closeVariantsModal(): void {
    this.showVariantsModal = false;
    this.toggleBodyScroll(false);
    this.editingVariantIdx = null;
    this.editingVariantImages = [];
    this.cd.markForCheck();
  }

  // ========== DPH VÝPOČTY (Automatické dopočítání bez DPH) ==========

  onVATRateChange(variant: any): void {
    this.calculatePriceWithoutVAT(variant);
    this.cd.markForCheck();
  }

  onPriceWithVATChange(variant: any): void {
    this.calculatePriceWithoutVAT(variant);
    this.cd.markForCheck();
  }

  onMainPriceWithVATChange(): void {
    if (this.editingProduct) {
      this.calculateMainPriceWithoutVAT();
      this.cd.markForCheck();
    }
  }

  onMainVATRateChange(): void {
    if (this.editingProduct) {
      this.calculateMainPriceWithoutVAT();
      this.cd.markForCheck();
    }
  }

  private calculatePriceWithoutVAT(variant: any): void {
    if (variant.vat_rate !== undefined && variant.vat_rate !== null) {
      const rate = 1 + (variant.vat_rate / 100);
      
      if (variant.price_with_vat_czk) {
        variant.price_without_vat_czk = Math.round((variant.price_with_vat_czk / rate) * 100) / 100;
      } else {
        variant.price_without_vat_czk = 0;
      }
      
      if (variant.price_with_vat_eur) {
        variant.price_without_vat_eur = Math.round((variant.price_with_vat_eur / rate) * 100) / 100;
      } else {
        variant.price_without_vat_eur = 0;
      }
    }
  }

  private calculateMainPriceWithoutVAT(): void {
    // Cena hlavního produktu se počítá z prvé aktivní varianty, ale může se upravit i přímo
    if (this.editingProduct.prices) {
      const vat = this.editingProduct.prices.vat_rate ?? 21;
      const rate = 1 + (vat / 100);
      
      // Není aktivní u variant, tak se počítá samo
      if (this.editingProduct.price_czk) {
        // Kontrola, abychom neukazili kalkulaci bez DPH, pokud zadáme bez DPH
        const priceCzk = this.editingProduct.price_czk;
        // Tady si uchovejte cenu bez DPH z backendu, pokud existuje
      }
    }
  }

  // ========== OBRÁZKY PRODUKTU ==========

  openImagesModal(product: Product, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.selectedProduct = product;
    this.loadingService.show();
    
    this.getItemDetails(product.id).pipe(
      Core.finalize(() => {
        this.loadingService.hide();
        this.isProcessing = false;
        this.cd.markForCheck();
      }),
      Core.takeUntil(this.destroy$)
    ).subscribe({
      next: (fullProduct: any) => {
        if (fullProduct.prices) {
          fullProduct.price_czk = fullProduct.prices.price_czk_with_vat || 0;
          fullProduct.cost_price_czk = fullProduct.prices.cost_price_czk || 0;
          fullProduct.price_eur = fullProduct.prices.price_eur_with_vat || 0;
          fullProduct.cost_price_eur = fullProduct.prices.cost_price_eur || 0;
        }

        this.editingProduct = { ...fullProduct };
        this.showImagesModal = true;
        this.toggleBodyScroll(true);
        this.cd.markForCheck();
      },
      error: () => {
        this.isProcessing = false;
        this.alertDialogService.open('Chyba', 'Nepodařilo se načíst produkt.', 'danger');
      }
    });
  }

  addImage(): void {
    if (!this.editingProduct) return;
    if (!this.editingProduct.images) {
      this.editingProduct.images = [];
    }
    this.editingProduct.images.push({
      image_path: '',
      alt_text: '',
      is_primary: this.editingProduct.images.filter((img: any) => !img.variant_id).length === 0,
      sort_order: this.editingProduct.images.filter((img: any) => !img.variant_id).length,
      file: undefined
    });
    this.cd.markForCheck();
  }

  async deleteImage(index: number): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      'Smazat obrázek', 
      'Opravdu si přejete odstranit tento obrázek?'
    );

    if (confirmed && this.editingProduct?.images) {
      const image = this.editingProduct.images[index];
      if (image.id) {
        image._delete = true;
      } else {
        this.editingProduct.images.splice(index, 1);
      }
      this.editingProduct.images.forEach((img: any, idx: number) => {
        if (!img._delete && !img.variant_id) img.sort_order = idx;
      });
      this.cd.markForCheck();
    }
  }

  setPrimaryImage(index: number): void {
    if (!this.editingProduct?.images) return;
    this.editingProduct.images.forEach((img: any, idx: number) => {
      img.is_primary = idx === index && !img.variant_id;
    });
    this.cd.markForCheck();
  }

  closeImagesModal(): void {
    this.showImagesModal = false;
    this.toggleBodyScroll(false);
    this.cd.markForCheck();
  }

  // ========== HELPERS ==========
validateProduct(): boolean {
    if (!this.editingProduct) return false;

    // 1. Validace názvu
    if (!this.editingProduct.name || this.editingProduct.name.trim().length === 0) {
      this.alertDialogService.open('Validace', 'Zadejte název produktu.', 'warning');
      return false;
    }

    // Pokud se validuje pouze v rámci modálního okna obrázků, zbytek přeskočíme
    if (this.showImagesModal) {
      return true;
    }

    const activeVariants = (this.editingProduct.variants || []).filter((v: Variant) => !v._delete);
    
    // 2. Validace variant, pokud je otevřené modální okno variant
    if (this.showVariantsModal) {
      for (const variant of activeVariants) {
        if (!variant.variant_name) {
          this.alertDialogService.open('Validace', 'Všechny aktivní varianty musí mít název.', 'warning');
          return false;
        }
        
        // Legitimní kontrola cen zanořených v objektu prices, nebo přímo ve variantě
        const priceCzk = variant.prices?.price_czk_with_vat ?? variant.price_with_vat_czk;
        const priceEur = variant.prices?.price_eur_with_vat ?? variant.price_with_vat_eur;

        if (priceCzk === undefined || priceCzk === null || priceCzk <= 0) {
          this.alertDialogService.open('Validace', `Varianta "${variant.variant_name}" musí mít cenu v CZK > 0.`, 'warning');
          return false;
        }
        if (priceEur === undefined || priceEur === null || priceEur <= 0) {
          this.alertDialogService.open('Validace', `Varianta "${variant.variant_name}" musí mít cenu v EUR > 0.`, 'warning');
          return false;
        }
      }
      return true;
    }

    // 3. Validace cen hlavního produktu (pokud produkt nemá varianty) nebo vnitřku variant při hlavním uložení
    if (activeVariants.length === 0) {
      if (!this.editingProduct.price_czk || this.editingProduct.price_czk <= 0) {
        this.alertDialogService.open('Validace', 'Cena v CZK musí být > 0.', 'warning');
        return false;
      }

      if (!this.editingProduct.price_eur || this.editingProduct.price_eur <= 0) {
        this.alertDialogService.open('Validace', 'Cena v EUR musí být > 0.', 'warning');
        return false;
      }
    } else {
      for (const variant of activeVariants) {
        if (!variant.variant_name) {
          this.alertDialogService.open('Validace', 'Všechny aktivní varianty musí mít název.', 'warning');
          return false;
        }

        // Legitimní kontrola cen zanořených v objektu prices, nebo přímo ve variantě
        const priceCzk = variant.prices?.price_czk_with_vat ?? variant.price_with_vat_czk;
        const priceEur = variant.prices?.price_eur_with_vat ?? variant.price_with_vat_eur;

        if (priceCzk === undefined || priceCzk === null || priceCzk <= 0) {
          this.alertDialogService.open('Validace', `Varianta "${variant.variant_name}" musí mít cenu v CZK > 0.`, 'warning');
          return false;
        }
        if (priceEur === undefined || priceEur === null || priceEur <= 0) {
          this.alertDialogService.open('Validace', `Varianta "${variant.variant_name}" musí mít cenu v EUR > 0.`, 'warning');
          return false;
        }
      }
    }

    // 4. Validace SKU
    if (!this.editingProduct.sku || this.editingProduct.sku.trim().length === 0) {
      this.alertDialogService.open('Validace', 'Zadejte SKU produktu.', 'warning');
      return false;
    }

    // 5. Validace kategorií byla upravena na dobrovolnou (kontrola proběhne jen, pokud je vybrána neplatná hodnota)
    if (this.editingProduct.category_id && this.editingProduct.category_id < 0) {
      this.alertDialogService.open('Validace', 'Zvolená hlavní kategorie je neplatná.', 'warning');
      return false;
    }

    return true;
  }

saveProduct(): void {
    if (!this.editingProduct) return;

    if (!this.validateProduct()) {
      return;
    }

    // 🛑 VALIDACE: Pokud produkt nemá žádnou kategorii, nesmí být aktivní
    const hasMainCategory = this.editingProduct.category_id && this.editingProduct.category_id > 0;
    const hasAdditionalCategories = this.selectedFormCategories && this.selectedFormCategories.length > 0;
    const hasAnyCategory = hasMainCategory || hasAdditionalCategories;

    if (this.editingProduct.is_active && !hasAnyCategory) {
      this.alertDialogService.open(
        'Validace', 
        'Produkt nelze nastavit jako aktivní, pokud nemá přiřazenou žádnou kategorii.', 
        'warning'
      );
      return;
    }

    const formData = new FormData();

    // Přidání základních vlastností
    formData.append('name', this.editingProduct.name || '');
    formData.append('slug', this.editingProduct.slug || this.generateSlug(this.editingProduct.name || ''));
    formData.append('sku', this.editingProduct.sku || '');
    formData.append('short_description', this.editingProduct.short_description || '');
    formData.append('description', this.editingProduct.description || '');
    formData.append('stock_warning_level', String(this.editingProduct.stock_warning_level || 0));
    
    // Pojistka pro odesílání stavu aktivity (pokud nemá kategorii, pošle se 0)
    formData.append('is_active', (this.editingProduct.is_active && hasAnyCategory) ? '1' : '0');
    formData.append('is_featured', this.editingProduct.is_featured ? '1' : '0');
    
    if (this.editingProduct.supplier_id) {
      formData.append('supplier_id', String(this.editingProduct.supplier_id));
    }

    // 🔄 OPRAVENO: Kategorie se nyní posílají VŽDY, aby backend věděl, že se mají smazat
    if (hasMainCategory) {
      formData.append('category_id', String(this.editingProduct.category_id));
    } else {
      formData.append('category_id', ''); // Explicitní vymazání hlavní kategorie pro backend
    }

    if (hasAdditionalCategories) {
      this.selectedFormCategories.forEach((cat) => {
        formData.append('category_ids[]', String(cat.id));
      });
    } else {
      formData.append('category_ids', ''); // Explicitní vymazání vedlejších kategorií pro backend
    }

    // --- DOPLNĚNÍ VÝPOČTU CENY BEZ DPH PRO HLAVNÍ PRODUKT ---
    const vatRate = this.editingProduct.vat_rate ?? 21;
    const priceWithVatCzk = this.editingProduct.price_czk || 0;
    const priceWithoutVatCzk = Math.round((priceWithVatCzk / (1 + (vatRate / 100))) * 100) / 100;

    const priceWithVatEur = this.editingProduct.price_eur || 0;
    const priceWithoutVatEur = Math.round((priceWithVatEur / (1 + (vatRate / 100))) * 100) / 100;

    // Odeslání cen hlavního produktu včetně parametrů vyžadovaných backendem
    formData.append('prices[vat_rate]', String(vatRate));
    formData.append('prices[price_czk_with_vat]', String(priceWithVatCzk));
    formData.append('prices[price_czk_without_vat]', String(priceWithoutVatCzk));
    formData.append('prices[cost_price_czk]', String(this.editingProduct.cost_price_czk || 0));
    formData.append('prices[price_eur_with_vat]', String(priceWithVatEur));
    formData.append('prices[price_eur_without_vat]', String(priceWithoutVatEur));
    formData.append('prices[cost_price_eur]', String(this.editingProduct.cost_price_eur || 0));

    // Zpracování obrázků hlavního produktu
    if (this.editingProduct.images) {
      this.editingProduct.images.forEach((img: ProductImage, idx: number) => {
        if (img.id) formData.append(`images[${idx}][id]`, String(img.id));
        if (img.file) formData.append(`images[${idx}][file]`, img.file);
        formData.append(`images[${idx}][alt_text]`, img.alt_text || '');
        formData.append(`images[${idx}][sort_order]`, String(img.sort_order || 0));
        formData.append(`images[${idx}][is_primary]`, img.is_primary ? '1' : '0');
        if (img._delete) formData.append('delete_images[]', String(img.id));
      });
    }

    // Zpracování variant
    if (this.editingProduct.variants) {
      const activeVariants = this.editingProduct.variants.filter((v: Variant) => !v._delete);
      activeVariants.forEach((v: any, idx: number) => {
        if (v.id) formData.append(`variants[${idx}][id]`, String(v.id));
        formData.append(`variants[${idx}][variant_name]`, v.variant_name || '');
        formData.append(`variants[${idx}][attribute_1_name]`, v.attribute_1_name || '');
        formData.append(`variants[${idx}][attribute_1_value]`, v.attribute_1_value || '');
        formData.append(`variants[${idx}][attribute_2_name]`, v.attribute_2_name || '');
        formData.append(`variants[${idx}][attribute_2_value]`, v.attribute_2_value || '');
        formData.append(`variants[${idx}][sku_variant]`, v.sku_variant || '');
        formData.append(`variants[${idx}][stock_quantity]`, String(v.stock_quantity || 0));
        
        const variantVatRate = v.vat_rate ?? v.prices?.vat_rate ?? vatRate;
        
        // 🛡️ BEZPEČNÁ DEFRAKCE CEN VARIANT
        const vPriceCzkWithVat    = v.price_with_vat_czk    ?? v.prices?.price_czk_with_vat    ?? 0;
        const vPriceCzkWithoutVat = v.price_without_vat_czk ?? v.prices?.price_czk_without_vat ?? 0;
        const vPriceEurWithVat    = v.price_with_vat_eur    ?? v.prices?.price_eur_with_vat    ?? 0;
        const vPriceEurWithoutVat = v.price_without_vat_eur ?? v.prices?.price_eur_without_vat ?? 0;

        formData.append(`variants[${idx}][prices][vat_rate]`, String(variantVatRate));
        formData.append(`variants[${idx}][prices][price_czk_with_vat]`, String(vPriceCzkWithVat));
        formData.append(`variants[${idx}][prices][price_czk_without_vat]`, String(vPriceCzkWithoutVat));
        formData.append(`variants[${idx}][prices][price_eur_with_vat]`, String(vPriceEurWithVat));
        formData.append(`variants[${idx}][prices][price_eur_without_vat]`, String(vPriceEurWithoutVat));

        if (v.images) {
          v.images.forEach((img: ProductImage, imgIdx: number) => {
            if (img.id) formData.append(`variants[${idx}][images][${imgIdx}][id]`, String(img.id));
            if (img.file) formData.append(`variants[${idx}][images][${imgIdx}][file]`, img.file);
            formData.append(`variants[${idx}][images][${imgIdx}][alt_text]`, img.alt_text || '');
            formData.append(`variants[${idx}][images][${imgIdx}][sort_order]`, String(img.sort_order || 0));
            if (img._delete) formData.append(`variants[${idx}][delete_images][]`, String(img.id));
          });
        }
      });

      this.editingProduct.variants.forEach((v: Variant) => {
        if (v._delete && v.id) formData.append('delete_variants[]', String(v.id));
      });
    }

    if (this.editingProduct.id) {
      formData.append('_method', 'PUT');
    }

    // 🔍 LOGOVÁNÍ PAYLOADU (Zobrazení obsahu FormData v konzoli)
    console.log('=== KONTROLA ODCHÁZEJÍCÍHO PAYLOADU (FormData) ===');
    const payloadLog: { [key: string]: any } = {};
    formData.forEach((value, key) => {
      // Pokud je hodnotou soubor, zalogujeme jen detaily o souboru, ne binární kód
      if (value instanceof File) {
        payloadLog[key] = `[Soubor: ${value.name}, Velikost: ${value.size}b, Typ: ${value.type}]`;
      } else {
        payloadLog[key] = value;
      }
    });
    console.table(payloadLog); // Vytvoří přehlednou tabulku v konzoli prohlížeče
    console.log('==================================================');

    const url = this.editingProduct.id ? `${this.apiEndpoint}/${this.editingProduct.id}` : this.apiEndpoint;
    
    this.dataHandler.post<any>(url, formData).subscribe({
      next: () => {
        this.alertDialogService.open('Úspěch', 'Produkt byl úspěšně uložen.', 'success');
        this.closeProductForm();
        this.closeVariantsModal();
        this.closeImagesModal();
        this.refreshData();
      },
      error: (err: any) => {
        console.error('Chyba uložení produktu:', err);
        this.alertDialogService.open('Chyba', 'Uložení produktu selhalo.');
      }
    });
  }
  public generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  getSupplierName(supplierId?: number): string {
    if (!supplierId) return '-';
    return this.suppliers.find(s => s.id === supplierId)?.name || 'N/A';
  }

  formatCurrency(value: number, currency: string = 'CZK'): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: currency
    }).format(value);
  }

  getVisibleVariants(product: any): any[] {
    return (product?.variants || []).filter((v: any) => !v._delete);
  }

  getVisibleImages(product: any, variantId?: number): ProductImage[] {
    const images = product?.images || [];
    return variantId
      ? images.filter((img: any) => !img._delete && img.image_path && img.variant_id === variantId)
      : images.filter((img: any) => !img._delete && !img.variant_id);
  }

  private formatErrorMessage(err: any): string {
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    if (typeof err === 'object') {
      return Object.values(err).flat().join(', ');
    }
    return 'Neznámá chyba';
  }
  /**
   * Vrátí seznam kategorií, které ještě produkt přiřazené nemá (pro naplnění přidávacího selectu)
   */
  getAvailableCategoriesForForm(): Category[] {
    return this.categories.filter(cat => 
      !this.selectedFormCategories.some(selected => selected.id === cat.id)
    );
  }

  /**
   * Zpracuje výběr z dropdownu a přidá kategorii do seznamu
   */
/**
   * ✅ OPRAVENO: Zpracuje výběr kategorie přímo z HTML elementu a bezpečně vynuluje select
   */
  addCategoryToForm(selectElement: HTMLSelectElement): void {
    const categoryId = Number(selectElement.value);
    
    if (categoryId <= 0) return;
    
    const categoryObj = this.categories.find(c => c.id === categoryId);
    if (categoryObj && !this.selectedFormCategories.some(c => c.id === categoryId)) {
      this.selectedFormCategories.push(categoryObj);
      
      // Pokud produkt dosud neměl žádnou hlavní kategorii, nastavíme tuto jako hlavní
      if (!this.editingProduct || !this.editingProduct.category_id || this.editingProduct.category_id === 0) {
        if (this.editingProduct) {
          this.editingProduct.category_id = categoryId;
        }
      }
    }

    // Bezpečné vynulování dropdownu zpět na placeholder přímo z kódu
    selectElement.value = '0';
    this.cd.markForCheck();
  }

  /**
   * Odebere kategorii ze seznamu vybraných
   */
  removeCategoryFromForm(categoryId: number): void {
    this.selectedFormCategories = this.selectedFormCategories.filter(c => c.id !== categoryId);
    
    // Pokud jsme odebrali kategorii, která byla nastavená jako hlavní
    if (this.editingProduct.category_id === categoryId) {
      if (this.selectedFormCategories.length > 0) {
        // Automaticky nastavíme jako hlavní první zbývající
        this.editingProduct.category_id = this.selectedFormCategories[0].id;
      } else {
        this.editingProduct.category_id = 0;
      }
    }
  }

  /**
   * Nastaví vybranou kategorii jako hlavní (kliknutím na název čipu)
   */
  setMainCategory(categoryId: number): void {
    if (this.editingProduct) {
      this.editingProduct.category_id = categoryId;
      this.cd.markForCheck();
    }
  }
handleCreateFormOpened(): void {
  // 1. Vynulujeme vybrané kategorie pro čipy
  this.selectedFormCategories = [];
  
  // 2. Inicializujeme kompletní čistou strukturu pro nový produkt
  this.editingProduct = {
    name: '',
    slug: '',
    sku: '',
    short_description: '',
    description: '',
    stock_warning_level: 0,
    is_active: true,
    is_featured: false,
    category_id: null,
    supplier_id: null,
    price_czk: 0,
    cost_price_czk: 0,
    price_eur: 0,
    cost_price_eur: 0,
    images: [],
    variants: []
  };

  // 3. Aktualizujeme možnosti v selectech (kategorie/dodavatelé)
  this.updateFormFieldsOptions();
  
  // 4. Zobrazíme formulář a zamkneme scroll
  this.showProductForm = true;
  this.toggleBodyScroll(true);
  
  // 5. Řekneme Angularu, aby překreslil UI
  this.cd.markForCheck();
}

handleEditFormOpened(item: Product): void {
  // Hluboká kopie a inicializace struktur
  this.editingProduct = JSON.parse(JSON.stringify(item));
  
  if (this.editingProduct) {
    this.editingProduct.variants = this.editingProduct.variants || [];
    this.editingProduct.images = this.editingProduct.images || [];
    this.editingProduct.category_id = item.category_id || 0;
    
    // 🌟 ROZBALENÍ NÁKUPNÍCH CEN PRO EDITAČNÍ FORMULÁŘ:
    if (item.prices) {
      this.editingProduct.cost_price_czk = item.prices.cost_price_czk ?? 0;
      this.editingProduct.cost_price_eur = item.prices.cost_price_eur ?? 0;
      this.editingProduct.cost_price_gbp = item.prices.cost_price_gbp ?? 0;
      
      // Pro jistotu, pokud by v ploché tabulce řádku chyběly běžné prodejní ceny:
      this.editingProduct.price_czk = item.prices.price_czk_with_vat ?? this.editingProduct.price_czk ?? 0;
      this.editingProduct.price_eur = item.prices.price_eur_with_vat ?? this.editingProduct.price_eur ?? 0;
      this.editingProduct.price_gbp = item.prices.price_gbp_with_vat ?? this.editingProduct.price_gbp ?? 0;
    } else {
      // Výchozí hodnoty, pokud produkt na backendu ještě žádný záznam v cenách nemá
      this.editingProduct.cost_price_czk = 0;
      this.editingProduct.cost_price_eur = 0;
      this.editingProduct.cost_price_gbp = 0;
    }
    
    // Načtení stávajících relací kategorií do lokálního pole čipů
    this.selectedFormCategories = item.categories ? [...item.categories] : [];
  }
  
  this.showProductForm = true;
  this.cd.markForCheck();
}
  closeProductForm(): void {
    this.showProductForm = false;
    this.editingProduct = null;
    this.selectedFormCategories = [];
    this.cd.markForCheck();
  }
}