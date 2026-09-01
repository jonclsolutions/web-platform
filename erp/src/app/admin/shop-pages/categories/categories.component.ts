/**
 * @file categories.component.ts
 * @path src/app/admin/shop-pages/categories/categories.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages a hierarchical tree of shop categories, including CRUD operations and product-to-category assignments.
 * @dependencies
 * - Core services: DataHandler, GenericTableService, LoadingService.
 * - Shared UI: SHARED_UI_BUILDERS, ConfirmDialogService.
 * - BaseDataComponent: Provides foundational data management for entity collections.
 * - ResourceCacheService: TTL cache pro strom kategorií, panel produktů kategorie a
 *   seznam "všech produktů" v add-product panelu (viz refactor-note 2026-08-9).
 *
 * @refactor-note (2026-08-9) TTL CACHE (backlog: "zbytečně moc dotazů na API").
 * Tahle stránka NEPOUŽÍVÁ standardní `this.list`/`this.data` (PaginatedListStore) -
 * strom kategorií je vlastní rekurzivní struktura postavená přes `loadAllData()`
 * (no_pagination fetch) a `buildTree()`. `usesPaginatedList = false`, ať
 * `BaseDataComponent.initWithAuthCheck()` při mountu volá přímo `refreshData()`
 * (= `loadTree()`), místo aby zbytečně tahal nepoužívaná stránkovaná
 * `shop/categories` data přes `this.list` (viz base-data.component.ts stejné datum -
 * bez tohohle přepínače by se strom při vstupu na stránku vůbec nenačetl).
 * Ze stejného důvodu je `forceFullRefresh()` PŘEPSANÝ (ne zděděný) - jinak by globální
 * "Aktualizovat vše" tlačítko v headeru a periodický background refresh volaly
 * `this.list.forceFullRefresh()` (opět nepoužitá data), ne skutečný strom.
 *
 * `loadTree()` teď jde přes `ResourceCacheService` (2min TTL) - mount i drobné
 * navigace v menu tak nemusí pokaždé znovu stahovat celý (potenciálně velký) strom.
 * Force-bypass (parametr `force`) se použije všude, kde už PROBĚHLA mutace dat
 * (create/update/toggle/delete kategorie, přiřazení/odebrání produktu) - tam musí
 * uživatel vidět čerstvý stav okamžitě, ne až po vypršení TTL.
 * `loadCategoryProducts()` (panel produktů dané kategorie) a `openAddProductSearch()`
 * (seznam všech produktů k přidání) mají vlastní krátkou TTL cache (2 min) - typický
 * admin otevírá/zavírá panel různých kategorií opakovaně během jedné návštěvy stránky.
 *
 * @bugfix-note (2026-08-31) KRITICKÝ BUG - DVOJITÉ ZOBRAZENÍ CHYBOVÉ HLÁŠKY: Odstraněna
 * VŠECHNA vlastní `alertDialogService.open('Chyba', ...)` volání z `error:` callbacků
 * (confirmAdd, saveNode, toggleStatus, deleteCategory) - `DataHandler.handleError()` je
 * od tohoto data JEDINÉ a AUTORITATIVNÍ místo, které smí chybový toast zobrazit (viz
 * data-handler.service.ts bugfix-note stejné datum). Veškerá NON-toast logika v těchto
 * `error:` callbacích (rollback lokálního stavu - `node.isEditing = true`, vrácení
 * `node.is_active`, `loadTree()` refetch) ZŮSTÁVÁ beze změny - odstraněno je výhradně
 * volání `alertDialogService.open(...)`. `removeProductFromCategory()`,
 * `addProductToCategory()`, `loadCategoryProducts()`, `openAddProductSearch()` a
 * `loadTree()` už žádný vlastní toast neměly, beze změny.
 */

