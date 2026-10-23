/**
 * @file categories.component.spec.ts
 * @path src/app/admin/shop-pages/categories/categories.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CategoriesComponent and categories.config.ts – the category tree of
 *   the e-shop: building the tree with child counts, remembered expanded nodes, buttons by
 *   permission, inline add / rename with duplicate check, activate / deactivate with rollback,
 *   delete rules (no subcategories / products), and the side panel with the products of a
 *   category (search, add to / remove from the category).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), ResourceCacheService and
 *   LoadingService (real, spied on), localStorage
 */

import { ComponentFixture, TestBed, fakeAsync, tick, flush, discardPeriodicTasks } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { CategoriesComponent } from './categories.component';
import { CategoryNode } from '../components/interfaces/category-node';
import { LoadingService } from '../../../core/services/loading.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('CategoriesComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<CategoriesComponent>;
  let component: CategoriesComponent;
  let loading: LoadingService;

  const TREE_URL = 'shop/categories?no_pagination=true';
  /** Flat list as returned by the API: 1 Elektro > 2 Telefony > 4 Android; 3 Oblečení. */
  const flat = () => [
    { id: 1, name: 'Elektro', parent_id: null, is_active: true, products_count: 0 },
    { id: 2, name: 'Telefony', parent_id: 1, is_active: true, products_count: 5 },
    { id: 3, name: 'Oblečení', parent_id: null, is_active: false, products_count: 0 },
    { id: 4, name: 'Android', parent_id: 2, is_active: true, products_count: 0 }
  ] as any[];
  const dh = () => ctx.dataHandler as any;
  const node = (id: number, list: CategoryNode[] = component.categories): CategoryNode | undefined => {
    for (const n of list) {
      if (n.id === id) return n;
      const found = node(id, n.children);
      if (found) return found;
    }
    return undefined;
  };
  const click = { stopPropagation: jasmine.createSpy('stopPropagation') } as unknown as Event;

  beforeEach(async () => {
    localStorage.removeItem('categoryExpandedStates');
    ctx = createAdminTestContext();
    dh().getCollection.and.callFake((url: string) => of(url === TREE_URL ? flat() : []));
    await TestBed.configureTestingModule({ imports: [CategoriesComponent], providers: ctx.providers }).compileComponents();
    loading = TestBed.inject(LoadingService);
    spyOn(loading, 'show');
    spyOn(loading, 'hide');
    fixture = TestBed.createComponent(CategoriesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => { fixture.destroy(); localStorage.removeItem('categoryExpandedStates'); });

  const init = () => { component.ngOnInit(); };

  describe('tree', () => {
    /**
     * @description The flat list is turned into a tree with direct and recursive child counts.
     * @input  ngOnInit() logged in; flat list of 4 categories
     * @output roots Elektro, Oblečení; Elektro 1 direct / 2 recursive children; Android under Telefony; loading shown and hidden
     */
    it('builds the category tree', fakeAsync(() => {
      init();
      expect(dh().getCollection).toHaveBeenCalledWith(TREE_URL);
      expect(component.categories.map(c => c.name)).toEqual(['Elektro', 'Oblečení']);
      expect(node(1)!.directChildrenCount).toBe(1);
      expect(node(1)!.totalRecursiveCount).toBe(2);
      expect(node(2)!.children.map(c => c.name)).toEqual(['Android']);
      expect(node(3)!.totalRecursiveCount).toBe(0);
      expect(loading.show).toHaveBeenCalled();
      expect(loading.hide).toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description Expanded nodes are remembered in localStorage and restored on the next visit.
     * @input  localStorage categoryExpandedStates [2]; ngOnInit(); expandAll(true); expandAll(false)
     * @output Telefony expanded on load, Elektro not; all expanded and stored [1, 2, 3, 4]; then none stored
     */
    it('remembers expanded nodes', fakeAsync(() => {
      localStorage.setItem('categoryExpandedStates', '[2]');
      init();
      expect(node(2)!.isExpanded).toBeTrue();
      expect(node(1)!.isExpanded).toBeFalse();
      component.handleToolbarAction('expandAll');
      expect([1, 2, 3, 4].every(id => node(id)!.isExpanded)).toBeTrue();
      expect(JSON.parse(localStorage.getItem('categoryExpandedStates')!).sort()).toEqual([1, 2, 3, 4]);
      component.handleToolbarAction('collapseAll');
      expect(JSON.parse(localStorage.getItem('categoryExpandedStates')!)).toEqual([]);
      discardPeriodicTasks();
    }));

    /**
     * @description A node with children toggles open / closed; leaves cannot be toggled.
     * @input  toggleExpanded(Elektro, click) twice; toggleExpanded(Android) without event
     * @output stopPropagation called; Elektro open → closed (stored / removed); Android unchanged
     */
    it('toggles single nodes', fakeAsync(() => {
      init();
      component.toggleExpanded(node(1)!, click);
      expect(click.stopPropagation).toHaveBeenCalled();
      expect(node(1)!.isExpanded).toBeTrue();
      expect(localStorage.getItem('categoryExpandedStates')).toBe('[1]');
      component.toggleExpanded(node(1)!, click);
      expect(node(1)!.isExpanded).toBeFalse();
      component.toggleExpanded(node(4)!);
      expect(node(4)!.isExpanded).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description refreshData() uses the 2-minute cache; the global refresh reloads past it; a failure hides the loader.
     * @input  init; refreshData(); forceFullRefresh(); then a failing reload; silent load
     * @output one request after refreshData; second after forceFullRefresh; loader hidden after failure; silent load without loader; defaults: loader shown, roots from buildTree(list)
     */
    it('reloads with and without the cache', fakeAsync(() => {
      init();
      component.refreshData();
      expect(dh().getCollection).toHaveBeenCalledTimes(1);
      component.forceFullRefresh();
      expect(dh().getCollection).toHaveBeenCalledTimes(2);
      dh().getCollection.and.returnValue(throwError(() => new Error('x')));
      (loading.hide as jasmine.Spy).calls.reset();
      component.loadTree(undefined, false, true);
      expect(loading.hide).toHaveBeenCalled();
      (loading.show as jasmine.Spy).calls.reset();
      component.loadTree(undefined, true, true);
      dh().getCollection.and.returnValue(of(flat()));
      component.loadTree(2, true, true);
      expect(loading.show).not.toHaveBeenCalled();
      expect(node(2)!.isExpanded).toBeTrue();
      component.loadTree();
      expect(loading.show).toHaveBeenCalled();
      expect(component.buildTree(flat()).map(n => n.id)).toEqual([1, 3]);
      discardPeriodicTasks();
    }));
  });

  describe('buttons', () => {
    /**
     * @description Toolbar and row buttons follow the permissions; the status button shows the current state.
     * @input  granted ['shop-categories-view']; then all; active and inactive node
     * @output addMain, addChild, edit, toggleStatus, delete hidden without permission; labels 'shop-categories.row_btn_active' / '…_inactive' with classes
     */
    it('shows buttons by permission and state', fakeAsync(() => {
      init();
      ctx.permissions.granted = new Set(['shop-categories-view']);
      expect(component.toolbarButtons.find(b => b.action === 'addMain')!.showIf).toBeFalse();
      expect(component.toolbarButtons.find(b => b.action === 'expandAll')!.showIf).toBeUndefined();
      expect(component.getRowButtons(node(1)!).every(b => b.showIf === false)).toBeTrue();
      ctx.permissions.granted = 'all';
      expect(component.toolbarButtons.map(b => b.action)).toEqual(['expandAll', 'collapseAll', 'addMain']);
      const active = component.getRowButtons(node(1)!).find(b => b.action === 'toggleStatus')!;
      const inactive = component.getRowButtons(node(3)!).find(b => b.action === 'toggleStatus')!;
      expect([active.label, active.class, active.showIf]).toEqual(['shop-categories.row_btn_active', 'btn-export', undefined]);
      expect([inactive.label, inactive.class]).toEqual(['shop-categories.row_btn_inactive', 'btn-filter']);
      expect(component.getRowButtons(node(1)!).map(b => b.action)).toEqual(['addChild', 'edit', 'toggleStatus', 'delete']);
      expect(component.t('page_title')).toBe('shop-categories.page_title');
      discardPeriodicTasks();
    }));

    /**
     * @description Names must be unique among siblings (case-insensitive) and not empty; save is disabled otherwise.
     * @input  Telefony renamed 'ANDROID' (different parent) / 'oblečení' as a root / '  '; new node 'android' next to Android
     * @output not duplicate under another parent; duplicate among roots; save disabled for duplicate and empty; duplicate deep in the tree
     */
    it('checks names for duplicates and emptiness', fakeAsync(() => {
      init();
      const phones = node(2)!;
      phones.name = 'ANDROID';
      expect(component.isDuplicateName(phones)).toBeFalse();
      const root = node(1)!;
      root.name = 'oblečení';
      expect(component.isDuplicateName(root)).toBeTrue();
      expect(component.getEditButtons(root)[0].disabled).toBeTrue();
      root.name = '  ';
      expect(component.getEditButtons(root)[0].disabled).toBeTrue();
      root.name = 'Elektronika';
      expect(component.getEditButtons(root).map(b => [b.action, b.disabled])).toEqual([['submit', false], ['cancel', undefined]]);
      component.initAddCategory(2);
      const sibling = node(2)!.children[0];
      sibling.name = 'android';
      expect(component.isDuplicateName(sibling)).toBeTrue();
      discardPeriodicTasks();
    }));

    /**
     * @description Row actions call their handlers; unknown actions do nothing.
     * @input  handleRowAction(addChild | edit | toggleStatus | delete | unknown, Elektro)
     * @output initAddCategory(1), startEdit, toggleStatus, deleteCategory each once
     */
    it('dispatches row actions', fakeAsync(() => {
      init();
      const spies = ['initAddCategory', 'startEdit', 'toggleStatus', 'deleteCategory'].map(n => spyOn(component as any, n));
      ['addChild', 'edit', 'toggleStatus', 'delete', 'unknown'].forEach(a => component.handleRowAction(a, node(1)!));
      expect(spies[0]).toHaveBeenCalledWith(1);
      spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
      component.handleToolbarAction('unknown');
      discardPeriodicTasks();
    }));
  });

  describe('add and rename', () => {
    /**
     * @description A new main category is added on top in edit mode and saved as inactive.
     * @input  handleToolbarAction('addMain'); name 'Hračky'; handleEditAction('submit')
     * @output first root is the new node (id 0, editing); post('shop/categories', { name: 'Hračky', parent_id: null, is_active: false }); placeholder removed; success alert; tree reloaded
     */
    it('adds a main category', fakeAsync(() => {
      init();
      component.handleToolbarAction('addMain');
      const fresh = component.categories[0];
      expect([fresh.id, fresh.isEditing]).toEqual([0, true]);
      fresh.name = 'Hračky';
      component.handleEditAction('submit', fresh);
      expect(dh().post).toHaveBeenCalledWith('shop/categories', { name: 'Hračky', parent_id: null, is_active: false });
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'shop-categories.category_created_message', 'success');
      expect(component.categories.some(c => c.id === 0)).toBeFalse();
      expect(dh().getCollection).toHaveBeenCalledTimes(2);
      discardPeriodicTasks();
    }));

    /**
     * @description A subcategory is added under its (expanded) parent, also deep in the tree; a failure reloads the tree.
     * @input  initAddCategory(2); name 'iOS'; submit with post failing
     * @output Telefony expanded with the new node first; post with parent_id 2; placeholder removed; tree reloaded
     */
    it('adds a subcategory', fakeAsync(() => {
      init();
      component.initAddCategory(2);
      const parent = node(2)!;
      expect(parent.isExpanded).toBeTrue();
      const fresh = parent.children[0];
      expect(fresh.id).toBe(0);
      fresh.name = 'iOS';
      dh().post.and.returnValue(throwError(() => new Error('x')));
      component.handleEditAction('submit', fresh);
      expect(dh().post).toHaveBeenCalledWith('shop/categories', { name: 'iOS', parent_id: 2, is_active: false });
      expect(dh().getCollection).toHaveBeenCalledTimes(2);
      discardPeriodicTasks();
    }));

    /**
     * @description Empty or duplicate names are not saved; cancelling a new node reloads the tree.
     * @input  new root with '' and then 'Elektro'; handleEditAction('cancel')
     * @output post not called; tree reloaded on cancel
     */
    it('does not save invalid new names', fakeAsync(() => {
      init();
      component.initAddCategory(null);
      const fresh = component.categories[0];
      component.handleEditAction('submit', fresh);
      fresh.name = 'Elektro';
      component.handleEditAction('submit', fresh);
      expect(dh().post).not.toHaveBeenCalled();
      component.handleEditAction('cancel', fresh);
      expect(dh().getCollection).toHaveBeenCalledTimes(2);
      discardPeriodicTasks();
    }));

    /**
     * @description Renaming: edit mode focuses the input, save sends name and parent; cancel restores the old name.
     * @input  startEdit(Elektro); input element; tick; name 'Elektronika'; submit; then startEdit + cancel
     * @output input focused; put('shop/categories/1', { name: 'Elektronika', parent_id: null }); alert 'shop-categories.changes_saved_message'; cancel restores 'Elektronika'
     */
    it('renames a category', fakeAsync(() => {
      init();
      fixture.detectChanges();
      const cat = node(1)!;
      component.startEdit(cat);
      fixture.detectChanges();
      tick();
      expect(cat.isEditing).toBeTrue();
      expect(document.activeElement?.classList.contains('edit-input')).toBeTrue();
      cat.name = 'Elektronika';
      component.handleEditAction('submit', cat);
      expect(dh().put).toHaveBeenCalledWith('shop/categories/1', { name: 'Elektronika', parent_id: null });
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-categories.updated_title', 'shop-categories.changes_saved_message', 'success');
      expect(cat.isEditing).toBeFalse();
      component.startEdit(cat);
      cat.name = 'Typo';
      component.handleEditAction('cancel', cat);
      expect(cat.name).toBe('Elektronika');
      expect(cat.isEditing).toBeFalse();
      component.cancelEdit(node(3)!);
      expect(node(3)!.name).toBe('Oblečení');
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description A failed rename keeps the edit mode; without the update permission editing does not start.
     * @input  put fails; saveNode(Elektro); then granted [] and startEdit(Oblečení)
     * @output Elektro still editing; Oblečení not editing
     */
    it('handles a failed rename and the missing permission', fakeAsync(() => {
      init();
      dh().put.and.returnValue(throwError(() => new Error('x')));
      component.saveNode(node(1)!);
      expect(node(1)!.isEditing).toBeTrue();
      ctx.permissions.granted = new Set();
      component.startEdit(node(3)!);
      expect(node(3)!.isEditing).toBeFalsy();
      discardPeriodicTasks();
    }));
  });

  describe('status and delete', () => {
    /**
     * @description Activating sends the whole node with the new state; a failure rolls the switch back.
     * @input  toggleStatus(Oblečení) succeeds; then toggleStatus(Elektro) fails
     * @output put('shop/categories/3', { …, is_active: true }); Oblečení active; Elektro back to active after failure
     */
    it('toggles the active state with rollback', fakeAsync(() => {
      init();
      component.toggleStatus(node(3)!);
      expect(dh().put.calls.mostRecent().args[0]).toBe('shop/categories/3');
      expect(dh().put.calls.mostRecent().args[1].is_active).toBeTrue();
      expect(node(3)!.is_active).toBeTrue();
      dh().put.and.returnValue(throwError(() => new Error('x')));
      component.toggleStatus(node(1)!);
      expect(node(1)!.is_active).toBeTrue();
      discardPeriodicTasks();
    }));

    /**
     * @description Categories with subcategories or products cannot be deleted.
     * @input  deleteCategory(Elektro) (has Telefony); cannot_delete_has_products '{name}:{count}'; Android with products_count 2
     * @output warnings 'shop-categories.cannot_delete_has_subcategories' and 'Android:2'; nothing deleted
     */
    it('refuses to delete categories with children or products', fakeAsync(async () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'shop-categories.cannot_delete_has_products' ? '{name}:{count}' : p));
      init();
      await component.deleteCategory(node(1)!);
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-categories.cannot_delete_title', 'shop-categories.cannot_delete_has_subcategories', 'warning');
      node(4)!.products_count = 2;
      await component.deleteCategory(node(4)!);
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-categories.cannot_delete_title', 'Android:2', 'warning');
      expect(dh().delete).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description An empty category is deleted after confirmation, removed from the tree and its panel closed.
     * @input  Android selected in the panel; confirm → false, then true
     * @output after cancel nothing deleted; delete('shop/categories/4'); Android removed from Telefony; success alert; panel closed
     */
    it('deletes an empty category after confirmation', fakeAsync(async () => {
      init();
      component.openProductPanel(node(4)!, click);
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.deleteCategory(node(4)!);
      expect(dh().delete).not.toHaveBeenCalled();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.deleteCategory(node(4)!);
      expect(dh().delete).toHaveBeenCalledWith('shop/categories/4');
      expect(node(2)!.children).toEqual([]);
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-categories.deleted_title', 'shop-categories.category_deleted_message', 'success');
      expect(component.selectedCategory).toBeNull();
      await component.deleteCategory(node(3)!);
      expect(node(3)).toBeUndefined();
      discardPeriodicTasks();
    }));

    /**
     * @description A failed delete reloads the tree from the server.
     * @input  delete fails; deleteCategory(Oblečení) confirmed
     * @output tree requested again
     */
    it('reloads the tree when deleting fails', fakeAsync(async () => {
      init();
      dh().delete.and.returnValue(throwError(() => new Error('x')));
      await component.deleteCategory(node(3)!);
      expect(dh().getCollection).toHaveBeenCalledTimes(2);
      discardPeriodicTasks();
    }));
  });

  describe('products panel', () => {
    const phones = [
      { id: 10, name: 'Pixel 9', sku: 'PX9', categories: [{ id: 2 }, { id: 1 }] },
      { id: 11, name: 'Galaxy', sku: 'SM-S', categories: [{ id: 2 }] }
    ];

    beforeEach(() => {
      dh().getCollection.and.callFake((url: string) => {
        if (url === TREE_URL) return of(flat());
        if (url === 'shop/products?no_pagination=true&category_id=2') return of(phones);
        if (url === 'shop/products?no_pagination=true') return of([...phones, { id: 12, name: 'Mikina', sku: 'MK' }, { id: 13, name: 'Tričko', sku: 'TR-1' }]);
        return of([]);
      });
    });

    /**
     * @description Opening the panel loads the products of the category; the placeholder node has no panel.
     * @input  openProductPanel(Telefony); then a node with id 0; search 'px'; search 'sm-'
     * @output getCollection('shop/products?no_pagination=true&category_id=2'); 2 products; id 0 ignored; filtered by name / SKU
     */
    it('shows and searches the products of a category', fakeAsync(() => {
      init();
      component.openProductPanel(node(2)!, click);
      expect(component.selectedCategory?.id).toBe(2);
      expect(component.categoryProducts.length).toBe(2);
      expect(component.loadingProducts).toBeFalse();
      component.openProductPanel({ id: 0 } as any, click);
      expect(component.selectedCategory?.id).toBe(2);
      expect(component.filteredCategoryProducts.length).toBe(2);
      component.productSearch = 'px';
      expect(component.filteredCategoryProducts.map(p => p.id)).toEqual([10]);
      component.productSearch = 'sm-';
      expect(component.filteredCategoryProducts.map(p => p.id)).toEqual([11]);
      component.closeProductPanel();
      expect(component.selectedCategory).toBeNull();
      expect(component.categoryProducts).toEqual([]);
      discardPeriodicTasks();
    }));

    /**
     * @description The "add product" list loads all products once and offers only those not in the category.
     * @input  openAddProductSearch() twice; addProductSearch 'tr'
     * @output all products requested once; offered [12, 13]; search → [13]
     */
    it('offers products that are not in the category yet', fakeAsync(() => {
      init();
      component.openProductPanel(node(2)!, click);
      component.openAddProductSearch();
      component.openAddProductSearch();
      expect(dh().getCollection.calls.allArgs().filter((a: any[]) => a[0] === 'shop/products?no_pagination=true').length).toBe(1);
      expect(component.showAddProduct).toBeTrue();
      expect(component.filteredAllProducts.map(p => p.id)).toEqual([12, 13]);
      component.addProductSearch = 'tr';
      expect(component.filteredAllProducts.map(p => p.id)).toEqual([13]);
      discardPeriodicTasks();
    }));

    /**
     * @description Loading failures of the panel lists end the loading state.
     * @input  category products and all products requests fail
     * @output loadingProducts false; allProducts []
     */
    it('survives failed product requests', fakeAsync(() => {
      init();
      dh().getCollection.and.callFake((url: string) => (url === TREE_URL ? of(flat()) : throwError(() => new Error('x'))));
      component.openProductPanel(node(3)!, click);
      expect(component.loadingProducts).toBeFalse();
      component.openAddProductSearch();
      expect(component.allProducts).toEqual([]);
      discardPeriodicTasks();
    }));

    /**
     * @description Adding a product keeps its other categories and makes this one primary.
     * @input  panel Oblečení (3); addProductToCategory(Pixel 9 in [2, 1]); product without categories; no panel
     * @output patch('shop/products/10/category', { category_id: 3, category_ids: [2, 1, 3] }); { 3, [3] } for the second; success alert; nothing without a panel
     */
    it('adds a product to the category', fakeAsync(() => {
      init();
      component.openProductPanel(node(3)!, click);
      component.addProductToCategory(phones[0]);
      expect(dh().patch).toHaveBeenCalledWith('shop/products/10/category', { category_id: 3, category_ids: [2, 1, 3] });
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-categories.done_title', 'shop-categories.product_added_message', 'success');
      component.addProductToCategory({ id: 12 });
      expect(dh().patch).toHaveBeenCalledWith('shop/products/12/category', { category_id: 3, category_ids: [3] });
      spyOn(console, 'error');
      dh().patch.and.returnValue(throwError(() => new Error('x')));
      component.addProductToCategory({ id: 13 });
      expect(component.loadingProducts).toBeFalse();
      component.closeProductPanel();
      dh().patch.calls.reset();
      component.addProductToCategory({ id: 13 });
      expect(dh().patch).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description Removing a product asks first and moves the primary category to the next remaining one.
     * @input  panel Telefony (2); remove_product_confirm_message '{product}|{category}'; remove Pixel 9 ([2, 1]), then Galaxy ([2])
     * @output confirm 'Pixel 9|Telefony'; patch { category_id: 1, category_ids: [1] }; then { null, [] }; success alert; products reloaded
     */
    it('removes a product from the category', fakeAsync(async () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'shop-categories.remove_product_confirm_message' ? '{product}|{category}' : p));
      init();
      component.openProductPanel(node(2)!, click);
      await component.removeProductFromCategory(phones[0]);
      expect(ctx.confirm.open).toHaveBeenCalledWith('shop-categories.remove_product_confirm_title', 'Pixel 9|Telefony');
      expect(dh().patch).toHaveBeenCalledWith('shop/products/10/category', { category_id: 1, category_ids: [1] });
      await component.removeProductFromCategory(phones[1]);
      expect(dh().patch).toHaveBeenCalledWith('shop/products/11/category', { category_id: null, category_ids: [] });
      await component.removeProductFromCategory({ id: 14, name: 'X' });
      expect(dh().patch).toHaveBeenCalledWith('shop/products/14/category', { category_id: null, category_ids: [] });
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-categories.done_title', 'shop-categories.product_removed_message', 'success');
      discardPeriodicTasks();
    }));

    /**
     * @description Removing does nothing when cancelled or without a panel; a failure ends loading; a closed panel is not reloaded.
     * @input  confirm → false; no panel (confirm text without category); patch fails; panel closed while the request runs
     * @output no patch for the first two; loadingProducts false after failure; no product reload after the panel was closed
     */
    it('guards removing products', fakeAsync(async () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'shop-categories.remove_product_confirm_message' ? '{product}|{category}' : p));
      init();
      component.openProductPanel(node(2)!, click);
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.removeProductFromCategory(phones[0]);
      component.closeProductPanel();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.removeProductFromCategory(phones[0]);
      expect(ctx.confirm.open).toHaveBeenCalledWith('shop-categories.remove_product_confirm_title', 'Pixel 9|');
      expect(dh().patch).not.toHaveBeenCalled();
      component.openProductPanel(node(2)!, click);
      spyOn(console, 'error');
      dh().patch.and.returnValue(throwError(() => new Error('x')));
      await component.removeProductFromCategory(phones[0]);
      expect(component.loadingProducts).toBeFalse();
      const response$ = new Subject<any>();
      dh().patch.and.returnValue(response$);
      await component.removeProductFromCategory(phones[0]);
      component.closeProductPanel();
      dh().getCollection.calls.reset();
      response$.next({});
      expect(dh().getCollection.calls.allArgs().some((a: any[]) => String(a[0]).includes('category_id='))).toBeFalse();
      discardPeriodicTasks();
    }));
  });

  /**
   * @description The tree, the edit row and the product panel render.
   * @input  detectChanges() after loading; expand all; add a main category; open the panel of Telefony
   * @output names 'Elektro', 'Android' and 'Pixel 9' rendered; empty-name error 'shop-categories.error_name_empty'
   */
  it('renders tree, edit row and product panel', fakeAsync(() => {
    dh().getCollection.and.callFake((url: string) =>
      of(url === TREE_URL ? flat() : [{ id: 10, name: 'Pixel 9', sku: 'PX9', categories: [{ id: 2 }] }]));
    fixture.detectChanges();
    component.expandAll(true);
    component.initAddCategory(null);
    component.openProductPanel(node(2)!, click);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Elektro');
    expect(text).toContain('Android');
    expect(text).toContain('Pixel 9');
    expect(text).toContain('shop-categories.error_name_empty');
    flush();
    discardPeriodicTasks();
  }));
});
