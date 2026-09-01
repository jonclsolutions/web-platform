/**
 * @file products.component.ts
 * @path src/app/admin/shop-pages/products/products.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Central management component for store inventory, handling CRUD operations for products, variants, and product imagery.
 * @dependencies
 * - BaseDataComponent: Provides base CRUD functionality.
 * - ConfirmDialogService: Facilitates user confirmation for deletion actions.
 * - ResourceCacheService: TTL cache pro lookup data (kategorie, dodavatelé), 5 min.
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z HTTP `error:` callbacků (handleViewDetails, openEditProductForm,
 * openVariantsModal, openImagesModal, saveProduct) - `DataHandler.handleError()` je
 * jediné autoritativní místo pro chybový toast. `loadCategories()`/`loadSuppliers()`
 * měly jen `console.error`, beze změny.
 */

import { Component, ViewChild, ChangeDetectionStrategy, OnInit, OnDestroy, inject } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { PRODUCT_BUTTONS, PRODUCT_COLUMNS, TRASH_PRODUCT_COLUMNS, FILTER_COLUMNS, TOOLBAR_BUTTONS, PRODUCT_FORM_FIELDS } from './products.config';
import { Variant, ProductImage, Category, Supplier, Product } from './';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
import * as Config from './products.config';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, SHARED_UI_BUILDERS, ActionMenuBuilderComponent,GraphBuilderComponent],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsComponent extends BaseDataComponent<Product> implements OnInit, OnDestroy {
  override apiEndpoint: string = 'shop/products';
  @ViewChild('activeTable') activeTable!: any;
  tableCaption: string = 'Produkty';

  private resourceCache = inject(ResourceCacheService);
  private readonly CATEGORIES_CACHE_KEY = 'shop-products:categories';
  private readonly SUPPLIERS_CACHE_KEY = 'shop-products:suppliers';
  private readonly LOOKUP_TTL_MS = 5 * 60 * 1000;

  categories: Category[] = [];
  suppliers: Supplier[] = [];

  showProductForm   = false;
  showVariantsModal = false;
  showImagesModal   = false;
  showDetailsModal  = false;
  showFiltersPanel  = false;

  selectedProductForDetail: any   = null;
  selectedProduct: Product | null = null;
  editingProduct: any             = null;
  editingVariantIdx: number | null = null;
  editingVariantImages: ProductImage[] = [];

  private isProcessing = false;

  filters: Core.FilterParams = { sort_by: 'id', sort_direction: 'desc' };

  buttons            = PRODUCT_BUTTONS;
  productColumns     = PRODUCT_COLUMNS;
  trashProductColumns = TRASH_PRODUCT_COLUMNS;
  filterColumns      = FILTER_COLUMNS;
  toolbarButtons     = TOOLBAR_BUTTONS;
  formFields: any[]  = [];
  selectedFormCategories: Category[] = [];
showGraphBuilder = false;
  readonly graphColumns: GraphColumnOption[] = Config.PRODUCT_DETAILS_COLUMNS
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
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.toggleBodyScroll(false);
  }

