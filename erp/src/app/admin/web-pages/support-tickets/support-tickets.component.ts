/**
 * @file support-tickets.component.ts
 * @path src/app/admin/web-pages/support-tickets/support-tickets.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Administrative dashboard component for managing customer support tickets, including status updates and multi-part data submission.
 * @dependencies
 * - BaseDataComponent: Inheritance for base CRUD and state management.
 * - TableBuilderComponent: Used for tabular data rendering and CSV export.
 * - Config.create* factory functions: Centralized, i18n-aware definitions for UI elements
 *   and column configurations.
 * @note `graphColumns` is not `readonly`: `detailsColumns` are created inside the
 * `translations$` subscription (the i18n data may not be loaded when the class is declared),
 * so `graphColumns` is recomputed in the SAME place right after `detailsColumns` are assigned.
 * It is a flat object (GraphBuilderComponent also checks "same key set = same collection" in
 * `sameColumnKeySet()`), so there is no NG0956 risk.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './support-tickets.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

/**
 * @description Manages the lifecycle of support tickets within the web administration module.
 * @usage Provides an interface for tracking, creating, updating, and exporting support inquiries.
 * @note Extends BaseDataComponent with specific logic to handle FormData uploads (for attachments) versus standard JSON payloads.
 */
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent, PageHelpComponent],
  templateUrl: './support-tickets.component.html',
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportTicketsComponent extends BaseDataComponent<any> implements Core.OnInit {

  protected override translationSection: string = 'support-tickets';

  public override t(key: string): string {
    return this.i18n.getValue(`support-tickets.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/support_tickets';

  columns: Core.ColumnDefinition[] = [];
  trashColumns: Core.ColumnDefinition[] = [];

  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => {
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

  override handleToolbarAction(action: string): void {
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

  override handleFormSubmitted(formData: any): void {
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

}