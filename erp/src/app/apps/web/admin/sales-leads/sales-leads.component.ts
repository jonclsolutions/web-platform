/**
 * @file sales-leads.component.ts
 * @path src/app/apps/web/admin/sales-leads/sales-leads.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Administrative dashboard component for managing sales leads, including link generation, logging, and CRUD operations.
 * @dependencies
 * - BaseDataComponent: Inheritance for base table/data handling.
 * - TableBuilderComponent: For UI rendering of lead collections.
 * - Config.create* factory functions: i18n-aware definitions for forms, columns, and
 *   toolbar buttons.
 */

import { formatDate } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as Core from '../../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../../../admin/components/base-data/base-data.component';
import * as Config from './sales-leads.config';
import { ActionMenuBuilderComponent } from '../../../../admin/components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../../../admin/components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../../shared/interfaces/graph-format';
import { PageHelpComponent } from '../../../../admin/components/page-help/page-help.component';

/**
 * @description Manages the Sales Leads module.
 * @usage Provides administrative oversight for lead generation, editing, and tracking through centralized configuration.
 * @note Implements custom logging for sensitive lead-related actions (e.g., link generation).
 */
@Component({
  selector: 'app-sales-leads',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent, PageHelpComponent],
  templateUrl: './sales-leads.component.html',
  styleUrls: ['../../../../admin/shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesLeadsComponent extends BaseDataComponent<any> implements Core.OnInit {

  protected override translationSection: string = 'sales-leads';

  public override t(key: string): string {
    return this.i18n.getValue(`sales-leads.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/sales_leads';

  salesLeadColumns: Core.ColumnDefinition[] = [];
  trashSalesLeadColumns: Core.ColumnDefinition[] = [];

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

  override handleToolbarAction(action: string): void {
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
   * @description Requests (or reuses) the unique public link to the order form of the lead and
   *              copies it to the clipboard; the message says until when the link is valid (every
   *              request starts its validity again - VT-10, WebSalesLead::PUBLIC_TOKEN_TTL_DAYS).
   * @param item The sales lead.
   * @note The token is generated / checked by the backend - the frontend never builds the URL itself.
   */
  handleGenerateFormLink(item: any): void {
    this.dataHandler.post<{ token: string; url: string; expires_at: string | null }>(`web/sales_leads/${item.id}/generate-link`, {})
      .subscribe({
        next: (res) => {
          navigator.clipboard.writeText(res.url).then(() => {
            const validity = res.expires_at
              ? ' ' + this.t('link_valid_until').replace('{date}', formatDate(res.expires_at, 'd.M.yyyy', 'en-US'))
              : '';
            this.alertDialogService.open(
              this.t('link_copied_title'),
              this.t('link_copied_message').replace('{subject}', item.subject_name) + validity,
              'success'
            );
          }).catch(() => {
            this.alertDialogService.open(this.i18n.getValue('shared.error'), this.t('link_copy_failed_message'), 'danger');
          });
        }
      });
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  override clearFilters(): void {
    this.filters = { ...this.defaultFilters };
    this.refreshData();
  }

  override exportActiveTable(): void {
    this.activeTable?.exportToCSV();
  }

  override handleFormSubmitted(formData: any): void {
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

  override handleViewDetails(item: any): void {
    this.getItemDetails(item.id).subscribe(d => {
      this.selectedItemForDetails = d;
      this.showDetails = true;
      this.cd.markForCheck();
    });
  }

  override handleCloseDetails(): void {
    this.showDetails = false;
    this.selectedItemForDetails = null;
    this.cd.markForCheck();
  }

}