override loadData(): void {
  this.list.fetchPaginatedData(this.showTrashTable, this.currentPage, this.itemsPerPage, this.filters)
    .pipe(
      Core.map((response) => {
        response.data = response.data.map((product: any) => {
          product.price_eur     = product.prices?.price_eur_with_vat ?? 0;
          product.category_name = product.category?.name ?? '-';
          product.supplier_name = product.supplier?.name ?? '-';
          return product;
        });
        return response;
      })
    ).subscribe();
}

  private toggleBodyScroll(lock: boolean): void {
    document.body.classList.toggle('modal-open', lock);
  }

  handleToolbarAction(action: string): void {
    if (this.isProcessing) return;
    const actions: Record<string, () => void> = {
      toggleFilters:          () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      toggleTrash:            () => this.toggleTrash(),
      openGraphBuilder: () => this.openGraphBuilder(),
      exportActiveTable:      () => this.exportActiveTable(),
    };
    actions[action]?.();
  }

  getTrashToolbarButtons(): any[] {
    return this.toolbarButtons.filter(
      btn => btn.action !== 'handleCreateFormOpened' && btn.action !== 'exportActiveTable'
    );
  }

  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
    else console.error('Nebyla nalezena aktivní tabulka pro export.');
  }

  override toggleFilters(): void {
    this.showFiltersPanel = !this.showFiltersPanel;
    this.cd.markForCheck();
  }

  toggleTrash(): void {
    this.showTrashTable = !this.showTrashTable;
    if (this.showTrashTable) this.forceFullRefresh({ ...this.filters, only_trashed: 'true' });
    else                     this.refreshData();
    this.cd.markForCheck();
  }

  override refreshData(): void { this.forceFullRefresh(this.filters); }

  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  clearFilters(): void {
    this.filters = { sort_by: 'id', sort_direction: 'desc' };
    this.refreshData();
  }

  handlePageChange(page: number): void        { this.onHandlePageChange(page, this.filters); }
  handleItemsPerPageChange(value: number): void { this.onHandleItemsPerPageChange(value, this.filters); }

  private loadCategories(): void {
    this.resourceCache.get(
      this.CATEGORIES_CACHE_KEY,
      () => this.dataHandler.getCollection<Category>('shop/categories?no_pagination=true'),
      this.LOOKUP_TTL_MS
    )
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.categories = data; this.updateFormFieldsOptions(); this.cd.markForCheck(); },
        error: (err) => console.error('Chyba při načítání kategorií:', err)
      });
  }

  private loadSuppliers(): void {
    this.resourceCache.get(
      this.SUPPLIERS_CACHE_KEY,
      () => this.dataHandler.getCollection<Supplier>('shop/suppliers?no_pagination=true'),
      this.LOOKUP_TTL_MS
    )
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.suppliers = data; this.updateFormFieldsOptions(); this.cd.markForCheck(); },
        error: (err) => console.error('Chyba při načítání dodavatelů:', err)
      });
  }

  private updateFormFieldsOptions(): void {
    this.formFields.forEach(field => {
      if (field.column_name === 'category_id')
        field.options = this.categories.map(c => ({ value: c.id, label: c.name }));
      if (field.column_name === 'supplier_id')
        field.options = this.suppliers.map(s => ({ value: s.id, label: s.name }));
    });
    this.filterColumns.forEach(filter => {
      if (filter.key === 'category_id')
        filter.options = this.categories.map(c => ({ value: c.id, label: c.name }));
      if (filter.key === 'supplier_id')
        filter.options = this.suppliers.map(s => ({ value: s.id, label: s.name }));
    });
  }

  handleViewDetails(item: any): void {
    if (this.isProcessing || !item.id) return;
    this.isProcessing = true;
    this.loadingService.show();

    this.getItemDetails(item.id).pipe(
      Core.finalize(() => { this.loadingService.hide(); this.isProcessing = false; this.cd.markForCheck(); }),
      Core.takeUntil(this.destroy$)
    ).subscribe({
      next: (fullProduct: any) => {
        fullProduct.price_eur     = fullProduct.prices?.price_eur_with_vat ?? 0;
        fullProduct.cost_price_eur = fullProduct.prices?.cost_price_eur    ?? 0;
        fullProduct.category_name  = fullProduct.category?.name ?? '-';
        fullProduct.supplier_name  = fullProduct.supplier?.name ?? '-';

        if (fullProduct.variants) {
          fullProduct.variants = fullProduct.variants.map((v: any) => ({
            ...v,
            vat_rate:            v.prices?.vat_rate            ?? v.vat_rate            ?? 21,
            price_with_vat_eur:  v.prices?.price_eur_with_vat  ?? v.price_with_vat_eur  ?? 0,
            price_without_vat_eur: v.prices?.price_eur_without_vat ?? v.price_without_vat_eur ?? 0,
          }));
        }

        this.selectedProductForDetail = fullProduct;
        this.showDetailsModal = true;
        this.toggleBodyScroll(true);
        this.cd.markForCheck();
      }
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedProductForDetail = null;
    this.toggleBodyScroll(false);
    this.cd.markForCheck();
  }

  openEditProductForm(product: Product, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isProcessing || !product.id) return;
    this.isProcessing = true;
    this.loadingService.show();

    this.getItemDetails(product.id).pipe(
      Core.finalize(() => { this.loadingService.hide(); this.isProcessing = false; this.cd.markForCheck(); }),
      Core.takeUntil(this.destroy$)
    ).subscribe({
      next: (fullProduct: any) => {
        fullProduct.price_eur      = fullProduct.prices?.price_eur_with_vat ?? 0;
        fullProduct.cost_price_eur = fullProduct.prices?.cost_price_eur     ?? 0;

        if (fullProduct.variants) {
          fullProduct.variants = fullProduct.variants.map((v: any) => ({
            ...v,
            vat_rate:              v.prices?.vat_rate              ?? v.vat_rate              ?? 21,
            price_with_vat_eur:    v.prices?.price_eur_with_vat    ?? v.price_with_vat_eur    ?? 0,
            price_without_vat_eur: v.prices?.price_eur_without_vat ?? v.price_without_vat_eur ?? 0,
            cost_price_eur:        v.prices?.cost_price_eur        ?? 0,
          }));
        }

        this.editingProduct = { ...fullProduct };
        this.updateFormFieldsOptions();
        this.showProductForm = true;
        this.toggleBodyScroll(true);
        this.cd.markForCheck();
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
      Core.finalize(() => { this.loadingService.hide(); this.isProcessing = false; this.cd.markForCheck(); }),
      Core.takeUntil(this.destroy$)
    ).subscribe({
      next: (fullProduct: any) => {
        fullProduct.price_eur      = fullProduct.prices?.price_eur_with_vat ?? 0;
        fullProduct.cost_price_eur = fullProduct.prices?.cost_price_eur     ?? 0;

        if (fullProduct.variants) {
          fullProduct.variants = fullProduct.variants.map((v: any) => ({
            ...v,
            vat_rate:              v.prices?.vat_rate              ?? v.vat_rate              ?? 21,
            price_with_vat_eur:    v.prices?.price_eur_with_vat    ?? v.price_with_vat_eur    ?? 0,
            price_without_vat_eur: v.prices?.price_eur_without_vat ?? v.price_without_vat_eur ?? 0,
          }));
        }
        this.editingProduct = { ...fullProduct };
        this.showVariantsModal = true;
        this.toggleBodyScroll(true);
        this.cd.markForCheck();
      },
      error: () => { this.isProcessing = false; }
    });
  }

  addVariant(): void {
    if (!this.editingProduct) return;
    this.editingProduct.variants ??= [];
    this.editingProduct.variants.push({
      variant_name: '', attribute_1_name: '', attribute_1_value: '',
      attribute_2_name: '', attribute_2_value: '', sku_variant: '',
      price_with_vat_eur: 0, price_without_vat_eur: 0,
      vat_rate: 21, stock_quantity: 0, images: []
    });
    this.cd.markForCheck();
  }

  async deleteVariant(index: number): Promise<void> {
    if (!this.editingProduct?.variants) return;
    const variant = this.editingProduct.variants[index];
    const confirmed = await this.confirmDialog.open(
      'Smazat variantu',
      `Opravdu chcete smazat variantu "${variant.variant_name || ''}"?`
    );
    if (confirmed) {
      if (variant.id) variant._delete = true;
      else            this.editingProduct.variants.splice(index, 1);
      this.cd.markForCheck();
    }
  }

  editVariantImages(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingVariantIdx = index;
    const variant = this.editingProduct?.variants?.[index];
    this.editingVariantImages = variant
      ? JSON.parse(JSON.stringify(variant.images || []))
      : [];
    this.cd.markForCheck();
  }

  addVariantImage(): void {
    this.editingVariantImages.push({
      image_path: '', alt_text: '', is_primary: false,
      sort_order: this.editingVariantImages.length, file: undefined
    });
    this.cd.markForCheck();
  }

  deleteVariantImage(index: number): void {
    const img = this.editingVariantImages[index];
    if (img.id) img._delete = true;
    else        this.editingVariantImages.splice(index, 1);
    this.cd.markForCheck();
  }

  onFileSelected(event: any, index: number): void {
    const file: File = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.alertDialogService.open('Příliš velký soubor', 'Obrázek může mít maximálně 5 MB.', 'warning');
      event.target.value = '';
      return;
    }
    if (this.editingProduct?.images) {
      this.editingProduct.images[index].file       = file;
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
      this.alertDialogService.open('Příliš velký soubor', 'Obrázek může mít maximálně 5 MB.', 'warning');
      event.target.value = '';
      return;
    }
    if (this.editingVariantImages[index]) {
      this.editingVariantImages[index].file       = file;
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
      this.editingVariantIdx   = null;
      this.editingVariantImages = [];
      this.cd.markForCheck();
    }
  }

  closeVariantsModal(): void {
    this.showVariantsModal    = false;
    this.editingVariantIdx    = null;
    this.editingVariantImages = [];
    this.toggleBodyScroll(false);
    this.cd.markForCheck();
  }

  onVATRateChange(variant: any): void        { this.calcVariantPricesWithoutVat(variant); this.cd.markForCheck(); }
  onPriceWithVATChange(variant: any): void   { this.calcVariantPricesWithoutVat(variant); this.cd.markForCheck(); }

  private calcVariantPricesWithoutVat(variant: any): void {
    if (variant.vat_rate == null) return;
    const rate = 1 + variant.vat_rate / 100;
    variant.price_without_vat_eur = variant.price_with_vat_eur
      ? Math.round((variant.price_with_vat_eur / rate) * 100) / 100
      : 0;
  }

  openImagesModal(product: Product, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.selectedProduct = product;
    this.loadingService.show();

    this.getItemDetails(product.id).pipe(
      Core.finalize(() => { this.loadingService.hide(); this.isProcessing = false; this.cd.markForCheck(); }),
      Core.takeUntil(this.destroy$)
    ).subscribe({
      next: (fullProduct: any) => {
        fullProduct.price_eur      = fullProduct.prices?.price_eur_with_vat ?? 0;
        fullProduct.cost_price_eur = fullProduct.prices?.cost_price_eur     ?? 0;
        this.editingProduct = { ...fullProduct };
        this.showImagesModal = true;
        this.toggleBodyScroll(true);
        this.cd.markForCheck();
      },
      error: () => { this.isProcessing = false; }
    });
  }

  addImage(): void {
    if (!this.editingProduct) return;
    this.editingProduct.images ??= [];
    const productImages = this.editingProduct.images.filter((img: any) => !img.variant_id);
    this.editingProduct.images.push({
      image_path: '', alt_text: '',
      is_primary: productImages.length === 0,
      sort_order: productImages.length,
      file: undefined
    });
    this.cd.markForCheck();
  }

  async deleteImage(index: number): Promise<void> {
    const confirmed = await this.confirmDialog.open('Smazat obrázek', 'Opravdu chcete odstranit tento obrázek?');
    if (confirmed && this.editingProduct?.images) {
      const image = this.editingProduct.images[index];
      if (image.id) image._delete = true;
      else          this.editingProduct.images.splice(index, 1);
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

  validateProduct(): boolean {
    if (!this.editingProduct) return false;

    if (!this.editingProduct.name?.trim()) {
      this.alertDialogService.open('Validace', 'Zadejte název produktu.', 'warning');
      return false;
    }

    if (this.showImagesModal) return true;

    const activeVariants = (this.editingProduct.variants || []).filter((v: Variant) => !v._delete);

    if (this.showVariantsModal) {
      for (const v of activeVariants) {
        if (!v.variant_name) {
          this.alertDialogService.open('Validace', 'Všechny varianty musí mít název.', 'warning');
          return false;
        }
        const priceEur = v.prices?.price_eur_with_vat ?? v.price_with_vat_eur;
        if (!priceEur || priceEur <= 0) {
          this.alertDialogService.open('Validace', `Varianta "${v.variant_name}" musí mít cenu v EUR > 0.`, 'warning');
          return false;
        }
      }
      return true;
    }

    if (activeVariants.length === 0) {
      if (!this.editingProduct.price_eur || this.editingProduct.price_eur <= 0) {
        this.alertDialogService.open('Validace', 'Cena v EUR musí být > 0.', 'warning');
        return false;
      }
    } else {
      for (const v of activeVariants) {
        if (!v.variant_name) {
          this.alertDialogService.open('Validace', 'Všechny varianty musí mít název.', 'warning');
          return false;
        }
        const priceEur = v.prices?.price_eur_with_vat ?? v.price_with_vat_eur;
        if (!priceEur || priceEur <= 0) {
          this.alertDialogService.open('Validace', `Varianta "${v.variant_name}" musí mít cenu v EUR > 0.`, 'warning');
          return false;
        }
      }
    }

    if (!this.editingProduct.sku?.trim()) {
      this.alertDialogService.open('Validace', 'Zadejte SKU produktu.', 'warning');
      return false;
    }

    if (this.editingProduct.category_id && this.editingProduct.category_id < 0) {
      this.alertDialogService.open('Validace', 'Zvolená kategorie je neplatná.', 'warning');
      return false;
    }

    return true;
  }

  saveProduct(): void {
    if (!this.editingProduct || !this.validateProduct()) return;

    const hasMainCategory       = this.editingProduct.category_id > 0;
    const hasAdditionalCategories = this.selectedFormCategories.length > 0;
    const hasAnyCategory        = hasMainCategory || hasAdditionalCategories;

    if (this.editingProduct.is_active && !hasAnyCategory) {
      this.alertDialogService.open('Validace', 'Aktivní produkt musí mít přiřazenou kategorii.', 'warning');
      return;
    }

    const vatRate         = this.editingProduct.vat_rate ?? 21;
    const priceWithVat    = this.editingProduct.price_eur ?? 0;
    const priceWithoutVat = Math.round((priceWithVat / (1 + vatRate / 100)) * 100) / 100;

    const fd = new FormData();
    fd.append('name',                this.editingProduct.name ?? '');
    fd.append('slug',                this.editingProduct.slug || this.generateSlug(this.editingProduct.name ?? ''));
    fd.append('sku',                 this.editingProduct.sku ?? '');
    fd.append('short_description',   this.editingProduct.short_description ?? '');
    fd.append('description',         this.editingProduct.description ?? '');
    fd.append('stock_warning_level', String(this.editingProduct.stock_warning_level ?? 0));
    fd.append('is_active',           (this.editingProduct.is_active && hasAnyCategory) ? '1' : '0');
    fd.append('is_featured',         this.editingProduct.is_featured ? '1' : '0');

    if (this.editingProduct.supplier_id)
      fd.append('supplier_id', String(this.editingProduct.supplier_id));

    fd.append('category_id', hasMainCategory ? String(this.editingProduct.category_id) : '');

    if (hasAdditionalCategories)
      this.selectedFormCategories.forEach(cat => fd.append('category_ids[]', String(cat.id)));
    else
      fd.append('category_ids', '');

    fd.append('prices[vat_rate]',            String(vatRate));
    fd.append('prices[price_eur_with_vat]',  String(priceWithVat));
    fd.append('prices[price_eur_without_vat]', String(priceWithoutVat));
    fd.append('prices[cost_price_eur]',      String(this.editingProduct.cost_price_eur ?? 0));

    (this.editingProduct.images ?? []).forEach((img: ProductImage, idx: number) => {
      if (img.id)     fd.append(`images[${idx}][id]`,         String(img.id));
      if (img.file)   fd.append(`images[${idx}][file]`,       img.file);
      fd.append(`images[${idx}][alt_text]`,   img.alt_text ?? '');
      fd.append(`images[${idx}][sort_order]`, String(img.sort_order ?? 0));
      fd.append(`images[${idx}][is_primary]`, img.is_primary ? '1' : '0');
      if (img._delete) fd.append('delete_images[]', String(img.id));
    });

    const activeVariants = (this.editingProduct.variants ?? []).filter((v: Variant) => !v._delete);
    activeVariants.forEach((v: any, idx: number) => {
      if (v.id) fd.append(`variants[${idx}][id]`, String(v.id));
      fd.append(`variants[${idx}][variant_name]`,      v.variant_name      ?? '');
      fd.append(`variants[${idx}][attribute_1_name]`,  v.attribute_1_name  ?? '');
      fd.append(`variants[${idx}][attribute_1_value]`, v.attribute_1_value ?? '');
      fd.append(`variants[${idx}][attribute_2_name]`,  v.attribute_2_name  ?? '');
      fd.append(`variants[${idx}][attribute_2_value]`, v.attribute_2_value ?? '');
      fd.append(`variants[${idx}][sku_variant]`,       v.sku_variant       ?? '');
      fd.append(`variants[${idx}][stock_quantity]`,    String(v.stock_quantity ?? 0));

      const vVat              = v.vat_rate              ?? v.prices?.vat_rate              ?? vatRate;
      const vPriceWithVat     = v.price_with_vat_eur    ?? v.prices?.price_eur_with_vat    ?? 0;
      const vPriceWithoutVat  = v.price_without_vat_eur ?? v.prices?.price_eur_without_vat ?? 0;

      fd.append(`variants[${idx}][prices][vat_rate]`,            String(vVat));
      fd.append(`variants[${idx}][prices][price_eur_with_vat]`,  String(vPriceWithVat));
      fd.append(`variants[${idx}][prices][price_eur_without_vat]`, String(vPriceWithoutVat));
      fd.append(`variants[${idx}][prices][cost_price_eur]`,      String(v.cost_price_eur ?? 0));

      (v.images ?? []).forEach((img: ProductImage, imgIdx: number) => {
        if (img.id)   fd.append(`variants[${idx}][images][${imgIdx}][id]`,   String(img.id));
        if (img.file) fd.append(`variants[${idx}][images][${imgIdx}][file]`, img.file);
        fd.append(`variants[${idx}][images][${imgIdx}][alt_text]`,   img.alt_text ?? '');
        fd.append(`variants[${idx}][images][${imgIdx}][sort_order]`, String(img.sort_order ?? 0));
        if (img._delete) fd.append(`variants[${idx}][delete_images][]`, String(img.id));
      });
    });

    (this.editingProduct.variants ?? []).forEach((v: Variant) => {
      if (v._delete && v.id) fd.append('delete_variants[]', String(v.id));
    });

    if (this.editingProduct.id) fd.append('_method', 'PUT');

    const url = this.editingProduct.id
      ? `${this.apiEndpoint}/${this.editingProduct.id}`
      : this.apiEndpoint;

    this.dataHandler.post<any>(url, fd).subscribe({
      next: () => {
        this.alertDialogService.open('Úspěch', 'Produkt byl úspěšně uložen.', 'success');
        this.closeProductForm();
        this.closeVariantsModal();
        this.closeImagesModal();
        this.refreshData();
      }
    });
  }

  getAvailableCategoriesForForm(): Category[] {
    return this.categories.filter(cat =>
      !this.selectedFormCategories.some(s => s.id === cat.id)
    );
  }

  addCategoryToForm(selectElement: HTMLSelectElement): void {
    const categoryId = Number(selectElement.value);
    if (categoryId <= 0) return;
    const cat = this.categories.find(c => c.id === categoryId);
    if (cat && !this.selectedFormCategories.some(c => c.id === categoryId)) {
      this.selectedFormCategories.push(cat);
      if (!this.editingProduct?.category_id || this.editingProduct.category_id === 0)
        if (this.editingProduct) this.editingProduct.category_id = categoryId;
    }
    selectElement.value = '0';
    this.cd.markForCheck();
  }

  removeCategoryFromForm(categoryId: number): void {
    this.selectedFormCategories = this.selectedFormCategories.filter(c => c.id !== categoryId);
    if (this.editingProduct?.category_id === categoryId) {
      this.editingProduct.category_id = this.selectedFormCategories[0]?.id ?? 0;
    }
  }

  setMainCategory(categoryId: number): void {
    if (this.editingProduct) { this.editingProduct.category_id = categoryId; this.cd.markForCheck(); }
  }

  handleCreateFormOpened(): void {
    this.selectedFormCategories = [];
    this.editingProduct = {
      name: '', slug: '', sku: '', short_description: '', description: '',
      stock_warning_level: 0, is_active: true, is_featured: false,
      category_id: null, supplier_id: null,
      price_eur: 0, cost_price_eur: 0,
      images: [], variants: []
    };
    this.updateFormFieldsOptions();
    this.showProductForm = true;
    this.toggleBodyScroll(true);
    this.cd.markForCheck();
  }

  handleEditFormOpened(item: Product): void {
    this.editingProduct = JSON.parse(JSON.stringify(item));
    if (this.editingProduct) {
      this.editingProduct.variants    = this.editingProduct.variants ?? [];
      this.editingProduct.images      = this.editingProduct.images   ?? [];
      this.editingProduct.category_id = item.category_id ?? 0;
      this.editingProduct.price_eur      = item.prices?.price_eur_with_vat  ?? this.editingProduct.price_eur   ?? 0;
      this.editingProduct.cost_price_eur = item.prices?.cost_price_eur       ?? 0;
      this.selectedFormCategories = item.categories ? [...item.categories] : [];
    }
    this.showProductForm = true;
    this.cd.markForCheck();
  }

  closeProductForm(): void {
    this.showProductForm        = false;
    this.editingProduct         = null;
    this.selectedFormCategories = [];
    this.cd.markForCheck();
  }

  public generateSlug(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  getSupplierName(supplierId?: number): string {
    return supplierId ? (this.suppliers.find(s => s.id === supplierId)?.name ?? 'N/A') : '-';
  }

  formatCurrency(value: number, currency = 'EUR'): string {
    if (value == null) return '-';
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(value);
  }

  getVisibleVariants(product: any): any[] {
    return (product?.variants ?? []).filter((v: any) => !v._delete);
  }

  getVisibleImages(product: any, variantId?: number): ProductImage[] {
    const images: ProductImage[] = product?.images ?? [];
    return variantId
      ? images.filter((img: any) => !img._delete && img.image_path && img.variant_id === variantId)
      : images.filter((img: any) => !img._delete && !img.variant_id);
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