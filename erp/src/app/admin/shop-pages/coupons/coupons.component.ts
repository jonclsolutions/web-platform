/**
 * @file coupons.component.ts
 * @path src/app/admin/shop-pages/coupons/coupons.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the lifecycle of shop coupons, handling filtering, CRUD operations, and switching between active and trashed views.
 * @dependencies
 * - TableBuilderComponent: Used for rendering the data grids.
 * - BaseDataComponent: Inherits core API interaction and pagination state management.
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z `error:` callbacků (handleFormSubmitted, handleViewDetails) -
 * `DataHandler.handleError()` je jediné autoritativní místo pro chybový toast.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './coupons.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

@Component({
  selector: 'app-coupons',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent,GraphBuilderComponent],
  templateUrl: './coupons.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CouponsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  tableCaption: string = 'Slevové kupóny';

  override apiEndpoint: string = 'shop/coupons';

  buttons = Config.COUPON_BUTTONS;
  formFields = Config.COUPON_FORM_FIELDS;
  couponColumns = Config.COUPON_COLUMNS;
  trashCouponColumns = Config.COUPON_TRASH_COLUMNS;
  filterColumns = Config.COUPON_FILTER_COLUMNS;
  detailsColumns = Config.COUPON_DETAILS_COLUMNS;

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

  filters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };
showGraphBuilder = false;
  readonly graphColumns: GraphColumnOption[] = Config.COUPON_DETAILS_COLUMNS
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
     return Config.COUPON_TOOLBAR_BUTTONS.map(btn => {
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
      exportActiveTable: () => this.exportActiveTable(),
      openGraphBuilder: () => this.openGraphBuilder(),
      toggleTable: () => this.toggleTable()
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void { this.forceFullRefresh(this.filters); }

  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  clearFilters(): void {
    this.filters = { sort_by: 'id', sort_direction: 'desc' };
    this.currentPage = 1;
    this.refreshData();
  }

  handlePageChange(page: number): void { this.onHandlePageChange(page, this.filters); }
  handleItemsPerPageChange(value: number): void { this.onHandleItemsPerPageChange(value, this.filters); }

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
    request$.pipe(Core.finalize(() => { this.showCreateForm = false; this.cd.markForCheck(); })).subscribe({
      next: () => {
        this.alertDialogService.open('Úspěch', formData.id ? 'Požadavek byl upraven.' : 'Požadavek byl vytvořen.', 'success');
        this.refreshData();
      }
    });
  }

  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => { this.selectedItemForDetails = details; this.showDetails = true; this.cd.markForCheck(); }
    });
  }

  handleCloseDetails(): void { this.selectedItemForDetails = null; this.showDetails = false; }
  onCancelForm(): void { this.showCreateForm = false; this.selectedItemForEdit = null; this.cd.markForCheck(); }
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