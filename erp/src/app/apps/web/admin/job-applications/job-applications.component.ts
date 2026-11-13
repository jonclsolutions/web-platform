/**
 * @file job-applications.component.ts
 * @path src/app/apps/web/admin/job-applications/job-applications.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages the administration of job applications, providing filtered views, details retrieval, and status updates.
 * @dependencies
 * - BaseDataComponent: Core logic for data fetching, pagination, and state management.
 * - TableBuilderComponent: Used for tabular data rendering and CSV export functionality.
 * - Config.create* factory functions: i18n-aware definitions for UI columns, form
 *   fields, and toolbar actions.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as Core from '../../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../../../admin/components/base-data/base-data.component';
import * as Config from './job-applications.config';
import { ActionMenuBuilderComponent } from '../../../../admin/components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../../../admin/components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../../shared/interfaces/graph-format';
import { PageHelpComponent } from '../../../../admin/components/page-help/page-help.component';

/**
 * @description Administrative component for viewing and editing incoming job applications.
 * @usage Provides a data-driven interface to manage candidate submissions via the administrative dashboard.
 * @note Extends BaseDataComponent to leverage standard CRUD patterns while customizing form submission and detail viewing specific to job applications.
 */
@Component({
  selector: 'app-job-applications',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent, PageHelpComponent],
  templateUrl: './job-applications.component.html',
  styleUrls: ['../../../../admin/shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobApplicationsComponent extends BaseDataComponent<any> implements Core.OnInit {

  protected override translationSection: string = 'job-applications';

  public override t(key: string): string {
    return this.i18n.getValue(`job-applications.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/job_applications';

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
      this.buttons = Config.createJobApplicationButtons(this.i18n);
      this.formFields = Config.createJobApplicationFormFields(this.i18n);
      this.columns = Config.createJobApplicationColumns(this.i18n);
      this.trashColumns = Config.createJobApplicationTrashColumns(this.i18n);
      this.filterColumns = Config.createJobApplicationFilterColumns(this.i18n);
      this.detailsColumns = Config.createJobApplicationDetailsColumns(this.i18n);
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
    return Config.createJobApplicationToolbarButtons(this.i18n).map(btn => {
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
        case 'exportActiveTable':
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
      exportActiveTable: () => this.exportActiveTable(),
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

  override handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = false;
    this.cd.detectChanges();

    setTimeout(() => {
      this.selectedItemForEdit = JSON.parse(JSON.stringify(item));
      this.showCreateForm = true;
      this.cd.markForCheck();
    }, 50);
  }

  override handleFormSubmitted(formData: any): void {
    this.updateData(formData.id, formData).pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.selectedItemForEdit = null;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.alertDialogService.open(
          this.i18n.getValue('shared.success'),
          this.t('crud_updated_message'),
          'success'
        );
        this.refreshData();
      }
    });
  }

}