import { Component, OnInit, ViewChildren, QueryList, ElementRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { CategoryNode } from '../components/interfaces/category-node';
import { Button } from '../../../shared/interfaces/button';
import { CATEGORY_TOOLBAR_BUTTONS, CATEGORY_ROW_BUTTONS } from './categories.config';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';

/**
 * @description Orchestrates the category management interface, handling recursive tree display, editing, and side-panel product associations.
 * @usage Used in the shop administration area to structure the product catalog.
 * @note Implements recursive tree building and maintains local state for expansion and editing modes.
 */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, SHARED_UI_BUILDERS],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesComponent extends BaseDataComponent<CategoryNode> implements OnInit {
  @ViewChildren('editInput') editInputs!: QueryList<ElementRef>;

  override apiEndpoint = 'shop/categories';
  override usesPaginatedList = false;

  categories: CategoryNode[] = [];

  private resourceCache = inject(ResourceCacheService);
  private readonly TREE_CACHE_KEY = 'shop-categories:tree';
  private readonly TREE_TTL_MS = 2 * 60 * 1000;
  private readonly CATEGORY_PRODUCTS_CACHE_PREFIX = 'shop-categories:products:';
  private readonly CATEGORY_PRODUCTS_TTL_MS = 2 * 60 * 1000;
  private readonly ALL_PRODUCTS_CACHE_KEY = 'shop-categories:all-products';
  private readonly ALL_PRODUCTS_TTL_MS = 2 * 60 * 1000;

  // Produkt panel
  selectedCategory: CategoryNode | null = null;
  categoryProducts: any[] = [];
  allProducts: any[] = [];
  loadingProducts = false;
  showAddProduct = false;
  productSearch = '';
  addProductSearch = '';

  private backupNames: Map<number, string> = new Map();
  private expandedStates: Set<number> = new Set();

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private confirmDialogService: ConfirmDialogService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadExpandedStates();
    this.initWithAuthCheck(this.router);
  }

  /**
   * @description "Jemné" počáteční/navigační načtení stromu - respektuje TTL cache.
   */
  override refreshData(): void {
    this.loadTree(undefined, false, false);
  }

  /**
   * @description "Tvrdý" refresh stromu - obchází TTL cache. Voláno globálním
   * "Aktualizovat vše" tlačítkem v headeru a periodickým background refreshem (viz
   * BaseDataComponent.initWithAuthCheck()). PŘEPISUJE zděděnou implementaci, která by
   * jinak volala `this.list.forceFullRefresh()` - nepoužívaná data pro tuhle stránku.
   */
  override forceFullRefresh(_currentFilters: Core.FilterParams = this.defaultFilters): void {
    this.loadTree(undefined, false, true);
  }

  /**
   * @description Provides the configuration for global category management toolbar buttons.
   * @returns {Button[]} List of toolbar buttons.
   */
  get toolbarButtons(): Button[] {
    return CATEGORY_TOOLBAR_BUTTONS;
  }

  /**
   * @description Dynamically generates action buttons for individual category rows, adjusting labels and classes based on status.
   * @param node The category node being rendered.
   * @returns {Button[]} Array of action buttons.
   * @icons-note (2026) Emoji odstraněny - stav (aktivní/neaktivní) teď nese jen text +
   *      barva tlačítka (btn-export = zelená / btn-filter = neutrální šedá), bez
   *      barevných emoji teček.
   */
  getRowButtons(node: CategoryNode): Button[] {
    return CATEGORY_ROW_BUTTONS.map(btn => {
      const updatedBtn = { ...btn };
      if (btn.action === 'toggleStatus') {
        updatedBtn.label = node.is_active ? 'Aktivní' : 'Neaktivní';
        updatedBtn.class = node.is_active ? 'btn-export' : 'btn-filter';
      }
      return updatedBtn;
    });
  }

  /**
   * @description Returns save/cancel buttons for nodes currently in editing mode.
   * @param node The category node in edit state.
   * @returns {Button[]} Array of edit action buttons.
   * @icons-note (2026-08-31) EMOJI -> SVG: `✓`/`✕` nahrazeny IconName klíči
   *      `check`/`x` (viz icon.component.ts/.html stejné datum).
   */
  getEditButtons(node: CategoryNode): Button[] {
    const isDuplicate = this.isDuplicateName(node);
    const isEmpty = !node.name || node.name.trim().length === 0;

    return [
      { action: 'submit', label: 'Uložit', icon: 'check', class: 'btn-create', disabled: isDuplicate || isEmpty },
      { action: 'cancel', label: 'Zrušit', icon: 'x', class: 'btn-trash' }
    ];
  }

  /**
   * @description Recursively checks the tree to ensure no two categories at the same hierarchy level share the same name.
   * @param node The node being checked.
   * @returns {boolean} True if a duplicate name is found.
   */
  isDuplicateName(node: CategoryNode): boolean {
    const check = (list: CategoryNode[]): boolean => {
      for (const cat of list) {
        if (cat.id !== node.id && cat.parent_id === node.parent_id && cat.name.toLowerCase() === node.name.toLowerCase()) return true;
        if (cat.children?.length && check(cat.children)) return true;
      }
      return false;
    };
    return check(this.categories);
  }

  /**
   * @description Dispatches actions triggered from the main module toolbar.
   * @param action The requested toolbar action identifier.
   */
  handleToolbarAction(action: string): void {
    if (action === 'expandAll') this.expandAll(true);
    if (action === 'collapseAll') this.expandAll(false);
    if (action === 'addMain') this.initAddCategory(null);
  }

  /**
   * @description Dispatches row-specific category actions.
   * @param action The requested row action identifier.
   * @param node The target category node.
   */
  handleRowAction(action: string, node: CategoryNode): void {
    switch (action) {
      case 'addChild': this.initAddCategory(node.id); break;
      case 'edit': this.startEdit(node); break;
      case 'toggleStatus': this.toggleStatus(node); break;
      case 'delete': this.deleteCategory(node); break;
    }
  }

  /**
   * @description Handles submission or cancellation of an active edit session.
   * @param action The edit action identifier (submit/cancel).
   * @param node The category node being edited.
   */
  handleEditAction(action: string, node: CategoryNode): void {
    if (action === 'submit') {
      if (!node.name || node.name.trim().length === 0 || this.isDuplicateName(node)) return;
      if (node.id === 0) this.confirmAdd(node); else this.saveNode(node);
    } else {
      if (node.id === 0) this.loadTree(undefined, false, true); else this.cancelEdit(node);
    }
  }

  /**
   * @description Temporarily injects a new category node into the tree display for immediate user input.
   * @param parentId The parent ID under which the new node is placed, or null for root-level.
   */
  initAddCategory(parentId: number | null): void {
    const newNode: any = { id: 0, name: '', parent_id: parentId, isEditing: true, is_active: false, children: [] };
    if (!parentId) {
      this.categories = [newNode, ...this.categories];
    } else {
      const findAndAdd = (list: CategoryNode[]) => {
        for (const n of list) {
          if (n.id === parentId) {
            n.isExpanded = true;
            this.expandedStates.add(n.id);
            n.children = [newNode, ...(n.children || [])];
            return;
          }
          if (n.children) findAndAdd(n.children);
        }
      };
      findAndAdd(this.categories);
    }
    this.cd.detectChanges();
  }

  /**
   * @description Persists a newly created category node to the backend API.
   * @param node The new node to be created.
   * @bugfix-note (2026-08-31) Odstraněn duplicitní `alertDialogService.open('Chyba', ...)`
   * z `error:` callbacku - `loadTree()` refetch ZŮSTÁVÁ. Viz bugfix-note v hlavičce souboru.
   */
  confirmAdd(node: CategoryNode): void {
    const parentId = node.parent_id;
    if (!parentId) {
      this.categories = this.categories.filter(c => c.id !== 0);
    } else {
      this.removeNewNodeFromParent(this.categories, parentId);
    }
    this.cd.markForCheck();

    this.postData({ name: node.name, parent_id: node.parent_id, is_active: false } as CategoryNode)
      .subscribe({
        next: () => {
          this.alertDialogService.open('Úspěch', 'Kategorie byla vytvořena.', 'success');
          this.loadTree(undefined, false, true);
        },
        error: () => {
          this.loadTree(undefined, false, true);
        }
      });
  }

  /**
   * @description Helper to remove the temporary 'new' node if an API request fails or is canceled.
   * @param nodes The current tree structure.
   * @param parentId The parent node to clean up.
   */
  private removeNewNodeFromParent(nodes: CategoryNode[], parentId: number): void {
    for (const node of nodes) {
      if (node.id === parentId) {
        node.children = node.children?.filter(c => c.id !== 0) || [];
        return;
      }
      if (node.children?.length) {
        this.removeNewNodeFromParent(node.children, parentId);
      }
    }
  }

  /**
   * @description Enables editing mode for a specific category and focuses the input field.
   * @param node The category node to edit.
   */
  startEdit(node: CategoryNode): void {
    this.backupNames.set(node.id, node.name);
    node.isEditing = true;
    this.cd.detectChanges();
    setTimeout(() => this.editInputs.last?.nativeElement.focus(), 0);
  }

  /**
   * @description Reverts name changes and exits editing mode.
   * @param node The category node to restore.
   */
  cancelEdit(node: CategoryNode): void {
    const originalName = this.backupNames.get(node.id);
    if (originalName !== undefined) node.name = originalName;
    node.isEditing = false;
    this.backupNames.delete(node.id);
    this.cd.markForCheck();
  }

  /**
   * @description Fetches the full category list (přes TTL cache - viz refactor-note
   * v hlavičce souboru) and builds the recursive tree structure.
   * @param forceExpandId Optional ID to ensure specific branch remains open after refresh.
   * @param silent If true, suppresses global loading spinner.
   * @param force If true, invaliduje cache a vynutí reálný fetch (po mutaci dat).
   */
  loadTree(forceExpandId?: number | null, silent: boolean = false, force: boolean = false): void {
    if (!silent) {
      this.loadingService.show();
    }
    if (force) {
      this.resourceCache.invalidate(this.TREE_CACHE_KEY);
    }

    this.resourceCache.get(this.TREE_CACHE_KEY, () => this.loadAllData(), this.TREE_TTL_MS).subscribe({
      next: (res) => {
        this.categories = this.buildTree(res, null, forceExpandId);
        this.cd.markForCheck();
        if (!silent) {
          this.loadingService.hide();
        }
      },
      error: () => {
        if (!silent) {
          this.loadingService.hide();
        }
      }
    });
  }

  /**
   * @description Transforms a flat list of items into a hierarchical nested tree.
   * @param list Raw list from API.
   * @param parentId The parent ID to map children for.
   * @param forceExpandId The node ID to force-expand.
   * @returns {CategoryNode[]} Nested tree structure.
   */
  buildTree(list: CategoryNode[], parentId: number | null = null, forceExpandId?: number | null): CategoryNode[] {
    return list
      .filter(item => item.parent_id === parentId)
      .map(item => {
        const children = this.buildTree(list, item.id, forceExpandId);
        return {
          ...item,
          children,
          directChildrenCount: children.length,
          totalRecursiveCount: children.reduce((acc, child) => acc + 1 + (child.totalRecursiveCount || 0), 0),
          isExpanded: this.expandedStates.has(item.id) || item.id === forceExpandId
        };
      });
  }

  /**
   * @description Recursively updates expanded state for all tree nodes.
   * @param state Boolean target state (true=expand, false=collapse).
   */
  expandAll(state: boolean): void {
    const toggle = (nodes: CategoryNode[]) => {
      nodes.forEach(n => {
        n.isExpanded = state;
        if (state) {
          this.expandedStates.add(n.id);
        } else {
          this.expandedStates.delete(n.id);
        }
        if (n.children) toggle(n.children);
      });
    };
    toggle(this.categories);
    this.saveExpandedStates();
    this.cd.markForCheck();
  }

  /**
   * @description Updates an existing category's properties via the API.
   * @param node The updated node object.
   * @bugfix-note (2026-08-31) Odstraněn duplicitní `alertDialogService.open('Chyba', ...)`
   * z `error:` callbacku - rollback `node.isEditing = true` ZŮSTÁVÁ. Viz bugfix-note
   * v hlavičce souboru.
   */
  saveNode(node: CategoryNode): void {
    node.isEditing = false;
    this.cd.markForCheck();

    this.updateData(node.id, { name: node.name, parent_id: node.parent_id } as CategoryNode)
      .subscribe({
        next: () => {
          this.alertDialogService.open('Aktualizováno', 'Změny byly uloženy.', 'success');
          this.backupNames.delete(node.id);
          this.resourceCache.invalidate(this.TREE_CACHE_KEY);
          this.cd.markForCheck();
        },
        error: () => {
          node.isEditing = true;
          this.cd.markForCheck();
        }
      });
  }

  /**
   * @description Toggles category active status and propagates the change to the API.
   * @param node The category to update.
   * @bugfix-note (2026-08-31) Odstraněn duplicitní `alertDialogService.open('Chyba', ...)`
   * z `error:` callbacku - rollback `node.is_active` ZŮSTÁVÁ. Viz bugfix-note v hlavičce
   * souboru.
   */
  toggleStatus(node: CategoryNode): void {
    const newStatus = !node.is_active;
    node.is_active = newStatus;
    this.cd.markForCheck();

    this.updateData(node.id, { ...node, is_active: newStatus })
      .subscribe({
        next: () => { this.resourceCache.invalidate(this.TREE_CACHE_KEY); },
        error: () => {
          node.is_active = !newStatus;
          this.cd.markForCheck();
        }
      });
  }

  /**
   * @description Validates delete conditions and removes a category node from the database.
   * @param node The category to delete.
   * @bugfix-note (2026-08-31) Odstraněn duplicitní `alertDialogService.open('Chyba', ...)`
   * z `error:` callbacku - `loadTree()` refetch ZŮSTÁVÁ. Viz bugfix-note v hlavičce
   * souboru. Pre-check `alertDialogService.open('Nelze smazat', ...)` volání NÍŽE
   * (validace podkategorií/přiřazených produktů) NEJSOU chyby z API, jsou to lokální
   * validace PŘED odesláním requestu - zůstávají beze změny, nejde o duplicitu.
   */
  async deleteCategory(node: CategoryNode): Promise<void> {
    if (node.children?.length) {
      await this.alertDialogService.open('Nelze smazat', 'Smažte nejdříve podkategorie.', 'warning');
      return;
    }
    if (node.products_count && node.products_count > 0) {
      await this.alertDialogService.open(
        'Nelze smazat',
        `Kategorii "${node.name}" nelze smazat, protože obsahuje přiřazené produkty (${node.products_count}). Nejdříve produkty přesuňte nebo smažte.`,
        'warning'
      );
      return;
    }

    const confirmed = await this.confirmDialogService.open(
      'Potvrdit smazání',
      `Opravdu si přejete smazat kategorii "${node.name}"?`
    );

    if (confirmed) {
      this.removeNodeFromTree(node.id);
      this.expandedStates.delete(node.id);
      this.cd.markForCheck();

      this.deleteData(node.id).subscribe({
        next: () => {
          this.alertDialogService.open('Smazáno', 'Kategorie byla odstraněna.', 'success');
          this.saveExpandedStates();
          this.resourceCache.invalidate(this.TREE_CACHE_KEY);
          if (this.selectedCategory?.id === node.id) {
            this.closeProductPanel();
          }
        },
        error: () => {
          this.loadTree(undefined, false, true);
        }
      });
    }
  }

  /**
   * @description Removes a node from the local memory tree.
   * @param nodeId ID of the node to remove.
   */
  private removeNodeFromTree(nodeId: number): void {
    const removeRecursive = (nodes: CategoryNode[]): boolean => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === nodeId) {
          nodes.splice(i, 1);
          return true;
        }
        if (nodes[i].children?.length && removeRecursive(nodes[i].children)) {
          return true;
        }
      }
      return false;
    };
    removeRecursive(this.categories);
  }

  /**
   * @description Toggles expansion state for a category branch.
   * @param node The category node to toggle.
   * @param event The mouse event to stop propagation.
   */
  toggleExpanded(node: CategoryNode, event?: Event): void {
    if (event) event.stopPropagation();
    if (!node.children?.length) return;

    node.isExpanded = !node.isExpanded;

    if (node.isExpanded) {
      this.expandedStates.add(node.id);
    } else {
      this.expandedStates.delete(node.id);
    }

    this.saveExpandedStates();
    this.cd.markForCheck();
  }

  /**
   * @description Persists expansion states to localStorage for persistent session view.
   */
  private saveExpandedStates(): void {
    localStorage.setItem('categoryExpandedStates', JSON.stringify(Array.from(this.expandedStates)));
  }

  /**
   * @description Loads persisted expansion states from localStorage.
   */
  private loadExpandedStates(): void {
    const saved = localStorage.getItem('categoryExpandedStates');
    if (saved) {
      this.expandedStates = new Set(JSON.parse(saved));
    }
  }

  // =====================
  // PRODUKT PANEL
  // =====================

  /**
   * @description Opens the side panel displaying products associated with the selected category.
   * @param node The selected category.
   * @param event Mouse event to stop propagation.
   */
  openProductPanel(node: CategoryNode, event: Event): void {
    event.stopPropagation();
    if (node.id === 0) return;
    this.selectedCategory = node;
    this.showAddProduct = false;
    this.productSearch = '';
    this.addProductSearch = '';
    this.loadCategoryProducts(node.id);
    this.cd.markForCheck();
  }

  /**
   * @description Closes the product management side panel and resets search buffers.
   */
  closeProductPanel(): void {
    this.selectedCategory = null;
    this.categoryProducts = [];
    this.allProducts = [];
    this.showAddProduct = false;
    this.productSearch = '';
    this.addProductSearch = '';
    this.cd.markForCheck();
  }

  /**
   * @description Fetches all products currently assigned to the specific category, přes
   * krátkou TTL cache (viz refactor-note v hlavičce souboru).
   * @param categoryId The ID of the category.
   * @param force Bypass cache (voláno po mutaci přiřazení produktu).
   */
  loadCategoryProducts(categoryId: number, force: boolean = false): void {
    this.loadingProducts = true;
    this.cd.markForCheck();

    const key = `${this.CATEGORY_PRODUCTS_CACHE_PREFIX}${categoryId}`;
    if (force) this.resourceCache.invalidate(key);

    this.resourceCache.get(
      key,
      () => this.dataHandler.getCollection<any>(`shop/products?no_pagination=true&category_id=${categoryId}`),
      this.CATEGORY_PRODUCTS_TTL_MS
    ).subscribe({
      next: (products) => {
        this.categoryProducts = products;
        this.loadingProducts = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.loadingProducts = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Filtered list of products already inside the category.
   * @returns {any[]} List of products matching the search query.
   */
  get filteredCategoryProducts(): any[] {
    if (!this.productSearch.trim()) return this.categoryProducts;
    const s = this.productSearch.toLowerCase();
    return this.categoryProducts.filter(p =>
      p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s)
    );
  }

  /**
   * @description List of products available for addition to the selected category, filtered by exclusion of already added products.
   * @returns {any[]} Available products.
   */
  get filteredAllProducts(): any[] {
    const categoryProductIds = new Set(this.categoryProducts.map(p => p.id));
    let products = this.allProducts.filter(p => !categoryProductIds.has(p.id));
    if (this.addProductSearch.trim()) {
      const s = this.addProductSearch.toLowerCase();
      products = products.filter(p =>
        p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s)
      );
    }
    return products;
  }

  /**
   * @description Prepares the add-product view and lazily loads all products (přes TTL
   * cache - viz refactor-note v hlavičce souboru) if necessary.
   */
  openAddProductSearch(): void {
    this.showAddProduct = true;
    this.addProductSearch = '';

    if (this.allProducts.length === 0) {
      this.resourceCache.get(
        this.ALL_PRODUCTS_CACHE_KEY,
        () => this.dataHandler.getCollection<any>('shop/products?no_pagination=true'),
        this.ALL_PRODUCTS_TTL_MS
      ).subscribe({
        next: (products) => {
          this.allProducts = products;
          this.cd.markForCheck();
        },
        error: () => {
          this.cd.markForCheck();
        }
      });
    }

    this.cd.markForCheck();
  }

  /**
   * @description Removes an existing product assignment from the selected category.
   * @param product The product object to remove.
   */
  async removeProductFromCategory(product: any): Promise<void> {
    const confirmed = await this.confirmDialogService.open(
      'Odebrat produkt',
      `Odebrat produkt "${product.name}" z kategorie "${this.selectedCategory?.name}"?`
    );

    if (!confirmed || !this.selectedCategory) return;

    this.loadingProducts = true;
    this.cd.markForCheck();

    const currentCategoryIds = product.categories ? product.categories.map((c: any) => c.id) : [];
    const updatedCategoryIds = currentCategoryIds.filter((id: number) => id !== this.selectedCategory!.id);

    const newPrimaryCategoryId = updatedCategoryIds.length > 0 ? updatedCategoryIds[0] : null;

    const url = `shop/products/${product.id}/category`;
    const payload = {
      category_id: newPrimaryCategoryId,
      category_ids: updatedCategoryIds
    };

    this.dataHandler.patch<any>(url, payload).subscribe({
      next: () => {
        this.alertDialogService.open('Hotovo', 'Produkt byl odebrán z kategorie.', 'success');
        this.loadTree(this.selectedCategory?.id, true, true);
        if (this.selectedCategory) {
          this.loadCategoryProducts(this.selectedCategory.id, true);
        }
      },
      error: (error) => {
        console.error(`Odebrání produktu SELHALO!`, error);
        this.loadingProducts = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Associates a new product with the selected category via API.
   * @param product The product object to add.
   */
  addProductToCategory(product: any): void {
    if (!this.selectedCategory) return;

    this.loadingProducts = true;
    this.cd.markForCheck();

    const currentCategoryIds = product.categories ? product.categories.map((c: any) => c.id) : [];
    const updatedCategoryIds = Array.from(new Set([...currentCategoryIds, this.selectedCategory.id]));

    const url = `shop/products/${product.id}/category`;
    const payload = {
      category_id: this.selectedCategory.id,
      category_ids: updatedCategoryIds
    };

    this.dataHandler.patch<any>(url, payload).subscribe({
      next: () => {
        this.alertDialogService.open('Hotovo', `Produkt byl přidán do kategorie.`, 'success');
        this.loadTree(this.selectedCategory?.id, true, true);
        this.loadCategoryProducts(this.selectedCategory!.id, true);
      },
      error: (error) => {
        console.error(`Přidání produktu SELHALO!`, error);
        this.loadingProducts = false;
        this.cd.markForCheck();
      }
    });
  }
}