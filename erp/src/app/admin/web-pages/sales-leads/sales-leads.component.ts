/**
 * @file sales-leads.component.ts
 * @path src/app/admin/web-pages/sales-leads/sales-leads.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Administrative dashboard component for managing sales leads, including link generation, logging, and CRUD operations.
 * @dependencies
 * - BaseDataComponent: Inheritance for base table/data handling.
 * - TableBuilderComponent: For UI rendering of lead collections.
 * - Config.create* factory functions: i18n-aware definitions for forms, columns, and
 *   toolbar buttons - see refactor-note (2026-09-08) below.
 * @bugfix-note (2026-08-31) Odstraněn duplicitní `alertDialogService.open('Chyba', ...)`
 * z HTTP `error:` callbacku v `handleGenerateFormLink()` - `DataHandler.handleError()`
 * je jediné autoritativní místo pro chybový toast. Klientský clipboard `.catch(...)`
 * toast ZŮSTÁVÁ - selhání zápisu do schránky není HTTP chyba, DataHandler o ní neví.
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.SALES_LEAD_*` konstanty nahrazeny `Config.create*()` factory funkcemi - stejný
 * vzor jako `SalesOrdersComponent`/`SupportTicketsComponent`. Pole přesunuta z field
 * initializerů do konstruktoru (`translations$.subscribe()`). `graphColumns` přestalo
 * být `readonly`. Klipboard/log hlášky ('Odkaz zkopírován'/'Nepodařilo se zkopírovat
 * odkaz.'/'Úspěch'/'Požadavek byl upraven.'/'Požadavek byl vytvořen.') nahrazeny `t()`
 * voláním - `logAction()` popis (`description`) ZŮSTÁVÁ anglicky natvrdo, protože jde o
 * INTERNÍ audit log (`web_logs.description`), ne UI text - stejná logika jako
 * `CoreSecuritySettingController`'s `logAction()` na backendu (auditní záznamy nejsou
 * user-facing, nemají procházet i18n).
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './sales-leads.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/**
 * @description Manages the Sales Leads module.
 * @usage Provides administrative oversight for lead generation, editing, and tracking through centralized configuration.
 * @note Implements custom logging for sensitive lead-related actions (e.g., link generation).
 */
@Component({
  selector: 'app-sales-leads',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './sales-leads.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesLeadsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  protected override translationSection: string = 'sales-leads';

  public override t(key: string): string {
    return this.i18n.getValue(`sales-leads.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/sales_leads';
  private logEndpoint: string = 'web/logs';

  buttons: Core.TableButtons[] = [];
  formFields: Core.InputDefinition[] = [];
  salesLeadColumns: Core.ColumnDefinition[] = [];
  trashSalesLeadColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];

  /** @refactor-note (2026-09-08) Přestalo být `readonly` - viz hlavička souboru. */
  graphColumns: GraphColumnOption[] = [];

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

  filters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };
  showGraphBuilder = false;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createSalesLeadButtons(this.i18n);
      this.formFields = Config.createSalesLeadFormFields(this.i18n);
      this.salesLeadColumns = Config.createSalesLeadColumns(this.i18n);
      this.trashSalesLeadColumns = Config.createSalesLeadTrashColumns(this.i18n);
      this.filterColumns = Config.createSalesLeadFilterColumns(this.i18n);
      this.detailsColumns = Config.createSalesLeadDetailsColumns(this.i18n);
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
    return Config.createSalesLeadToolbarButtons(this.i18n).map(btn => {
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

  /**
   * @description Vyžádá (nebo znovu použije) unikátní veřejný odkaz na objednávkový
   *              formulář pro daný lead a zkopíruje ho do schránky.
   * @param item Konkrétní obchodní lead.
   * @note Token se generuje/ověřuje na backendu - frontend URL nikdy neskládá sám.
   * @refactor-note (2026-09-08) 'Odkaz zkopírován'/'Nepodařilo se zkopírovat odkaz.'
   * nahrazeny `t()` voláním.
   */
  handleGenerateFormLink(item: any): void {
    this.dataHandler.post<{ token: string; url: string }>(`web/sales_leads/${item.id}/generate-link`, {})
      .subscribe({
        next: (res) => {
          navigator.clipboard.writeText(res.url).then(() => {
            this.alertDialogService.open(
              this.t('link_copied_title'),
              this.t('link_copied_message').replace('{subject}', item.subject_name),
              'success'
            );
          }).catch(() => {
            this.alertDialogService.open(this.i18n.getValue('shared.error'), this.t('link_copy_failed_message'), 'danger');
          });
        }
      });
  }

  /**
   * @note `description` ZŮSTÁVÁ anglicky natvrdo - interní audit log
   * (`web_logs.description`), ne UI text, viz refactor-note v hlavičce souboru.
   */
  private logAction(item: any): void {
    const logData = {
      event_type: 'LINK_GENERATED',
      module: 'SalesLead',
      description: `Generován odkaz pro lead ID: ${item.id} (Email: ${item.contact_email || 'N/A'})`,
      affected_entity_type: 'sales_lead',
      affected_entity_id: item.id,
      user_id_plain: this.authService.getUserId()?.toString(),
      user_plain: this.authService.getUserEmail(),
      context_data: JSON.stringify({ component: 'SalesLeads' })
    };

    this.dataHandler.post(this.logEndpoint, logData)
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe();
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  applyFilters(f: Core.FilterParams): void {
    this.filters = { ...this.filters, ...f };
    this.currentPage = 1;
    this.refreshData();
  }

  clearFilters(): void {
    this.filters = { ...this.defaultFilters };
    this.refreshData();
  }

  handlePageChange(p: number): void {
    this.onHandlePageChange(p, this.filters);
  }

  handleItemsPerPageChange(v: number): void {
    this.onHandleItemsPerPageChange(v, this.filters);
  }

  exportActiveTable(): void {
    this.activeTable?.exportToCSV();
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
    const req = formData.id ? this.updateData(formData.id, formData) : this.postData(formData);
    req.pipe(
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
      },
    });
  }

  handleViewDetails(item: any): void {
    this.getItemDetails(item.id).subscribe(d => {
      this.selectedItemForDetails = d;
      this.showDetails = true;
      this.cd.markForCheck();
    });
  }

  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }

  handleCloseDetails(): void {
    this.showDetails = false;
    this.selectedItemForDetails = null;
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