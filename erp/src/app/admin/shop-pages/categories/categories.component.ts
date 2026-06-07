import { Component, OnInit, ViewChildren, QueryList, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { CategoryNode } from '../components/interfaces/category-node';
import { Button } from '../../../shared/interfaces/button';
import { CATEGORY_TOOLBAR_BUTTONS, CATEGORY_ROW_BUTTONS } from './categories.config';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { BaseDataComponent } from '../../components/base-data/base-data.component';

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
  categories: CategoryNode[] = [];

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

  override refreshData(): void {
    this.loadTree();
  }

  get toolbarButtons(): Button[] {
    return CATEGORY_TOOLBAR_BUTTONS;
  }

  getRowButtons(node: CategoryNode): Button[] {
    return CATEGORY_ROW_BUTTONS.map(btn => {
      const updatedBtn = { ...btn };
      if (btn.action === 'toggleStatus') {
        updatedBtn.icon = node.is_active ? 'Aktivní 🟢' : ' Neaktivní ⚪';
        updatedBtn.class = node.is_active ? 'btn-export' : 'btn-filter';
      }
      return updatedBtn;
    });
  }

  getEditButtons(node: CategoryNode): Button[] {
    const isDuplicate = this.isDuplicateName(node);
    const isEmpty = !node.name || node.name.trim().length === 0;

    return [
      { action: 'submit', label: 'Uložit', icon: '✅', class: 'btn-create', disabled: isDuplicate || isEmpty },
      { action: 'cancel', label: 'Zrušit', icon: '❌', class: 'btn-trash' }
    ];
  }

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

  handleToolbarAction(action: string): void {
    if (action === 'expandAll') this.expandAll(true);
    if (action === 'collapseAll') this.expandAll(false);
    if (action === 'addMain') this.initAddCategory(null);
  }

  handleRowAction(action: string, node: CategoryNode): void {
    switch (action) {
      case 'addChild': this.initAddCategory(node.id); break;
      case 'edit': this.startEdit(node); break;
      case 'toggleStatus': this.toggleStatus(node); break;
      case 'delete': this.deleteCategory(node); break;
    }
  }

  handleEditAction(action: string, node: CategoryNode): void {
    if (action === 'submit') {
      if (!node.name || node.name.trim().length === 0 || this.isDuplicateName(node)) return;
      if (node.id === 0) this.confirmAdd(node); else this.saveNode(node);
    } else {
      if (node.id === 0) this.loadTree(); else this.cancelEdit(node);
    }
  }

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
          this.loadTree();
        },
        error: (err) => {
          this.alertDialogService.open('Chyba', err.error?.message || 'Vytvoření selhalo.', 'danger');
          this.loadTree();
        }
      });
  }

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

  startEdit(node: CategoryNode): void {
    this.backupNames.set(node.id, node.name);
    node.isEditing = true;
    this.cd.detectChanges();
    setTimeout(() => this.editInputs.last?.nativeElement.focus(), 0);
  }

  cancelEdit(node: CategoryNode): void {
    const originalName = this.backupNames.get(node.id);
    if (originalName !== undefined) node.name = originalName;
    node.isEditing = false;
    this.backupNames.delete(node.id);
    this.cd.markForCheck();
  }

  loadTree(forceExpandId?: number | null, silent: boolean = false): void {
    if (!silent) {
      this.loadingService.show();
    }
    this.loadAllData().subscribe({
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

  saveNode(node: CategoryNode): void {
    node.isEditing = false;
    this.cd.markForCheck();

    this.updateData(node.id, { name: node.name, parent_id: node.parent_id } as CategoryNode)
      .subscribe({
        next: () => {
          this.alertDialogService.open('Aktualizováno', 'Změny byly uloženy.', 'success');
          this.backupNames.delete(node.id);
          this.cd.markForCheck();
        },
        error: (err) => {
          node.isEditing = true;
          this.cd.markForCheck();
          this.alertDialogService.open('Chyba', err.error?.message || 'Uložení selhalo.', 'danger');
        }
      });
  }

  toggleStatus(node: CategoryNode): void {
    const newStatus = !node.is_active;
    node.is_active = newStatus;
    this.cd.markForCheck();

    this.updateData(node.id, { ...node, is_active: newStatus })
      .subscribe({
        next: () => {},
        error: () => {
          node.is_active = !newStatus;
          this.cd.markForCheck();
          this.alertDialogService.open('Chyba', 'Změna stavu selhala.', 'danger');
        }
      });
  }

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
          // Zavřít panel pokud byla smazána aktuálně vybraná kategorie
          if (this.selectedCategory?.id === node.id) {
            this.closeProductPanel();
          }
        },
        error: (err) => {
          this.alertDialogService.open('Chyba', err.error?.message || 'Smazání selhalo.', 'danger');
          this.loadTree();
        }
      });
    }
  }

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

  private saveExpandedStates(): void {
    localStorage.setItem('categoryExpandedStates', JSON.stringify(Array.from(this.expandedStates)));
  }

  private loadExpandedStates(): void {
    const saved = localStorage.getItem('categoryExpandedStates');
    if (saved) {
      this.expandedStates = new Set(JSON.parse(saved));
    }
  }

  // =====================
  // PRODUKT PANEL
  // =====================

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

  closeProductPanel(): void {
    this.selectedCategory = null;
    this.categoryProducts = [];
    this.allProducts = [];
    this.showAddProduct = false;
    this.productSearch = '';
    this.addProductSearch = '';
    this.cd.markForCheck();
  }

  loadCategoryProducts(categoryId: number): void {
    this.loadingProducts = true;
    this.cd.markForCheck();

    const url = `shop/products?no_pagination=true&category_id=${categoryId}`;
    this.dataHandler.getCollection<any>(url).subscribe({
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

  get filteredCategoryProducts(): any[] {
    if (!this.productSearch.trim()) return this.categoryProducts;
    const s = this.productSearch.toLowerCase();
    return this.categoryProducts.filter(p =>
      p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s)
    );
  }

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

  openAddProductSearch(): void {
    this.showAddProduct = true;
    this.addProductSearch = '';

    if (this.allProducts.length === 0) {
      this.dataHandler.getCollection<any>('shop/products?no_pagination=true').subscribe({
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
        
        this.loadTree(this.selectedCategory?.id, true);
        if (this.selectedCategory) {
          this.loadCategoryProducts(this.selectedCategory.id);
        }
      },
      error: (error) => {
        console.error(`Odebrání produktu SELHALO!`, error);
        this.loadingProducts = false;
        this.cd.markForCheck();
      }
    });
  }

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
        
        this.loadTree(this.selectedCategory?.id, true);
        this.loadCategoryProducts(this.selectedCategory!.id);
      },
      error: (error) => {
        console.error(`Přidání produktu SELHALO!`, error);
        this.loadingProducts = false;
        this.cd.markForCheck();
      }
    });
  }
}