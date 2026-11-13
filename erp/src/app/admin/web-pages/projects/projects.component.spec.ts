/**
 * @file projects.component.spec.ts
 * @path src/app/admin/web-pages/projects/projects.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectsComponent and projects.config.ts – the list of client
 *   projects of the Web module: translated configuration (with the unread messages column and
 *   filter, the assignee and the threads waiting on the team, the "my projects" filter), the
 *   assignee options, toolbars, prefill from a sales order (?order_id), old links ?open_project →
 *   project page, creating a project (opens its page) and opening the project page from the table.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), ActivatedRoute (stub with query
 *   params), Router.navigate (spy), sessionStorage (removal of the legacy stored passwords)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ProjectsComponent } from './projects.component';
import {
  CHECKPOINT_STATUS_VALUES, PROJECT_PLATFORM_VALUES, PROJECT_STATUS_VALUES, PROJECT_VISIBILITY_VALUES,
  createCheckpointStatusLabels
} from './projects.config';
import { AdminTestContext, createAdminTestContext, paginated } from '../../../../testing/admin-test-helpers';

describe('ProjectsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ProjectsComponent>;
  let component: ProjectsComponent;
  let route: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };
  let navigate: jasmine.Spy;

  const dh = () => ctx.dataHandler as any;
  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;

  beforeEach(async () => {
    sessionStorage.removeItem('rpsw_project_pw_7');
    ctx = createAdminTestContext();
    route = { snapshot: { queryParamMap: convertToParamMap({}) } };
    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: route }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  afterEach(() => {
    fixture.destroy();
    sessionStorage.removeItem('rpsw_project_pw_7');
  });

  describe('configuration', () => {
    /**
     * @description The list is configured from the 'projects' translations: the "open project"
     *   button, the assignee column, the unread messages and waiting threads columns (count pills)
     *   and the "only with unread" / "my projects" filters.
     * @input  component created
     * @output caption; row buttons open / edit / delete; 10 + 3 columns with assignee_name,
     *   unread_messages_count and waiting_threads_count; 7 filters ending with unread and
     *   assigned_to_me (one option '1' each); 14 details
     */
    it('builds the configuration from translations', () => {
      expect(component.tableCaption).toBe('projects.table_header');
      expect(component.buttons.map(b => [b.action, b.permission, b.icon])).toEqual([
        ['generate_form', undefined, 'folder-open'], ['edit', 'web-projects-update', 'edit'], ['delete', 'web-projects-delete', 'delete']
      ]);
      expect(component.projectColumns.length).toBe(10);
      expect(component.projectColumns.find(c => c.key === 'unread_messages_count')).toEqual(
        { key: 'unread_messages_count', header: 'projects.col_unread', type: 'count' });
      expect(component.projectColumns.find(c => c.key === 'waiting_threads_count')).toEqual(
        { key: 'waiting_threads_count', header: 'projects.col_waiting', type: 'count' });
      expect(component.projectColumns.find(c => c.key === 'assignee_name')?.header).toBe('projects.col_assignee');
      expect(component.trashProjectColumns.map(c => c.key)).toEqual(['id', 'name', 'deleted_at']);
      expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'name', 'visibility', 'status', 'platform', 'unread', 'assigned_to_me']);
      expect((component.filterColumns[5] as any).options).toEqual([{ value: '1', label: 'projects.filter_unread_yes' }]);
      expect((component.filterColumns[6] as any).options).toEqual([{ value: '1', label: 'projects.filter_mine_yes' }]);
      expect(component.detailsColumns.length).toBe(14);
      expect(component.t('btn_manage')).toBe('projects.btn_manage');
    });

    /**
     * @description Select options and checkpoint labels are translated; checkpoint statuses in order new, active, done.
     * @input  platform / visibility / status / order fields; createCheckpointStatusLabels; CHECKPOINT_STATUS_VALUES
     * @output values = exported constants; 'projects.platform_ai'; labels for new/active/done
     */
    it('offers translated options and the checkpoint statuses', () => {
      expect(field('platform').options.map((o: any) => o.value)).toEqual(PROJECT_PLATFORM_VALUES);
      expect(field('platform').options[3].label).toBe('projects.platform_ai');
      expect(field('visibility').options.map((o: any) => o.value)).toEqual(PROJECT_VISIBILITY_VALUES);
      expect(field('status').options.map((o: any) => o.value)).toEqual(PROJECT_STATUS_VALUES);
      expect(field('order_id').options).toEqual([{ value: '', label: 'projects.field_order_none_option' }]);
      expect(field('order_id').show_in_edit).toBeFalse();
      expect(createCheckpointStatusLabels(ctx.i18n as any)).toEqual({
        new: 'projects.checkpoint_status_new', active: 'projects.checkpoint_status_active', done: 'projects.checkpoint_status_done'
      });
      expect(CHECKPOINT_STATUS_VALUES).toEqual(['new', 'active', 'done']);
      expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['name', 'visibility']);
    });

    /**
     * @description Platform, visibility and status can be charted (count).
     * @input  graphColumns
     * @output keys platform, visibility, status with their value lists
     */
    it('offers chartable columns', () => {
      expect(component.graphColumns.map(g => [g.key, g.aggregation, g.possibleValues])).toEqual([
        ['platform', 'count', PROJECT_PLATFORM_VALUES], ['visibility', 'count', PROJECT_VISIBILITY_VALUES], ['status', 'count', PROJECT_STATUS_VALUES]
      ]);
    });

    /**
     * @description A language change rebuilds the configuration.
     * @input  getValue returns 'EN:<path>'; translations$.next({})
     * @output tableCaption 'EN:projects.table_header'
     */
    it('rebuilds the configuration when translations change', () => {
      ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
      ctx.i18n.translations$.next({});
      expect(component.tableCaption).toBe('EN:projects.table_header');
    });
  });

  describe('toolbar', () => {
    /**
     * @description Project toolbar by permission and view.
     * @input  granted []; then all; then trash view with open filters
     * @output create / report / trash hidden without permission; trash view: create and export hidden, labels switched
     */
    it('builds the project toolbar by permission and view', () => {
      ctx.permissions.granted = new Set();
      let t = toolbar();
      expect([t['handleCreateFormOpened'].showIf, t['openGraphBuilder'].showIf, t['toggleTable'].showIf]).toEqual([false, false, false]);
      ctx.permissions.granted = 'all';
      t = toolbar();
      expect(t['handleCreateFormOpened'].showIf).toBeTrue();
      expect(t['toggleTable'].label).toBe('projects.toolbar_show_trash');
      expect(t['toggleFilters'].label).toBe('projects.toolbar_filters');
      component.showTrashTable = true;
      component.isFilterVisible = true;
      t = toolbar();
      expect([t['handleCreateFormOpened'].showIf, t['exportActiveTable'].showIf]).toEqual([false, false]);
      expect(t['toggleTable'].label).toBe('projects.toolbar_show_active');
      expect(t['toggleFilters'].label).toBe('projects.toolbar_hide_filters');
      expect(t['toggleFilters'].isActive).toBeTrue();
    });

    /**
     * @description Project toolbar actions call their handlers; unknown actions are ignored.
     * @input  handleToolbarAction(each action), 'unknown'
     * @output each handler called once; 'openTemplates' navigates to /admin/web/projects/templates
     */
    it('dispatches the project toolbar actions', () => {
      const names = ['toggleFilters', 'handleCreateFormOpened', 'exportActiveTable', 'toggleTable', 'openGraphBuilder'];
      const spies = names.map(n => spyOn(component as any, n));
      names.forEach(a => component.handleToolbarAction(a));
      spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
      component.handleToolbarAction('openTemplates');
      expect(navigate).toHaveBeenCalledWith(['/admin/web/projects/templates']);
      expect(() => component.handleToolbarAction('unknown')).not.toThrow();
    });
  });

  describe('init and project form', () => {
    /**
     * @description Init loads only the projects (active + trash) - the conversations are on the project pages.
     * @input  ngOnInit() without query params
     * @output getPaginatedData('project-portal/projects', …) twice, nothing else; no form; no navigation
     */
    it('loads the projects', fakeAsync(() => {
      ctx.genericTable.getPaginatedData.and.returnValue(of(paginated([])));
      component.ngOnInit();
      const urls = ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0]);
      expect(urls).toEqual(['project-portal/projects', 'project-portal/projects']);
      expect(component.showCreateForm).toBeFalse();
      expect(navigate).not.toHaveBeenCalled();
      component.refreshData();
      expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[0]).toBe('project-portal/projects');
      discardPeriodicTasks();
    }));

    /**
     * @description An old link ?open_project=7 (calendar, bookmarks) opens the project page instead of the list.
     * @input  query { open_project: '7' }; ngOnInit()
     * @output navigate(['/admin/web/projects', '7'], { replaceUrl: true }); no create form
     */
    it('opens the project page from an old link', fakeAsync(() => {
      route.snapshot.queryParamMap = convertToParamMap({ open_project: '7' });
      component.ngOnInit();
      expect(navigate).toHaveBeenCalledWith(['/admin/web/projects', '7'], { replaceUrl: true });
      expect(component.showCreateForm).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description ?order_id=5 of an order without a project opens the create form prefilled with
     *   that order; the order select lists all orders.
     * @input  query { order_id: '5' }; projects of the order []; orders [{ id: 5, client_name: 'ACME' }]; ngOnInit()
     * @output getCollection('project-portal/projects', { order_id '5', no_pagination }); getCollection('web/sales_orders',
     *   { no_pagination, sort id desc }); options [none, '#5 — ACME']; form open with { order_id: '5' }
     */
    it('prefills the create form from a sales order', fakeAsync(() => {
      route.snapshot.queryParamMap = convertToParamMap({ order_id: '5' });
      dh().getCollection.and.callFake((endpoint: string) => of(endpoint === 'project-portal/projects' ? [] : [{ id: 5, client_name: 'ACME' }]));
      component.ngOnInit();
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects', { order_id: '5', no_pagination: 'true' });
      expect(dh().getCollection).toHaveBeenCalledWith('web/sales_orders', { no_pagination: 'true', sort_by: 'id', sort_direction: 'desc' });
      expect(field('order_id').options).toEqual([{ value: '', label: 'projects.field_order_none_option' }, { value: '5', label: '#5 — ACME' }]);
      expect(component.showCreateForm).toBeTrue();
      expect(component.selectedItemForEdit).toEqual({ order_id: '5' });
      component.handleCreateFormOpened();
      expect(component.selectedItemForEdit).toEqual({ order_id: '5' });
      component.onCancelForm();
      expect(component.showCreateForm).toBeFalse();
      component.handleCreateFormOpened();
      expect(component.selectedItemForEdit).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description ?order_id=5 of an order that has a project opens that project; a failed lookup
     *   falls back to the create form.
     * @input  query { order_id: '5' }; projects of the order [{ id: 12 }]; then the lookup fails.
     * @output navigate(['/admin/web/projects', 12], { replaceUrl: true }), no form; then the form with { order_id: '5' }.
     */
    it('opens the project of a sales order', fakeAsync(() => {
      route.snapshot.queryParamMap = convertToParamMap({ order_id: '5' });
      dh().getCollection.and.callFake((endpoint: string) => of(endpoint === 'project-portal/projects' ? [{ id: 12 }] : []));
      component.ngOnInit();
      expect(navigate).toHaveBeenCalledWith(['/admin/web/projects', 12], { replaceUrl: true });
      expect(component.showCreateForm).toBeFalse();

      dh().getCollection.and.callFake((endpoint: string) => endpoint === 'project-portal/projects' ? throwError(() => new Error('x')) : of([]));
      component.ngOnInit();
      expect(component.showCreateForm).toBeTrue();
      expect(component.selectedItemForEdit).toEqual({ order_id: '5' });
      discardPeriodicTasks();
    }));

    /**
     * @description Opening the create form offers the project templates ("No template" first, with
     *   the number of checkpoints); a failed load keeps the field as it is.
     * @input  getCollection('project-portal/projects/templates') → [Web #1 (2 checkpoints)]; then failure
     * @output template_id options ['' none, '1' 'Web (2)']; form open both times
     */
    it('offers the project templates in the create form', () => {
      dh().getCollection.and.callFake((endpoint: string) =>
        endpoint === 'project-portal/projects/templates' ? of([{ id: 1, name: 'Web', checkpoints: [{}, {}] }]) : of([]));
      component.handleCreateFormOpened();
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/templates');
      expect(field('template_id').options).toEqual([{ value: '', label: 'projects.field_template_none_option' }, { value: '1', label: 'Web (2)' }]);
      expect(component.showCreateForm).toBeTrue();
      dh().getCollection.and.callFake((endpoint: string) =>
        endpoint === 'project-portal/projects/templates' ? throwError(() => new Error('x')) : of([]));
      component.handleCreateFormOpened();
      expect(field('template_id').options!.length).toBe(2);
    });

    /**
     * @description The create form opens even when the orders cannot be loaded or the order field is missing.
     * @input  getCollection fails; then formFields without order_id
     * @output showCreateForm true both times; selectedItemForEdit null
     */
    it('opens the create form when the orders cannot be loaded', () => {
      dh().getCollection.and.returnValue(throwError(() => new Error('x')));
      component.handleCreateFormOpened();
      expect(component.showCreateForm).toBeTrue();
      expect(component.selectedItemForEdit).toBeNull();
      component.showCreateForm = false;
      component.formFields = [];
      dh().getCollection.and.returnValue(of([{ id: 1, client_name: 'X' }]));
      component.handleCreateFormOpened();
      expect(component.showCreateForm).toBeTrue();
    });

    /**
     * @description A new project opens its page (the client accounts are added there); no password
     *   is expected from the API any more and nothing is written to browser storage.
     * @input  handleFormSubmitted({ name: 'Shop' }); API { id: 7, public_url }
     * @output post('project-portal/projects', …); alert 'projects.project_created_message'; navigate to
     *   ['/admin/web/projects', 7, 'access'] (the accounts sub-page); form closed; no storage write
     */
    it('creates a project and opens its page', () => {
      const setItem = spyOn(Storage.prototype, 'setItem').and.callThrough();
      dh().post.and.returnValue(of({ id: 7, public_url: 'https://x/p/7' }));
      component.handleFormSubmitted({ name: 'Shop' });
      expect(dh().post).toHaveBeenCalledWith('project-portal/projects', { name: 'Shop' });
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'projects.project_created_message', 'success');
      expect(navigate).toHaveBeenCalledWith(['/admin/web/projects', 7, 'access']);
      expect(component.showCreateForm).toBeFalse();
      expect(setItem).not.toHaveBeenCalled();
    });

    /**
     * @description The assignee select offers "Nobody" and the administrators of
     *   GET project-portal/projects/assignees (loaded once on init, kept after a language change); a failed
     *   load keeps only "Nobody".
     * @input  getCollection('project-portal/projects/assignees') → [Jana #3, Petr #5]; detectChanges; translations$.next;
     *         then a new component whose load fails
     * @output options ['' Nobody, '3' Jana, '5' Petr] before and after the rebuild; failure → ['']
     */
    it('loads the assignee options', () => {
      dh().getCollection.and.callFake((endpoint: string) =>
        endpoint === 'project-portal/projects/assignees' ? of([{ id: 3, full_name: 'Jana' }, { id: 5, full_name: 'Petr' }]) : of([]));
      fixture.detectChanges();
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/assignees');
      const expected = [
        { value: '', label: 'projects.field_assignee_none_option' }, { value: '3', label: 'Jana' }, { value: '5', label: 'Petr' }
      ];
      expect(field('assignee_id').options).toEqual(expected);
      ctx.i18n.translations$.next({});
      expect(field('assignee_id').options).toEqual(expected);

      const other = TestBed.createComponent(ProjectsComponent);
      dh().getCollection.and.returnValue(throwError(() => new Error('x')));
      other.detectChanges();
      expect((other.componentInstance.formFields.find(f => f.column_name === 'assignee_id') as any).options.map((o: any) => o.value)).toEqual(['']);
      other.destroy();
    });

    /**
     * @description Updating, or an answer without a project id, only shows "updated" and reloads.
     * @input  handleFormSubmitted({ id: 7, name: 'X' }); handleFormSubmitted({ name: 'Y' }) with API {}
     * @output put('project-portal/projects/7', …); alerts 'projects.project_updated_message'; no navigation
     */
    it('updates a project', () => {
      component.handleFormSubmitted({ id: 7, name: 'X' });
      expect(dh().put).toHaveBeenCalledWith('project-portal/projects/7', { id: 7, name: 'X' });
      dh().post.and.returnValue(of({}));
      component.handleFormSubmitted({ name: 'Y' });
      expect(ctx.alert.open.calls.allArgs().every((a: any[]) => a[1] === 'projects.project_updated_message')).toBeTrue();
      expect(navigate).not.toHaveBeenCalled();
    });

    /**
     * @description The row button opens the project page; a row without id does nothing; passwords
     *   former versions left in sessionStorage are deleted when the page loads.
     * @input  legacy rpsw_project_pw_7 + an unrelated key; detectChanges; openProject({ id: 9 }), ({}), (null)
     * @output legacy key removed, unrelated kept; navigate(['/admin/web/projects', 9]) once
     */
    it('opens a project page and removes legacy stored passwords', () => {
      sessionStorage.setItem('rpsw_project_pw_7', JSON.stringify({ password: 'old', url: 'u', generatedAt: 'x' }));
      sessionStorage.setItem('other_key', '1');
      fixture.detectChanges();
      expect(sessionStorage.getItem('rpsw_project_pw_7')).toBeNull();
      expect(sessionStorage.getItem('other_key')).toBe('1');
      sessionStorage.removeItem('other_key');
      component.openProject({ id: 9 });
      component.openProject({});
      component.openProject(null);
      expect(navigate.calls.allArgs()).toEqual([[['/admin/web/projects', 9]]]);
    });
  });

  /**
   * @description The list page renders its table caption and has no popups or thread table any more.
   * @input  detectChanges()
   * @output text 'projects.table_header'; no .modal-overlay; no thread_table_header text
   */
  it('renders the list page', fakeAsync(() => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('projects.table_header');
    expect(el.querySelector('.modal-overlay')).toBeNull();
    expect(el.textContent).not.toContain('thread_table_header');
    discardPeriodicTasks();
  }));
});
