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
 * - Config.create* factory functions: i18n-aware definitions for UI columns, form
 *   fields, and toolbar actions - see refactor-note (2026-09-08) below.
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z `error:` callbacků (handleFormSubmitted, handleViewDetails) -
 * `DataHandler.handleError()` je jediné autoritativní místo pro chybový toast.
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.NEWS_*` konstanty nahrazeny `Config.create*()` factory funkcemi - stejný
 * vzor jako ostatní web-pages stránky. `graphColumns` přestalo být `readonly`.
 * `'Úspěch'`/`'Požadavek byl upraven.'`/`'Požadavek byl vytvořen.'` (dřív natvrdo
 * česky) nahrazeny `t()` voláním.
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
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './edit-news.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditNewsComponent extends BaseDataComponent<any> implements Core.OnInit {
  public override loadingService = inject(LoadingService);
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  protected override translationSection: string = 'edit-news';

  public override t(key: string): string {
    return this.i18n.getValue(`edit-news.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/news';

  buttons: Core.TableButtons[] = [];
  formFields: Core.InputDefinition[] = [];
  newsColumns: Core.ColumnDefinition[] = [];
  trashNewsColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

  filters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };
  showGraphBuilder = false;

  /** @refactor-note (2026-09-08) Přestalo být `readonly` - viz hlavička souboru. */
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createNewsButtons(this.i18n);
      this.formFields = Config.createNewsFormFields(this.i18n);
      this.newsColumns = Config.createNewsColumns(this.i18n);
      this.trashNewsColumns = Config.createNewsTrashColumns(this.i18n);
      this.filterColumns = Config.createNewsFilterColumns(this.i18n);
      this.detailsColumns = Config.createNewsDetailsColumns(this.i18n);
      this.graphColumns = this.detailsColumns
        .filter(col => col.chartable === true)
        .map(col => ({
          key: col.key,
          label: col.displayName,
          aggregation: col.chartAggregation ?? 'count',
          possibleValues: col.chartPossibleValues,
        }));
      this.cd.markForCheck();
    });
  }

  get toolbarButtons(): Core.Button[] {
    return Config.createNewsToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible
            ? this.t('toolbar_hide_filters')
            : this.t('toolbar_filters');
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
          updatedBtn.label = this.showTrashTable
            ? this.t('toolbar_show_active')
            : this.t('toolbar_show_trash');
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
      triggerImport: () => this.activeTable?.importData(),
      openGraphBuilder: () => this.openGraphBuilder(),
      toggleTable: () => this.toggleTable(),
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
   * @refactor-note (2026-09-08) Natvrdo česká 'Úspěch'/'Požadavek byl upraven.'/
   * 'Požadavek byl vytvořen.' nahrazeny `t()` voláním.
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
        this.alertDialogService.open(
          this.i18n.getValue('shared.success'),
          formData.id ? this.t('crud_updated_message') : this.t('crud_created_message'),
          'success'
        );
        this.refreshData();
      }
    });
  }

  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      }
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