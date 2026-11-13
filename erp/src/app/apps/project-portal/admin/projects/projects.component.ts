/**
 * @file projects.component.ts
 * @path src/app/apps/project-portal/admin/projects/projects.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Administrative list of the client projects: table with quick create / edit /
 * delete, trash, filters (also "only with new messages"), export and reports. A project is managed
 * on its own page with sub-pages (project-portal/projects/:id/:section - ProjectDetailComponent): overview,
 * conversations, progress, approvals, updates, access, files and settings; the toolbar opens the
 * project templates (project-portal/projects/templates), the create form can start from a template. The table shows the responsible administrator
 * (assignee), the number of new client messages and of the threads waiting on the team per project;
 * the filter "My projects" keeps the projects of the signed-in administrator.
 * @note A new project opens its Access sub-page, where the client accounts are added. Old links
 * `?open_project=<id>` open the project page. `?order_id=<id>` (button "Project" of the web
 * orders) opens the project of that order (GET project-portal/projects?order_id=), or the create
 * form with the order preselected when it has none yet.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import * as Core from '../../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../../../admin/components/base-data/base-data.component';
import * as Config from './projects.config';
import { GraphBuilderComponent } from '../../../../admin/components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../../shared/interfaces/graph-format';
import { PageHelpComponent } from '../../../../admin/components/page-help/page-help.component';
import { hasApp } from '../../../apps.registry';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, GraphBuilderComponent, PageHelpComponent],
  templateUrl: './projects.component.html',
  styleUrls: ['../../../../admin/shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsComponent extends BaseDataComponent<any> implements Core.OnInit {
  protected override translationSection: string = 'projects';

  public override t(key: string): string {
    return this.i18n.getValue(`projects.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'project-portal/projects';

  projectColumns: Core.ColumnDefinition[] = [];
  trashProjectColumns: Core.ColumnDefinition[] = [];

  private prefillOrderId: string | null = null;

  /** Key prefix under which former versions kept the revealed password in sessionStorage (removed on load, VT-08). */
  private readonly LEGACY_PASSWORD_STORAGE_PREFIX = 'rpsw_project_pw_';

  /** @description Administrators who can be responsible for a project (GET project-portal/projects/assignees). */
  private assignees: { id: number; full_name: string }[] = [];

  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router,
    private activatedRoute: ActivatedRoute
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createProjectButtons(this.i18n);
      this.formFields = Config.createProjectFormFields(this.i18n);
      this.applyAssigneeOptions();
      this.projectColumns = Config.createProjectColumns(this.i18n);
      this.trashProjectColumns = Config.createProjectTrashColumns(this.i18n);
      this.filterColumns = Config.createProjectFilterColumns(this.i18n);
      this.detailsColumns = Config.createProjectDetailsColumns(this.i18n);
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
    return Config.createProjectToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };
      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }
      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
          if (updatedBtn.showIf !== false) updatedBtn.showIf = !this.showTrashTable;
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? this.t('toolbar_show_active') : this.t('toolbar_show_trash');
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
      toggleTable: () => this.toggleTable(),
      openGraphBuilder: () => this.openGraphBuilder(),
      openTemplates: () => this.router.navigate(['/admin/project-portal/projects/templates']),
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.removeLegacyStoredPasswords();
    this.initWithAuthCheck(this.router);
    this.checkQueryParamsForPrefill();
    this.loadAssignees();
  }

  /** @description Loads the possible assignees once for the create / edit form. */
  private loadAssignees(): void {
    this.dataHandler.getCollection<{ id: number; full_name: string }>('project-portal/projects/assignees').subscribe({
      next: (users) => {
        this.assignees = users ?? [];
        this.applyAssigneeOptions();
        this.cd.markForCheck();
      },
      error: () => { /* the select keeps only "Nobody" */ },
    });
  }

  /** @description Puts the loaded assignees into the assignee select of the form ("Nobody" first). */
  private applyAssigneeOptions(): void {
    const field = this.formFields.find(f => f.column_name === 'assignee_id');
    if (!field) return;
    field.options = [
      { value: '', label: Config.createNoAssigneeOptionLabel(this.i18n) },
      ...this.assignees.map(user => ({ value: String(user.id), label: user.full_name })),
    ];
  }

  private checkQueryParamsForPrefill(): void {
    // Old links (calendar, realisations of an older version) open the project page.
    const openProjectId = this.activatedRoute.snapshot.queryParamMap.get('open_project');
    if (openProjectId) {
      this.router.navigate(['/admin/project-portal/projects', openProjectId], { replaceUrl: true });
      return;
    }

    const orderId = this.activatedRoute.snapshot.queryParamMap.get('order_id');
    if (!orderId || !hasApp('web')) return;

    // The project of the order when it exists, else a new one with the order preselected.
    this.dataHandler.getCollection<{ id: number }>(this.apiEndpoint, { order_id: orderId, no_pagination: 'true' }).subscribe({
      next: (projects) => projects?.length
        ? this.router.navigate(['/admin/project-portal/projects', projects[0].id], { replaceUrl: true })
        : this.prefillFromOrder(orderId),
      error: () => this.prefillFromOrder(orderId),
    });
  }

  /**
   * @description Opens the create form with the order preselected.
   * @param orderId Id of the web order.
   */
  private prefillFromOrder(orderId: string): void {
    this.prefillOrderId = orderId;
    this.loadTemplateOptions();
    this.loadOrderOptions(() => {
      this.selectedItemForEdit = { order_id: orderId };
      this.showCreateForm = true;
      this.cd.markForCheck();
    });
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  /**
   * @description Puts the web orders into the order select of the create form (only with the
   *   web application installed).
   * @param onLoaded Called when done (also on failure / without the web).
   */
  private loadOrderOptions(onLoaded: () => void): void {
    if (!hasApp('web')) {
      onLoaded();
      return;
    }
    this.dataHandler.getCollection<any>('web/sales_orders', { no_pagination: 'true', sort_by: 'id', sort_direction: 'desc' })
      .subscribe({
        next: (orders) => {
          const orderField = this.formFields.find(f => f.column_name === 'order_id');
          if (orderField) {
            orderField.options = [
              { value: '', label: Config.createNoOrderOptionLabel(this.i18n) },
              ...orders.map((o: any) => ({ value: String(o.id), label: `#${o.id} — ${o.client_name}` })),
            ];
          }
          onLoaded();
        },
        error: () => onLoaded()
      });
  }

  /** @description Puts the project templates into the template select of the create form. */
  private loadTemplateOptions(): void {
    this.dataHandler.getCollection<{ id: number; name: string; checkpoints: unknown[] }>('project-portal/projects/templates').subscribe({
      next: (templates) => {
        const field = this.formFields.find(f => f.column_name === 'template_id');
        if (!field) return;
        field.options = [
          { value: '', label: this.t('field_template_none_option') },
          ...(templates ?? []).map(t => ({ value: String(t.id), label: `${t.name} (${t.checkpoints?.length ?? 0})` })),
        ];
        this.cd.markForCheck();
      },
      error: () => { /* the select offers only "no template" */ },
    });
  }

  override handleCreateFormOpened(): void {
    this.loadTemplateOptions();
    this.loadOrderOptions(() => {
      this.selectedItemForEdit = this.prefillOrderId ? { order_id: this.prefillOrderId } : null;
      this.showCreateForm = true;
      this.cd.markForCheck();
    });
  }

  override handleFormSubmitted(formData: any): void {
    const request$ = formData.id ? this.updateData(formData.id, formData) : this.postData(formData);

    request$.pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.prefillOrderId = null;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: (result: any) => {
        if (!formData.id && result?.id) {
          // The client accounts are added on the page of the new project.
          this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('project_created_message'), 'success');
          this.router.navigate(['/admin/project-portal/projects', result.id, 'access']);
        } else {
          this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('project_updated_message'), 'success');
          this.refreshData();
        }
      }
    });
  }

  override onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.prefillOrderId = null;
    this.cd.markForCheck();
  }

  // ── Project page ──────────────────────────────────────────────────────

  /**
   * @description Opens the page of a project ("Manage" button of the table, after creating).
   * @param item Project row (needs `id`).
   */
  openProject(item: any): void {
    if (item?.id) this.router.navigate(['/admin/project-portal/projects', item.id]);
  }

  /** @description Deletes the passwords former versions kept in sessionStorage. */
  private removeLegacyStoredPasswords(): void {
    try {
      Object.keys(sessionStorage)
        .filter(key => key.startsWith(this.LEGACY_PASSWORD_STORAGE_PREFIX))
        .forEach(key => sessionStorage.removeItem(key));
    } catch { /* storage unavailable - nothing stored either */ }
  }
}
