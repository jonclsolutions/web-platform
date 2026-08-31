/**
 * @file edit-news.component.ts
 * @path src/app/admin/web-pages/news/edit-news.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the lifecycle and administration of website news articles (for intern uses), including CRUD operations and archival functionality.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for API interactions, pagination, and state management.
 * - TableBuilderComponent: Used for rendering the news listing and supporting export features.
 * - LoadingService: Manages global UI loading states.
 * - SHARED_UI_BUILDERS: Centralized collection of UI components for the administrative dashboard.
 */

import { Component, ViewChild, ChangeDetectionStrategy, inject } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { LoadingService } from '../../../core/services/loading.service';
import * as Config from './edit-news.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
/**
 * @description Component for the management of news content on the web platform.
 * @usage Enables administrators to create, edit, filter, and archive news articles.
 * @note Leverages BaseDataComponent for standardized data handling and integrates specific logic for toggling between active and trash views.
 */
@Component({
  selector: 'app-news',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent,GraphBuilderComponent],
  templateUrl: './edit-news.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditNewsComponent extends BaseDataComponent<any> implements Core.OnInit {
  public override loadingService = inject(LoadingService);
  tableCaption: string = 'Edit sekce novinky';
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'web/news';

  buttons = Config.NEWS_BUTTONS;
  formFields = Config.NEWS_FORM_FIELDS;
  newsColumns = Config.NEWS_COLUMNS;
  trashNewsColumns = Config.NEWS_TRASH_COLUMNS;
  filterColumns = Config.NEWS_FILTER_COLUMNS;
  detailsColumns = Config.NEWS_DETAILS_COLUMNS;
  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

  /**
   * @description Default filter settings ensuring the most recent articles appear at the top.
   */
  filters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };
showGraphBuilder = false;
  readonly graphColumns: GraphColumnOption[] = Config.NEWS_DETAILS_COLUMNS
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

  /**
   * @description Constructs the toolbar configuration.
   * @returns List of toolbar buttons adjusted for permissions and current UI context (archive/active state).
   */
get toolbarButtons(): Core.Button[] {
      return Config.NEWS_TOOLBAR_BUTTONS.map(btn => {
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

  /**
   * @description Maps toolbar action strings to their respective handler methods.
   * @param action Identifier for the action to execute.
   */
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

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  /**
   * @description Merges new filter criteria and triggers a data refresh from page one.
   * @param newFilters The incoming filter parameters.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets filter set to default sort criteria.
   */
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

  /**
   * @description Handles form submission by either updating an existing record or creating a new one.
   * @param formData Data captured from the form component.
   */
  handleFormSubmitted(formData: any): void {
    const request$ = formData.id
      ? this.updateData(formData.id, formData)
      : this.postData(formData);
    request$.pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.alertDialogService.open('Úspěch', formData.id ? 'Požadavek byl upraven.' : 'Požadavek byl vytvořen.', 'success');
        this.refreshData();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Akce selhala.', 'danger')
    });
  }

  /**
   * @description Fetches and opens detail view for a specific news item.
   * @param item Target record to view.
   */
  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Nepodařilo se načíst detail.', 'danger')
    });
  }

  handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
    this.cd.markForCheck();
  }

  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
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