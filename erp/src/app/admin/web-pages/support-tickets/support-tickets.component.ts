/**
 * @file support-tickets.component.ts
 * @path src/app/admin/web-pages/support-tickets/support-tickets.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Administrative dashboard component for managing customer support tickets, including status updates and multi-part data submission.
 * @dependencies
 * - BaseDataComponent: Inheritance for base CRUD and state management.
 * - TableBuilderComponent: Used for tabular data rendering and CSV export.
 * - Config.create* factory functions: Centralized, i18n-aware definitions for UI elements
 *   and column configurations - see refactor-note (2026-09-08) below.
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z `error:` callbacků (handleViewDetails, handleFormSubmitted) -
 * `DataHandler.handleError()` je jediné autoritativní místo pro chybový toast.
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.SUPPORT_TICKET_*` konstanty (vyhodnocené jednou při načtení modulu) nahrazeny
 * `Config.create*()` FACTORY FUNKCEMI - stejný vzor jako `UserRequestComponent`, viz
 * jeho hlavička pro plné odůvodnění (NG0956 riziko getterů, `translations$` je
 * `BehaviorSubject`). `buttons`/`formFields`/`columns`/`trashColumns`/`filterColumns`/
 * `detailsColumns` PŘESUNUTY z field initializerů (běží jen jednou, při vytvoření
 * instance) do konstruktoru, plněné VÝHRADNĚ přes `this.i18n.translations$.subscribe()`.
 * `tableCaption` (dřív natvrdo `'Helpdesk tickety'`) teď taky přes `t()`.
 *
 * `graphColumns` (dřív `readonly` pole počítané JEDNOU z `Config.SUPPORT_TICKET_DETAILS_COLUMNS`
 * na úrovni field initializeru) muselo přestat být `readonly` konstanta - `detailsColumns`
 * teď vznikají AŽ uvnitř `translations$` subscribu (ne při deklaraci třídy, kdy by
 * `i18n` ještě nemusel mít data načtená), takže `graphColumns` je přepočítáno na
 * STEJNÉM místě, ihned po přiřazení `detailsColumns` - jde o plochý objekt bez vnořené
 * struktury čtené přes `@for`/`track` (`GraphBuilderComponent` navíc sám hlídá "stejná
 * množina klíčů = stejná kolekce" v `sameColumnKeySet()`), takže NG0956 riziko se ho
 * netýká i přesto, že nejde o `readonly`.
 *
 * `eventTypeLabel`-like vzor: `'Úspěch'`/`'Požadavek byl upraven.'`/`'Požadavek byl
 * vytvořen.'` (dřív natvrdo česky v `handleFormSubmitted()`) nahrazeny `t()` voláním.
 * Toolbar labely (`'Skrýt filtry'`/`'Filtry'`/`'Zobrazit aktivní'`/`'Koš'`) v
 * `toolbarButtons` getteru taky přes `t()` - getter samotný je bezpečný (nevrací
 * pole objektů čtené přes `track`, jde o `.map()` nad JIŽ přeloženými `buttons`, viz
 * `toolbarButtons` getter beze změny struktury).
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './support-tickets.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/**
 * @description Manages the lifecycle of support tickets within the web administration module.
 * @usage Provides an interface for tracking, creating, updating, and exporting support inquiries.
 * @note Extends BaseDataComponent with specific logic to handle FormData uploads (for attachments) versus standard JSON payloads.
 */
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './support-tickets.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportTicketsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  protected override translationSection: string = 'support-tickets';

  public override t(key: string): string {
    return this.i18n.getValue(`support-tickets.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/support_tickets';

  /**
   * @bugfix-note (2026-09-08) Prázdné výchozí hodnoty - naplní se VÝHRADNĚ přes
   * `translations$` subscribe v konstruktoru, viz refactor-note v hlavičce souboru.
   * NIKDY nepřepisovat na gettery (NG0956 riziko) ani na field-initializer volání
   * `Config.create*()` přímo tady (proběhne příliš brzy, jen jednou).
   */
  buttons: Core.TableButtons[] = [];
  formFields: Core.InputDefinition[] = [];
  columns: Core.ColumnDefinition[] = [];
  trashColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];

  /**
   * @refactor-note (2026-09-08) Přestalo být `readonly` konstanta počítaná JEDNOU
   * z field initializeru - `detailsColumns` teď vznikají až uvnitř subscribu, viz
   * hlavička souboru.
   */
  graphColumns: GraphColumnOption[] = [];

  selectedItemForEdit: any = null;
  selectedItemForDetails: any = null;

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

    /**
     * @bugfix-note (2026-09-08) VÝHRADNÍ místo, kde se `buttons`/`formFields`/atd.
     * plní - `translations$` je BehaviorSubject, takže tenhle subscribe:
     * 1) proběhne OKAMŽITĚ s aktuální (možná ještě `null`) hodnotou,
     * 2) proběhne ZNOVU při každém dalším emitu (úspěšné doražení JSONu po HTTP
     *    requestu, budoucí přepnutí jazyka) a přepíše pole správnými texty.
     * `graphColumns` je odvozeno ZE STEJNÉHO `detailsColumns`, přepočítané na
     * stejném místě - žádná zvláštní logika navíc, jen `.filter()/.map()` nad
     * čerstvě přiřazeným polem.
     */
    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createSupportTicketButtons(this.i18n);
      this.formFields = Config.createSupportTicketFormFields(this.i18n);
      this.columns = Config.createSupportTicketColumns(this.i18n);
      this.trashColumns = Config.createSupportTicketTrashColumns(this.i18n);
      this.filterColumns = Config.createSupportTicketFilterColumns(this.i18n);
      this.detailsColumns = Config.createSupportTicketDetailsColumns(this.i18n);
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

  /**
   * @description Dynamically generates toolbar button definitions based on user permissions
   * and component state (e.g., active vs. trash table view).
   */
  get toolbarButtons(): Core.Button[] {
    return Config.createSupportTicketToolbarButtons(this.i18n).map(btn => {
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
      toggleTable: () => this.toggleTable(),
      openGraphBuilder: () => this.openGraphBuilder(),
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
    this.currentPage = 1;
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

  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (res) => {
        this.selectedItemForDetails = res;
        this.showDetails = true;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @refactor-note (2026-09-08) Natvrdo česká 'Úspěch'/'Požadavek byl upraven.'/
   * 'Požadavek byl vytvořen.' nahrazeny `t()` voláním - viz hlavička souboru.
   */
  handleFormSubmitted(formData: any): void {
    const isFormData = formData instanceof FormData;
    const id = isFormData ? formData.get('id') : formData.id;

    let request;

    if (id) {
      if (isFormData) {
        formData.append('_method', 'PUT');
        request = this.dataHandler.post(`${this.apiEndpoint}/${id}`, formData);
      } else {
        request = this.updateData(id, formData);
      }
    } else {
      request = this.postData(formData);
    }

    request.pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.alertDialogService.open(
          this.i18n.getValue('shared.success'),
          id ? this.t('crud_updated_message') : this.t('crud_created_message'),
          'success'
        );
        this.refreshData();
      }
    });
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