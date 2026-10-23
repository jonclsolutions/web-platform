/**
 * @file products.component.spec.ts
 * @path src/app/admin/shop-pages/products/products.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ProductsComponent and products.config.ts – the product catalogue:
 *   translated configuration, toolbar by permission, list rows with price / category / supplier,
 *   category and supplier lookups, trash, details / edit / variants / images modals (prices from
 *   nested or flat values), variant and image editing, file checks (max 5 MB), validation rules
 *   and the multipart payload sent when saving (POST, _method=PUT for edits).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), LoadingService (real, spied on),
 *   ResourceCacheService (real)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProductsComponent } from './products.component';
import { LoadingService } from '../../../core/services/loading.service';
import { AdminTestContext, createAdminTestContext, paginated } from '../../../../testing/admin-test-helpers';

describe('ProductsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ProductsComponent>;
  let component: ProductsComponent;

  const dh = () => ctx.dataHandler as any;
  const categories = [{ id: 1, name: 'Telefony', slug: 'telefony' }, { id: 2, name: 'Příslušenství', slug: 'prislusenstvi' }];
  const suppliers = [{ id: 7, name: 'ACME' }];
  /** Product as returned by GET shop/products/{id}. */
  const full = (): any => ({
    id: 5, name: 'Pixel', sku: 'PX', category_id: 1, category: { name: 'Telefony' }, supplier: { name: 'ACME' },
    prices: { price_eur_with_vat: 121, cost_price_eur: 80, vat_rate: 21 },
    images: [{ id: 30, image_path: 'a.jpg', alt_text: '', is_primary: true, sort_order: 0 }],
    variants: [
      { id: 40, variant_name: '128 GB', prices: { vat_rate: 10, price_eur_with_vat: 110, price_eur_without_vat: 100, cost_price_eur: 70 } },
      { id: 41, variant_name: '256 GB', vat_rate: 15, price_with_vat_eur: 115, price_without_vat_eur: 100 },
      { variant_name: 'new' }
    ]
  });
  const fileInput = (size: number, name = 'a.png') => {
    const f = new File(['x'], name, { type: 'image/png' });
    Object.defineProperty(f, 'size', { value: size });
    return { target: { files: [f], value: 'C:\\fake\\a.png' } };
  };
  const fd = () => dh().post.calls.mostRecent().args[1] as FormData;
  const valid = (): any => ({ name: 'Pixel', sku: 'PX', price_eur: 100, category_id: 1, is_active: true, variants: [], images: [] });

  beforeEach(async () => {
    ctx = createAdminTestContext();
    dh().getCollection.and.callFake((url: string) =>
      of(url.startsWith('shop/categories') ? categories : url.startsWith('shop/suppliers') ? suppliers : []));
    dh().getOne.and.callFake(() => of(full()));
    await TestBed.configureTestingModule({ imports: [ProductsComponent], providers: ctx.providers }).compileComponents();
    spyOn(TestBed.inject(LoadingService), 'show');
    spyOn(TestBed.inject(LoadingService), 'hide');
    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => { fixture.destroy(); document.body.classList.remove('modal-open'); });

  describe('configuration and list', () => {
    /**
     * @description The configuration is built from the 'shop-products' translations.
     * @input  component created
     * @output caption; row buttons details / edit / variants / images / delete with permissions; 10 form fields; filters incl. price range, low stock and sort-only columns
     */
    it('builds the configuration from translations', () => {
      expect(component.tableCaption).toBe('shop-products.table_header');
      expect(component.buttons.map(b => [b.action, b.permission])).toEqual([
        ['details', undefined], ['edit', 'shop-products-update'], ['custom_prod_var', 'shop-products-update'],
        ['custom_prod_img', 'shop-products-update'], ['delete', 'shop-products-delete']
      ]);
      expect(component.formFields.map(f => f.column_name)).toEqual(['name', 'sku', 'category_id', 'supplier_id', 'price_eur', 'cost_price_eur', 'stock_quantity', 'description', 'is_active', 'is_featured']);
      expect(component.filterColumns.map(c => c.key)).toEqual(['search', 'category_id', 'supplier_id', 'price_from', 'price_to', 'low_stock',
        'is_featured', 'is_active', 'id', 'name', 'sku', 'price_eur', 'stock_quantity']);
      expect(component.productColumns.map(c => c.key)).toEqual(['id', 'name', 'sku', 'category_name', 'price_eur', 'stock_quantity', 'is_active']);
      expect(component.trashProductColumns.length).toBeGreaterThan(0);
      expect(component.graphColumns.map(g => g.key)).toContain('category_name');
      expect(component.t('btn_edit')).toBe('shop-products.btn_edit');
    });

    /**
     * @description Toolbar buttons without permission get showIf false (rebuilt with the translations).
     * @input  granted []; translations$.next({})
     * @output create, import, reports and trash showIf false; filters and export unchanged
     */
    it('hides toolbar buttons without permission', () => {
      ctx.permissions.granted = new Set();
      ctx.i18n.translations$.next({});
      const t = Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
      expect(['handleCreateFormOpened', 'triggerImport', 'openGraphBuilder', 'toggleTrash'].map(a => t[a].showIf)).toEqual([false, false, false, false]);
      expect(t['exportActiveTable'].showIf).toBeTrue();
      expect(t['toggleFilters'].showIf).toBeUndefined();
    });

    /**
     * @description Loaded rows get price, category and supplier columns from the nested API data.
     * @input  ngOnInit(); API page [{ prices: { price_eur_with_vat: 99 }, category: { name: 'Telefony' }, supplier: { name: 'ACME' } }, { }]
     * @output data[0] price_eur 99, category_name 'Telefony', supplier_name 'ACME'; data[1] 0, '-', '-'
     */
    it('maps the list rows', fakeAsync(() => {
      ctx.genericTable.getPaginatedData.and.returnValue(of(paginated<any>([
        { id: 1, prices: { price_eur_with_vat: 99 }, category: { name: 'Telefony' }, supplier: { name: 'ACME' } }, { id: 2 }
      ])));
      component.ngOnInit();
      expect(ctx.genericTable.getPaginatedData.calls.first().args[0]).toBe('shop/products');
      expect(component.data.map((r: any) => [r.price_eur, r.category_name, r.supplier_name])).toEqual([[99, 'Telefony', 'ACME'], [0, '-', '-']]);
      discardPeriodicTasks();
    }));

    /**
     * @description Categories and suppliers are loaded once and fill the form and filter selects; failures are logged.
     * @input  ngOnInit(); then a second init with failing lookups
     * @output category_id / supplier_id options in form and filters; console.error on failure
     */
    it('loads category and supplier options', fakeAsync(() => {
      component.ngOnInit();
      expect(dh().getCollection).toHaveBeenCalledWith('shop/categories?no_pagination=true');
      expect(dh().getCollection).toHaveBeenCalledWith('shop/suppliers?no_pagination=true');
      const opts = (list: any[], key: string, prop: string) => list.find(x => x[prop] === key).options;
      expect(opts(component.formFields, 'category_id', 'column_name')).toEqual([{ value: 1, label: 'Telefony' }, { value: 2, label: 'Příslušenství' }]);
      expect(opts(component.formFields, 'supplier_id', 'column_name')).toEqual([{ value: 7, label: 'ACME' }]);
      expect(opts(component.filterColumns, 'category_id', 'key').length).toBe(2);
      expect(opts(component.filterColumns, 'supplier_id', 'key').length).toBe(1);
      discardPeriodicTasks();
    }));

    /**
     * @description Failing lookups are only logged.
     * @input  categories and suppliers requests fail
     * @output console.error called twice; options empty
     */
    it('logs failing lookups', fakeAsync(() => {
      dh().getCollection.and.returnValue(throwError(() => new Error('x')));
      const err = spyOn(console, 'error');
      component.ngOnInit();
      expect(err).toHaveBeenCalledTimes(2);
      expect(component.categories).toEqual([]);
      discardPeriodicTasks();
    }));

    /**
     * @description Toolbar actions; nothing runs while a product is being loaded.
     * @input  handleToolbarAction(each action) with an activeTable spy; then while processing
     * @output toggleFilters opens the filter panel; create opens the form; trash, report, export and import run; ignored while processing
     */
    it('dispatches the toolbar actions', () => {
      const table = jasmine.createSpyObj('TableBuilderComponent', ['exportToCSV', 'importData']);
      component.activeTable = table;
      component.handleToolbarAction('toggleFilters');
      expect(component.showFiltersPanel).toBeTrue();
      const trash = spyOn(component, 'toggleTrash');
      ['handleCreateFormOpened', 'toggleTrash', 'openGraphBuilder', 'exportActiveTable', 'triggerImport', 'unknown'].forEach(a => component.handleToolbarAction(a));
      expect(component.showProductForm).toBeTrue();
      expect(trash).toHaveBeenCalled();
      expect(component.showGraphBuilder).toBeTrue();
      expect(table.exportToCSV).toHaveBeenCalled();
      expect(table.importData).toHaveBeenCalled();
      (component as any).isProcessing = true;
      component.handleToolbarAction('toggleFilters');
      expect(component.showFiltersPanel).toBeTrue();
    });

    /**
     * @description Export without a table is logged; import without a table does nothing.
     * @input  no activeTable; exportActiveTable(); handleToolbarAction('triggerImport')
     * @output console.error('Active table not found for export.'); no exception
     */
    it('handles export and import without a table', () => {
      const err = spyOn(console, 'error');
      component.activeTable = undefined as any;
      component.exportActiveTable();
      expect(err).toHaveBeenCalledWith('Active table not found for export.');
      expect(() => component.handleToolbarAction('triggerImport')).not.toThrow();
    });

    /**
     * @description The trash view reloads with only_trashed; back to active reloads normally; clearing resets to id desc.
     * @input  toggleTrash() twice; clearFilters()
     * @output reload with only_trashed 'true'; then normal reload; filters { sort_by: 'id', sort_direction: 'desc' }
     */
    it('switches the trash view and clears filters', () => {
      component.toggleTrash();
      expect(component.showTrashTable).toBeTrue();
      expect(ctx.genericTable.getPaginatedData.calls.allArgs().some(a => a[3]?.['only_trashed'] === 'true')).toBeTrue();
      component.toggleTrash();
      expect(component.showTrashTable).toBeFalse();
      component.filters = { search: 'x' };
      component.clearFilters();
      expect(component.filters).toEqual({ sort_by: 'id', sort_direction: 'desc' });
    });
  });

  describe('details, edit, variants and images modals', () => {
    /**
     * @description Details are loaded and prices of the product and its variants are normalized.
     * @input  handleViewDetails({ id: 5 }) – variant 40 nested prices, 41 flat values, 3rd without prices
     * @output price_eur 121, cost 80, category 'Telefony', supplier 'ACME'; variants vat 10 / 15 / 21, price 110 / 115 / 0, without VAT 100 / 100 / 0; modal open, body locked
     */
    it('shows the details with normalized prices', () => {
      component.handleViewDetails({ id: 5 });
      const p = component.selectedProductForDetail;
      expect([p.price_eur, p.cost_price_eur, p.category_name, p.supplier_name]).toEqual([121, 80, 'Telefony', 'ACME']);
      expect(p.variants.map((v: any) => [v.vat_rate, v.price_with_vat_eur, v.price_without_vat_eur])).toEqual([[10, 110, 100], [15, 115, 100], [21, 0, 0]]);
      expect(component.showDetailsModal).toBeTrue();
      expect(document.body.classList.contains('modal-open')).toBeTrue();
      component.closeDetailsModal();
      expect(component.selectedProductForDetail).toBeNull();
      expect(document.body.classList.contains('modal-open')).toBeFalse();
    });

    /**
     * @description A product without prices, category, supplier and variants shows defaults; guards stop double loading.
     * @input  getOne returns { id: 6 }; handleViewDetails({ id: 6 }); then without id and while processing
     * @output 0 / 0 / '-' / '-'; getOne called once
     */
    it('shows defaults for missing details and guards the load', () => {
      dh().getOne.and.returnValue(of({ id: 6 }));
      component.handleViewDetails({ id: 6 });
      const p = component.selectedProductForDetail;
      expect([p.price_eur, p.cost_price_eur, p.category_name, p.supplier_name, p.variants]).toEqual([0, 0, '-', '-', undefined]);
      component.handleViewDetails({});
      (component as any).isProcessing = true;
      component.handleViewDetails({ id: 6 });
      expect(dh().getOne).toHaveBeenCalledTimes(1);
    });

    /**
     * @description The edit form loads the full product with normalized variant prices incl. cost.
     * @input  openEditProductForm({ id: 5 }, click); then a product without variants / prices; guards
     * @output stopPropagation; editingProduct variants cost 70 / 0 / 0; form open; defaults 0; no load without id or while processing
     */
    it('opens the edit form', () => {
      const event = jasmine.createSpyObj('Event', ['stopPropagation']);
      component.openEditProductForm({ id: 5 } as any, event);
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.editingProduct.price_eur).toBe(121);
      expect(component.editingProduct.variants.map((v: any) => [v.vat_rate, v.price_with_vat_eur, v.price_without_vat_eur, v.cost_price_eur])).toEqual([[10, 110, 100, 70], [15, 115, 100, 0], [21, 0, 0, 0]]);
      expect(component.showProductForm).toBeTrue();
      dh().getOne.and.returnValue(of({ id: 6 }));
      component.openEditProductForm({ id: 6 } as any);
      expect([component.editingProduct.price_eur, component.editingProduct.cost_price_eur]).toEqual([0, 0]);
      component.openEditProductForm({} as any);
      (component as any).isProcessing = true;
      component.openEditProductForm({ id: 6 } as any);
      expect(dh().getOne).toHaveBeenCalledTimes(2);
    });

    /**
     * @description The variants modal loads the product with normalized variant prices; a failure releases the guard.
     * @input  openVariantsModal(product 5, click); product without variants / prices; getOne fails; while processing
     * @output variants vat 10 / 15 / 21; modal open; defaults 0; isProcessing false after failure; no load while processing
     */
    it('opens the variants modal', () => {
      const event = jasmine.createSpyObj('Event', ['stopPropagation']);
      component.openVariantsModal({ id: 5 } as any, event);
      expect(component.selectedProduct?.id).toBe(5);
      expect(component.editingProduct.variants.map((v: any) => v.vat_rate)).toEqual([10, 15, 21]);
      expect(component.showVariantsModal).toBeTrue();
      dh().getOne.and.returnValue(of({ id: 6 }));
      component.openVariantsModal({ id: 6 } as any);
      expect([component.editingProduct.price_eur, component.editingProduct.cost_price_eur]).toEqual([0, 0]);
      dh().getOne.and.returnValue(throwError(() => new Error('x')));
      component.openVariantsModal({ id: 6 } as any);
      expect((component as any).isProcessing).toBeFalse();
      (component as any).isProcessing = true;
      dh().getOne.calls.reset();
      component.openVariantsModal({ id: 6 } as any);
      expect(dh().getOne).not.toHaveBeenCalled();
      component.closeVariantsModal();
      expect(component.showVariantsModal).toBeFalse();
    });

    /**
     * @description The images modal loads the product; a failure releases the guard.
     * @input  openImagesModal(product 5, click); product without prices; failure; while processing
     * @output editingProduct.price_eur 121; modal open; defaults 0; isProcessing false after failure; no load while processing
     */
    it('opens the images modal', () => {
      const event = jasmine.createSpyObj('Event', ['stopPropagation']);
      component.openImagesModal({ id: 5 } as any, event);
      expect(component.editingProduct.price_eur).toBe(121);
      expect(component.showImagesModal).toBeTrue();
      dh().getOne.and.returnValue(of({ id: 6 }));
      component.openImagesModal({ id: 6 } as any);
      expect([component.editingProduct.price_eur, component.editingProduct.cost_price_eur]).toEqual([0, 0]);
      dh().getOne.and.returnValue(throwError(() => new Error('x')));
      component.openImagesModal({ id: 6 } as any);
      expect((component as any).isProcessing).toBeFalse();
      (component as any).isProcessing = true;
      dh().getOne.calls.reset();
      component.openImagesModal({ id: 6 } as any);
      expect(dh().getOne).not.toHaveBeenCalled();
      component.closeImagesModal();
      expect(component.showImagesModal).toBeFalse();
    });
  });

  describe('variants and images editing', () => {
    /**
     * @description Variants are added with defaults; saved variants are marked for deletion, new ones removed.
     * @input  no product → addVariant(); product without variants → addVariant(); delete saved (id 40) and new variant; cancelled delete
     * @output nothing without product; variant with vat 21 added; id 40 _delete true; new removed; cancel keeps it; confirm text with the name
     */
    it('adds and deletes variants', async () => {
      component.addVariant();
      expect(component.editingProduct).toBeNull();
      await component.deleteVariant(0);
      component.editingProduct = { name: 'X' };
      component.addVariant();
      expect(component.editingProduct.variants[0]).toEqual(jasmine.objectContaining({ vat_rate: 21, stock_quantity: 0, images: [] }));
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'shop-products.confirm_delete_variant_message' ? 'Smazat {name}?' : p));
      component.editingProduct.variants = [{ id: 40, variant_name: '128 GB' }, { variant_name: '' }];
      await component.deleteVariant(0);
      expect(ctx.confirm.open).toHaveBeenCalledWith('shop-products.confirm_delete_variant_title', 'Smazat 128 GB?');
      expect(component.editingProduct.variants[0]._delete).toBeTrue();
      await component.deleteVariant(1);
      expect(ctx.confirm.open).toHaveBeenCalledWith('shop-products.confirm_delete_variant_title', 'Smazat ?');
      expect(component.editingProduct.variants.length).toBe(1);
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      component.editingProduct.variants.push({ variant_name: 'keep' });
      await component.deleteVariant(1);
      expect(component.editingProduct.variants.length).toBe(2);
    });

    /**
     * @description Variant images are edited on a copy and written back with the variant id.
     * @input  variant 40 with one image; editVariantImages(0, click); add image; delete saved and new image; saveVariantImages()
     * @output copy (not the same array); new image sort_order 1; saved image _delete; new one removed; written back with variant_id 40; editing closed
     */
    it('edits the images of a variant', () => {
      component.editingProduct = { variants: [{ id: 40, variant_name: 'A', images: [{ id: 1, image_path: 'v.jpg' }] }, { variant_name: 'B' }] };
      const event = jasmine.createSpyObj('Event', ['stopPropagation']);
      component.editVariantImages(0, event);
      expect(component.currentEditingVariant.id).toBe(40);
      expect(component.editingVariantImages).not.toBe(component.editingProduct.variants[0].images);
      component.addVariantImage();
      expect(component.editingVariantImages[1].sort_order).toBe(1);
      component.deleteVariantImage(1);
      component.deleteVariantImage(0);
      expect(component.editingVariantImages).toEqual([jasmine.objectContaining({ id: 1, _delete: true })]);
      component.saveVariantImages();
      expect(component.editingProduct.variants[0].images[0].variant_id).toBe(40);
      expect(component.editingVariantIdx).toBeNull();
      component.editVariantImages(1);
      expect(component.editingVariantImages).toEqual([]);
      component.editVariantImages(9);
      expect(component.editingVariantImages).toEqual([]);
      component.saveVariantImages();
      expect(component.editingVariantIdx).toBe(9);
    });

    /**
     * @description currentEditingVariant is null without an index or without variants; saving without an index does nothing.
     * @input  editingVariantIdx null; product without variants
     * @output null both times
     */
    it('has no current variant without index or variants', () => {
      expect(component.currentEditingVariant).toBeNull();
      component.editingProduct = {};
      component.editingVariantIdx = 0;
      expect(component.currentEditingVariant).toBeNull();
      component.editingVariantIdx = null;
      component.saveVariantImages();
      expect(component.editingVariantIdx).toBeNull();
    });

    /**
     * @description Changing VAT or price recomputes the price without VAT (2 decimals); without a VAT rate nothing changes.
     * @input  { vat_rate: 21, price_with_vat_eur: 121 }; price 0; vat_rate null
     * @output 100; 0; unchanged
     */
    it('recomputes variant prices without VAT', () => {
      const v: any = { vat_rate: 21, price_with_vat_eur: 121 };
      component.onVATRateChange(v);
      expect(v.price_without_vat_eur).toBe(100);
      v.price_with_vat_eur = 0;
      component.onPriceWithVATChange(v);
      expect(v.price_without_vat_eur).toBe(0);
      const none: any = { vat_rate: null, price_without_vat_eur: 5 };
      component.onVATRateChange(none);
      expect(none.price_without_vat_eur).toBe(5);
    });

    /**
     * @description Product images: first image is primary; saved images are marked for deletion, new removed; order renumbered; one primary.
     * @input  no product; product without images → addImage() twice; deleteImage(0) for saved / new; setPrimaryImage(1); cancelled delete
     * @output nothing without product; first primary, second not; saved marked _delete; new removed and sort orders renumbered; only index 1 primary
     */
    it('adds, deletes and orders product images', async () => {
      component.addImage();
      component.setPrimaryImage(0);
      component.editingProduct = {};
      component.addImage();
      component.addImage();
      expect(component.editingProduct.images.map((i: any) => i.is_primary)).toEqual([true, false]);
      component.editingProduct.images = [
        { id: 1, image_path: 'a', is_primary: true, sort_order: 0 }, { image_path: 'b', sort_order: 1 },
        { image_path: 'c', sort_order: 2 }, { id: 9, variant_id: 40, image_path: 'v', sort_order: 7 }
      ];
      await component.deleteImage(0);
      expect(component.editingProduct.images[0]._delete).toBeTrue();
      await component.deleteImage(1);
      expect(component.editingProduct.images.map((i: any) => i.sort_order)).toEqual([0, 1, 7]);
      component.setPrimaryImage(1);
      expect(component.editingProduct.images.map((i: any) => i.is_primary)).toEqual([false, true, false]);
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.deleteImage(1);
      expect(component.editingProduct.images.length).toBe(3);
      component.editingProduct = {};
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.deleteImage(0);
      expect(component.editingProduct.images).toBeUndefined();
    });

    /**
     * @description Selected image files are limited to 5 MB and shown as a preview.
     * @input  onFileSelected with 6 MB, empty selection, 1 KB (product with images), 1 KB (no images); same for variant images
     * @output warning 'shop-products.file_too_large_message' and input cleared; preview data URL set; nothing without a target image
     */
    it('checks and previews image files', async () => {
      const big = fileInput(6 * 1024 * 1024);
      component.onFileSelected(big, 0);
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-products.file_too_large_title', 'shop-products.file_too_large_message', 'warning');
      expect(big.target.value).toBe('');
      component.onFileSelected({ target: { files: [] } }, 0);
      component.editingProduct = { images: [{ image_path: '' }] };
      component.onFileSelected(fileInput(1024), 0);
      expect(component.editingProduct.images[0].image_path).toBe('a.png');
      await new Promise(r => setTimeout(r, 50));
      expect(component.editingProduct.images[0].url).toMatch(/^data:/);
      component.editingProduct = {};
      expect(() => component.onFileSelected(fileInput(1024), 0)).not.toThrow();

      const bigV = fileInput(6 * 1024 * 1024);
      component.onVariantImageFileSelected(bigV, 0);
      expect(bigV.target.value).toBe('');
      component.onVariantImageFileSelected({ target: { files: [] } }, 0);
      component.editingVariantImages = [{ image_path: '', alt_text: '', is_primary: false, sort_order: 0 }];
      component.onVariantImageFileSelected(fileInput(1024, 'v.png'), 0);
      expect(component.editingVariantImages[0].image_path).toBe('v.png');
      await new Promise(r => setTimeout(r, 50));
      expect(component.editingVariantImages[0].url).toMatch(/^data:/);
      expect(() => component.onVariantImageFileSelected(fileInput(1024), 5)).not.toThrow();
    });
  });

  describe('validation', () => {
    /**
     * @description The product needs a name; in the images modal nothing else is checked.
     * @input  no product; name '  '; images modal with a name only
     * @output false; warning 'shop-products.validation_name_required'; true
     */
    it('requires a name', () => {
      expect(component.validateProduct()).toBeFalse();
      component.editingProduct = { name: '  ' };
      expect(component.validateProduct()).toBeFalse();
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-products.validation_title', 'shop-products.validation_name_required', 'warning');
      component.editingProduct = { name: 'X' };
      component.showImagesModal = true;
      expect(component.validateProduct()).toBeTrue();
    });

    /**
     * @description In the variants modal each active variant needs a name and a price (nested or flat).
     * @input  variants modal: no variants; nameless; price 0; nested price 10; deleted invalid variant
     * @output true; 'validation_variant_name_required'; 'validation_variant_price_required'; true; deleted ones ignored
     */
    it('validates variants in the variants modal', () => {
      component.showVariantsModal = true;
      component.editingProduct = { name: 'X' };
      expect(component.validateProduct()).toBeTrue();
      component.editingProduct.variants = [{ variant_name: '' }];
      expect(component.validateProduct()).toBeFalse();
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-products.validation_title', 'shop-products.validation_variant_name_required', 'warning');
      component.editingProduct.variants = [{ variant_name: 'A', price_with_vat_eur: 0 }];
      expect(component.validateProduct()).toBeFalse();
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-products.validation_title', 'shop-products.validation_variant_price_required', 'warning');
      component.editingProduct.variants = [{ variant_name: 'A', prices: { price_eur_with_vat: 10 } }, { variant_name: '', _delete: true }];
      expect(component.validateProduct()).toBeTrue();
    });

    /**
     * @description In the product form: a price without variants, valid variants otherwise, a SKU and no invalid category.
     * @input  no price; variant without name; variant price -1; valid variant; no SKU; category -1; valid product
     * @output warnings validation_price_required, validation_variant_name_required, validation_variant_price_required, validation_sku_required, validation_category_invalid; true at the end
     */
    it('validates the product form', () => {
      const check = (p: any) => { component.editingProduct = p; return component.validateProduct(); };
      expect(check({ name: 'X', price_eur: 0 })).toBeFalse();
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('shop-products.validation_price_required');
      expect(check({ name: 'X', variants: [{ variant_name: '' }] })).toBeFalse();
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('shop-products.validation_variant_name_required');
      expect(check({ name: 'X', variants: [{ variant_name: 'A', price_with_vat_eur: -1 }] })).toBeFalse();
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('shop-products.validation_variant_price_required');
      expect(check({ name: 'X', variants: [{ variant_name: 'A', prices: { price_eur_with_vat: 5 } }] })).toBeFalse();
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('shop-products.validation_sku_required');
      expect(check({ ...valid(), category_id: -1 })).toBeFalse();
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('shop-products.validation_category_invalid');
      expect(check(valid())).toBeTrue();
      expect(check({ ...valid(), category_id: null })).toBeTrue();
    });
  });

  describe('saving', () => {
    /**
     * @description An active product needs a category; an invalid product is not sent.
     * @input  saveProduct() without product; invalid product; active product without category
     * @output post not called; warning 'shop-products.validation_active_needs_category'
     */
    it('does not save invalid or uncategorized active products', () => {
      component.saveProduct();
      component.editingProduct = { name: '' };
      component.saveProduct();
      component.editingProduct = { ...valid(), category_id: 0 };
      component.saveProduct();
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-products.validation_title', 'shop-products.validation_active_needs_category', 'warning');
      expect(dh().post).not.toHaveBeenCalled();
    });

    /**
     * @description A new product is sent as multipart FormData with computed prices and a generated slug.
     * @input  { name: 'Nový Telefon 5G', sku: 'NT', price_eur: 121, category_id: 1, supplier_id: 7, inactive, featured, image with file }
     * @output post('shop/products', fd); slug 'nov-telefon-5g'; prices 21 / 121 / 100; is_active '0'; is_featured '1'; supplier '7'; category_ids ''; image file; no _method; modals closed; reload
     */
    it('creates a product as multipart FormData', () => {
      const file = new File(['x'], 'a.jpg');
      component.showProductForm = true;
      component.editingProduct = {
        name: 'Nový Telefon 5G', sku: 'NT', price_eur: 121, category_id: 1, supplier_id: 7, is_active: false, is_featured: true,
        images: [{ image_path: 'a.jpg', file, is_primary: true }], variants: []
      };
      component.saveProduct();
      const [url, body] = dh().post.calls.mostRecent().args;
      expect(url).toBe('shop/products');
      expect(body.get('slug')).toBe('nov-telefon-5g');
      expect([body.get('prices[vat_rate]'), body.get('prices[price_eur_with_vat]'), body.get('prices[price_eur_without_vat]'), body.get('prices[cost_price_eur]')]).toEqual(['21', '121', '100', '0']);
      expect([body.get('is_active'), body.get('is_featured'), body.get('supplier_id'), body.get('category_id'), body.get('category_ids')]).toEqual(['0', '1', '7', '1', '']);
      expect(body.get('images[0][file]')).toEqual(jasmine.any(File));
      expect([body.get('images[0][alt_text]'), body.get('images[0][sort_order]'), body.get('images[0][is_primary]')]).toEqual(['', '0', '1']);
      expect(body.get('_method')).toBeNull();
      expect(component.showProductForm).toBeFalse();
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'shop-products.product_saved_message', 'success');
    });

    /**
     * @description An edit is sent as POST + _method=PUT with categories, images, variants and deletions.
     * @input  product 5 with own slug, extra categories [1, 2], saved / deleted images, variants (saved, deleted, new with images)
     * @output post('shop/products/5'); _method 'PUT'; category_ids[] ['1', '2']; delete_images[] ['31']; variant fields; delete_variants[] ['41']; variant image deletion
     */
    it('updates a product with variants and images', () => {
      component.selectedFormCategories = [categories[0], categories[1]] as any;
      component.editingProduct = {
        id: 5, name: 'Pixel', slug: 'pixel', sku: 'PX', price_eur: 110, vat_rate: 10, cost_price_eur: 50, category_id: 1,
        is_active: true, stock_warning_level: 3, short_description: 's', description: 'd',
        images: [{ id: 30, alt_text: 'front', sort_order: 0, is_primary: true }, { id: 31, _delete: true }],
        variants: [
          { id: 40, variant_name: 'A', attribute_1_name: 'Barva', attribute_1_value: 'Černá', attribute_2_name: 'Paměť', attribute_2_value: '128', sku_variant: 'PX-A',
            stock_quantity: 4, vat_rate: 10, price_with_vat_eur: 110, price_without_vat_eur: 100, cost_price_eur: 60,
            images: [{ id: 50, alt_text: 'a', sort_order: 1 }, { id: 51, _delete: true }, { file: new File(['x'], 'n.jpg') }] },
          { id: 41, variant_name: 'B', _delete: true },
          { variant_name: 'C', prices: { vat_rate: 15, price_eur_with_vat: 115, price_eur_without_vat: 100 } },
          { variant_name: 'D', price_with_vat_eur: 5 }
        ]
      };
      component.saveProduct();
      const [url, body] = dh().post.calls.mostRecent().args;
      expect(url).toBe('shop/products/5');
      expect(body.get('_method')).toBe('PUT');
      expect(body.get('slug')).toBe('pixel');
      expect(body.getAll('category_ids[]')).toEqual(['1', '2']);
      expect(body.get('is_active')).toBe('1');
      expect(body.get('supplier_id')).toBeNull();
      expect(body.get('prices[price_eur_without_vat]')).toBe('100');
      expect(body.get('images[0][id]')).toBe('30');
      expect(body.getAll('delete_images[]')).toEqual(['31']);
      expect([body.get('variants[0][id]'), body.get('variants[0][attribute_1_value]'), body.get('variants[0][prices][cost_price_eur]')]).toEqual(['40', 'Černá', '60']);
      expect(body.get('variants[0][images][0][id]')).toBe('50');
      expect(body.getAll('variants[0][delete_images][]')).toEqual(['51']);
      expect(body.get('variants[0][images][2][file]')).toEqual(jasmine.any(File));
      expect([body.get('variants[1][variant_name]'), body.get('variants[1][prices][vat_rate]'), body.get('variants[1][prices][price_eur_with_vat]')]).toEqual(['C', '15', '115']);
      expect([body.get('variants[2][prices][vat_rate]'), body.get('variants[2][prices][price_eur_with_vat]'), body.get('variants[2][prices][price_eur_without_vat]'), body.get('variants[2][stock_quantity]'), body.get('variants[2][sku_variant]')]).toEqual(['10', '5', '0', '0', '']);
      expect([body.get('variants[0][images][0][alt_text]'), body.get('variants[0][images][0][sort_order]'), body.get('variants[0][images][2][alt_text]'), body.get('variants[0][images][2][sort_order]')]).toEqual(['a', '1', '', '0']);
      expect(body.getAll('delete_variants[]')).toEqual(['41']);
    });

    /**
     * @description Missing optional values are sent as empty strings / zeros; a product with only extra categories may be active.
     * @input  active product with no category_id but selected categories, no images / variants arrays, minimal fields
     * @output category_id ''; category_ids[] ['2']; is_active '1'; stock_warning_level '0'; short_description ''
     */
    it('sends defaults for missing values', () => {
      component.selectedFormCategories = [categories[1]] as any;
      component.editingProduct = { name: 'X', sku: 'S', price_eur: 10, category_id: 0, is_active: true };
      component.saveProduct();
      const body = fd();
      expect([body.get('category_id'), body.get('is_active'), body.get('stock_warning_level'), body.get('short_description'), body.get('description')]).toEqual(['', '1', '0', '', '']);
      expect(body.getAll('category_ids[]')).toEqual(['2']);
    });

    /**
     * @description Names, SKU and price may be missing in the variants / images modals (only the name is checked there).
     * @input  images modal; { name: 'X' } with an empty variant, a kept variant and a non-primary image
     * @output sku '', slug 'x', prices[price_eur_with_vat] '0'; variant name '' / price '0' / VAT '21'; is_primary '0'; no delete_variants
     */
    it('saves from the images modal with defaults', () => {
      component.showImagesModal = true;
      component.editingProduct = { name: 'X', variants: [{}, { id: 9, _delete: false }], images: [{ is_primary: false }] };
      component.saveProduct();
      const body = fd();
      expect([body.get('sku'), body.get('slug'), body.get('prices[price_eur_with_vat]')]).toEqual(['', 'x', '0']);
      expect([body.get('variants[0][variant_name]'), body.get('variants[0][prices][price_eur_with_vat]'), body.get('variants[0][prices][vat_rate]')]).toEqual(['', '0', '21']);
      expect(body.get('images[0][is_primary]')).toBe('0');
      expect(body.getAll('delete_variants[]')).toEqual([]);
    });

    /**
     * @description generateSlug lower-cases, drops special characters and joins words with single dashes.
     * @input  'Ahoj  Světe -- 2026!'
     * @output 'ahoj-svte-2026'
     */
    it('generates slugs', () => {
      expect(component.generateSlug('Ahoj  Světe -- 2026!')).toBe('ahoj-svte-2026');
    });
  });

  describe('form helpers', () => {
    /**
     * @description A new product starts empty and active; editing copies the product with normalized values.
     * @input  handleCreateFormOpened(); handleEditFormOpened(product with prices and categories); product without prices / arrays / category
     * @output defaults; copy with price 121, cost 80, categories copied; then 0 / [] / category 0 / price from price_eur
     */
    it('opens the create and edit form', () => {
      component.handleCreateFormOpened();
      expect(component.editingProduct).toEqual(jasmine.objectContaining({ is_active: true, images: [], variants: [], price_eur: 0 }));
      expect(component.showProductForm).toBeTrue();
      expect(document.body.classList.contains('modal-open')).toBeTrue();
      const item: any = { id: 5, name: 'Pixel', category_id: 1, prices: { price_eur_with_vat: 121, cost_price_eur: 80 }, categories: [categories[0]] };
      component.handleEditFormOpened(item);
      expect([component.editingProduct.price_eur, component.editingProduct.cost_price_eur]).toEqual([121, 80]);
      expect(component.selectedFormCategories).toEqual([categories[0]] as any);
      expect(component.editingProduct).not.toBe(item);
      component.handleEditFormOpened({ id: 6, name: 'Y', price_eur: 9 } as any);
      expect([component.editingProduct.price_eur, component.editingProduct.cost_price_eur, component.editingProduct.category_id]).toEqual([9, 0, 0]);
      expect([component.editingProduct.variants, component.editingProduct.images, component.selectedFormCategories]).toEqual([[], [], []]);
      component.handleEditFormOpened({ id: 7, name: 'Z' } as any);
      expect(component.editingProduct.price_eur).toBe(0);
      component.closeProductForm();
      expect([component.showProductForm, component.editingProduct, component.selectedFormCategories]).toEqual([false, null, []]);
    });

    /**
     * @description Extra categories: added once, the first becomes the main category; removing the main one picks the next.
     * @input  categories loaded; select value '0', '1', '1' again, '2'; remove 1; remove 2; setMainCategory(2)
     * @output nothing for 0; [1] main 1; no duplicate; [1, 2]; after removing 1 main 2; after removing 2 main 0; available excludes selected
     */
    it('manages extra categories in the form', fakeAsync(() => {
      component.ngOnInit();
      component.handleCreateFormOpened();
      const select = document.createElement('select');
      ['0', '1', '2', '99'].forEach(v => { const o = document.createElement('option'); o.value = v; select.appendChild(o); });
      select.value = '0';
      component.addCategoryToForm(select);
      expect(component.selectedFormCategories).toEqual([]);
      select.value = '1';
      component.addCategoryToForm(select);
      expect(component.editingProduct.category_id).toBe(1);
      expect(select.value).toBe('0');
      select.value = '1';
      component.addCategoryToForm(select);
      select.value = '2';
      component.addCategoryToForm(select);
      select.value = '99';
      component.addCategoryToForm(select);
      expect(component.selectedFormCategories.map(c => c.id)).toEqual([1, 2]);
      expect(component.editingProduct.category_id).toBe(1);
      expect(component.getAvailableCategoriesForForm()).toEqual([]);
      component.removeCategoryFromForm(1);
      expect(component.editingProduct.category_id).toBe(2);
      component.removeCategoryFromForm(5);
      component.removeCategoryFromForm(2);
      expect(component.editingProduct.category_id).toBe(0);
      component.setMainCategory(2);
      expect(component.editingProduct.category_id).toBe(2);
      component.editingProduct = null;
      component.setMainCategory(1);
      select.value = '1';
      component.addCategoryToForm(select);
      expect(component.selectedFormCategories.map(c => c.id)).toEqual([1]);
      component.removeCategoryFromForm(1);
      discardPeriodicTasks();
    }));

    /**
     * @description Display helpers: supplier name, currency, visible variants and images.
     * @input  getSupplierName(7), (8), (); formatCurrency(10), (10, 'CZK'), (null); visible variants / images of a product
     * @output 'ACME', 'N/A', '-'; cs-CZ EUR / CZK; '-'; deleted hidden; product images without variant; variant images with path
     */
    it('formats display values', fakeAsync(() => {
      component.ngOnInit();
      expect([component.getSupplierName(7), component.getSupplierName(8), component.getSupplierName()]).toEqual(['ACME', 'N/A', '-']);
      expect(component.formatCurrency(10)).toBe(new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'EUR' }).format(10));
      expect(component.formatCurrency(10, 'CZK')).toBe(new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(10));
      expect(component.formatCurrency(null as any)).toBe('-');
      const product = {
        variants: [{ id: 1 }, { id: 2, _delete: true }],
        images: [{ id: 1, image_path: 'p' }, { id: 2, image_path: 'v', variant_id: 1 }, { id: 3, image_path: '', variant_id: 1 }, { id: 4, _delete: true }]
      };
      expect(component.getVisibleVariants(product).map((v: any) => v.id)).toEqual([1]);
      expect(component.getVisibleVariants(null)).toEqual([]);
      expect(component.getVisibleImages(product).map((i: any) => i.id)).toEqual([1]);
      expect(component.getVisibleImages(product, 1).map((i: any) => i.id)).toEqual([2]);
      expect(component.getVisibleImages(null)).toEqual([]);
      discardPeriodicTasks();
    }));
  });

  /**
   * @description Destroying the page releases the body scroll lock.
   * @input  body locked; fixture.destroy()
   * @output body without 'modal-open'
   */
  it('unlocks the body scroll on destroy', () => {
    document.body.classList.add('modal-open');
    fixture.destroy();
    expect(document.body.classList.contains('modal-open')).toBeFalse();
  });

  /**
   * @description The list and all modals render.
   * @input  detectChanges(); details modal; product form; variants modal; images modal
   * @output 'shop-products.table_header'; product name 'Pixel' in the modals (name input in the product form)
   */
  it('renders the page and its modals', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('shop-products.table_header');
    for (const open of [() => component.handleViewDetails({ id: 5 }), () => component.openEditProductForm({ id: 5 } as any),
      () => component.openVariantsModal({ id: 5 } as any), () => component.openImagesModal({ id: 5 } as any)]) {
      open();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent!.includes('Pixel') || !!el.querySelector('input[name="name"]')).toBeTrue();
      component.closeDetailsModal();
      component.closeProductForm();
      component.closeVariantsModal();
      component.closeImagesModal();
    }
    component.editingProduct = full();
    component.showVariantsModal = true;
    component.editVariantImages(0);
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    discardPeriodicTasks();
  }));
});
