/**
 * @file projects.component.spec.ts
 * @path src/app/admin/web-pages/projects/projects.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ProjectsComponent and projects.config.ts – client projects of the
 *   Web module: translated configuration, toolbars, prefill from a sales order (?order_id) and
 *   opening a project from a link (?open_project), creating a project with a one-time client
 *   password (kept only in sessionStorage), the manage modal (password reveal / copy /
 *   regenerate, checkpoints add / cycle / delete), project threads (detail, status, replies with
 *   validated attachments, older messages), the global threads table and its modal, and locking
 *   the page scroll behind modals.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), ActivatedRoute (stub with query
 *   params), navigator.clipboard (spy), sessionStorage
 */

import { ComponentFixture, TestBed, fakeAsync, flush, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ProjectsComponent } from './projects.component';
import {
  CHECKPOINT_STATUS_CYCLE, PROJECT_PLATFORM_VALUES, PROJECT_STATUS_VALUES, PROJECT_THREAD_PRIORITY_VALUES,
  PROJECT_THREAD_STATUS_VALUES, PROJECT_VISIBILITY_VALUES
} from './projects.config';
import { AdminTestContext, createAdminTestContext, paginated } from '../../../../testing/admin-test-helpers';

describe('ProjectsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ProjectsComponent>;
  let component: ProjectsComponent;
  let route: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };

  const dh = () => ctx.dataHandler as any;
  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;
  const project = { id: 7, name: 'Shop', public_url: 'https://x/p/7', checkpoints: [{ id: 1, label: 'Design', status: 'new', sort_order: 1 }] };
  const file = (name: string, size = 10) => {
    const f = new File(['x'], name);
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };
  /** Message list element whose scrollTop assignments are recorded. */
  const scrollList = (scrollHeight: number) => {
    const el = document.createElement('div');
    const sets: number[] = [];
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight });
    Object.defineProperty(el, 'scrollTop', { get: () => sets[sets.length - 1] ?? 0, set: (v: number) => sets.push(v) });
    return { el, sets };
  };
  const fileEvent = (...files: File[]) => {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    const input = document.createElement('input');
    input.type = 'file';
    input.files = dt.files;
    return { target: input } as unknown as Event;
  };

  beforeEach(async () => {
    sessionStorage.removeItem('rpsw_project_pw_7');
    ctx = createAdminTestContext();
    route = { snapshot: { queryParamMap: convertToParamMap({}) } };
    dh().getOne.and.callFake((url: string) => of(url === 'web/projects/7' ? JSON.parse(JSON.stringify(project)) : { id: +url.split('/').pop()!, messages: [] }));
    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: route }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    sessionStorage.removeItem('rpsw_project_pw_7');
    document.body.removeAttribute('style');
  });

  describe('configuration', () => {
    /**
     * @description The page and the threads table are configured from the 'projects' translations.
     * @input  component created
     * @output captions; row buttons manage / edit / delete; 7 + 3 columns; 5 filters; 13 details; thread table 6 columns, 1 button, 3 filters, 5 details
     */
    it('builds the configuration from translations', () => {
      expect(component.tableCaption).toBe('projects.table_header');
      expect(component.threadsTableCaption).toBe('projects.thread_table_header');
      expect(component.buttons.map(b => [b.action, b.permission])).toEqual([
        ['generate_form', undefined], ['edit', 'web-projects-update'], ['delete', 'web-projects-delete']
      ]);
      expect(component.projectColumns.length).toBe(7);
      expect(component.trashProjectColumns.map(c => c.key)).toEqual(['id', 'name', 'deleted_at']);
      expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'name', 'visibility', 'status', 'platform']);
      expect(component.detailsColumns.length).toBe(13);
      expect(component.threadColumns.map(c => c.key)).toEqual(['id', 'project_name', 'subject', 'priority', 'status', 'last_message_at']);
      expect(component.threadButtons.map(b => b.action)).toEqual(['details']);
      expect(component.threadFilterColumns.map(c => c.key)).toEqual(['project_id', 'priority', 'status']);
      expect(component.threadDetailsColumns.length).toBe(5);
      expect(component.t('btn_manage')).toBe('projects.btn_manage');
    });

    /**
     * @description Select options and checkpoint labels are translated; the status cycle is new → active → done → new.
     * @input  platform / visibility / status fields; thread filters; checkpointStatusLabels; CHECKPOINT_STATUS_CYCLE
     * @output values = exported constants; 'projects.platform_ai'; labels for new/active/done; cycle closed
     */
    it('offers translated options and the checkpoint cycle', () => {
      expect(field('platform').options.map((o: any) => o.value)).toEqual(PROJECT_PLATFORM_VALUES);
      expect(field('platform').options[3].label).toBe('projects.platform_ai');
      expect(field('visibility').options.map((o: any) => o.value)).toEqual(PROJECT_VISIBILITY_VALUES);
      expect(field('status').options.map((o: any) => o.value)).toEqual(PROJECT_STATUS_VALUES);
      expect(field('order_id').options).toEqual([{ value: '', label: 'projects.field_order_none_option' }]);
      expect(field('order_id').show_in_edit).toBeFalse();
      const tf = (k: string) => component.threadFilterColumns.find(c => c.key === k) as any;
      expect(tf('priority').options.map((o: any) => o.value)).toEqual(PROJECT_THREAD_PRIORITY_VALUES);
      expect(tf('status').options.map((o: any) => o.value)).toEqual(PROJECT_THREAD_STATUS_VALUES);
      expect(component.checkpointStatusLabels).toEqual({
        new: 'projects.checkpoint_status_new', active: 'projects.checkpoint_status_active', done: 'projects.checkpoint_status_done'
      });
      expect(CHECKPOINT_STATUS_CYCLE).toEqual({ new: 'active', active: 'done', done: 'new' });
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
      expect(component.threadsTableCaption).toBe('EN:projects.thread_table_header');
    });
  });

  describe('toolbars', () => {
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
     * @output each handler called once
     */
    it('dispatches the project toolbar actions', () => {
      const names = ['toggleFilters', 'handleCreateFormOpened', 'exportActiveTable', 'toggleTable', 'openGraphBuilder'];
      const spies = names.map(n => spyOn(component as any, n));
      names.forEach(a => component.handleToolbarAction(a));
      spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
      expect(() => component.handleToolbarAction('unknown')).not.toThrow();
    });

    /**
     * @description Threads toolbar: filter toggle (label follows), export through the threads table.
     * @input  handleThreadsToolbarAction('toggleThreadsFilters'), ('exportThreadsTable') with / without a table, 'unknown'
     * @output isThreadsFilterVisible true and label 'projects.toolbar_hide_filters'; exportToCSV() once; no error without a table
     */
    it('handles the threads toolbar', () => {
      expect(component.threadsToolbarButtons[0].label).toBe('projects.toolbar_filters');
      expect(component.threadsToolbarButtons[1].label).toBe('projects.thread_toolbar_export');
      component.handleThreadsToolbarAction('toggleThreadsFilters');
      expect(component.isThreadsFilterVisible).toBeTrue();
      expect(component.threadsToolbarButtons[0].label).toBe('projects.toolbar_hide_filters');
      expect(component.threadsToolbarButtons[0].isActive).toBeTrue();
      const table = jasmine.createSpyObj('TableBuilderComponent', ['exportToCSV']);
      component.threadsTable = table;
      component.handleThreadsToolbarAction('exportThreadsTable');
      expect(table.exportToCSV).toHaveBeenCalledTimes(1);
      component.threadsTable = undefined as any;
      expect(() => { component.handleThreadsToolbarAction('exportThreadsTable'); component.handleThreadsToolbarAction('unknown'); }).not.toThrow();
    });
  });

  describe('init and project form', () => {
    /**
     * @description Init loads projects (active + trash) and the active threads, newest message first.
     * @input  ngOnInit() without query params
     * @output getPaginatedData('web/projects', …) twice and ('web/project-threads', 1, 15, { last_message_at desc, status active }); no form, no modal
     */
    it('loads projects and threads', fakeAsync(() => {
      ctx.genericTable.getPaginatedData.and.callFake((url: string) =>
        of(url === 'web/project-threads' ? { ...paginated([{ id: 3 }]), total: 30, last_page: 2 } as any : paginated([])));
      component.ngOnInit();
      const calls = ctx.genericTable.getPaginatedData.calls.allArgs();
      expect(calls.filter(a => a[0] === 'web/projects').length).toBe(2);
      expect(calls.find(a => a[0] === 'web/project-threads')).toEqual(['web/project-threads', 1, 15,
        { sort_by: 'last_message_at', sort_direction: 'desc', status: 'active' }]);
      expect(component.threadsData).toEqual([{ id: 3 }]);
      expect(component.threadsTotalItems).toBe(30);
      expect(component.threadsTotalPages).toBe(2);
      expect(component.showCreateForm).toBeFalse();
      expect(component.showManageModal).toBeFalse();
      component.refreshData();
      expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[0]).toBe('web/projects');
      discardPeriodicTasks();
    }));

    /**
     * @description ?open_project=7 opens the manage modal of that project.
     * @input  query { open_project: '7' }; ngOnInit()
     * @output getOne('web/projects/7'); showManageModal true; managingProject.id 7
     */
    it('opens a project from the link', fakeAsync(() => {
      route.snapshot.queryParamMap = convertToParamMap({ open_project: '7' });
      component.ngOnInit();
      expect(dh().getOne).toHaveBeenCalledWith('web/projects/7');
      expect(component.showManageModal).toBeTrue();
      expect(component.managingProject.id).toBe(7);
      discardPeriodicTasks();
    }));

    /**
     * @description ?order_id=5 opens the create form prefilled with that order; the order select lists all orders.
     * @input  query { order_id: '5' }; orders [{ id: 5, client_name: 'ACME' }]; ngOnInit()
     * @output getCollection('web/sales_orders', { no_pagination, sort id desc }); options [none, '#5 — ACME']; form open with { order_id: '5' }
     */
    it('prefills the create form from a sales order', fakeAsync(() => {
      route.snapshot.queryParamMap = convertToParamMap({ order_id: '5' });
      dh().getCollection.and.returnValue(of([{ id: 5, client_name: 'ACME' }]));
      component.ngOnInit();
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
     * @description A new project returns a one-time password: it is kept in sessionStorage and the manage modal opens.
     * @input  handleFormSubmitted({ name: 'Shop' }); API { id: 7, generated_password: 'S3cret', public_url }
     * @output post('web/projects', …); sessionStorage rpsw_project_pw_7 with password + url; alert 'projects.project_created_message'; modal open with revealedPassword
     */
    it('creates a project and reveals its password once', () => {
      dh().post.and.returnValue(of({ id: 7, generated_password: 'S3cret', public_url: 'https://x/p/7' }));
      component.handleFormSubmitted({ name: 'Shop' });
      expect(dh().post).toHaveBeenCalledWith('web/projects', { name: 'Shop' });
      const stored = JSON.parse(sessionStorage.getItem('rpsw_project_pw_7')!);
      expect(stored.password).toBe('S3cret');
      expect(stored.url).toBe('https://x/p/7');
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'projects.project_created_message', 'success');
      expect(component.showManageModal).toBeTrue();
      expect(component.revealedPassword?.password).toBe('S3cret');
      expect(component.showCreateForm).toBeFalse();
    });

    /**
     * @description Updating, or creating without a password in the answer, only shows "updated" and reloads.
     * @input  handleFormSubmitted({ id: 7, name: 'X' }); handleFormSubmitted({ name: 'Y' }) with API {}
     * @output put('web/projects/7', …); alerts 'projects.project_updated_message'; no modal
     */
    it('updates a project', () => {
      component.handleFormSubmitted({ id: 7, name: 'X' });
      expect(dh().put).toHaveBeenCalledWith('web/projects/7', { id: 7, name: 'X' });
      dh().post.and.returnValue(of({}));
      component.handleFormSubmitted({ name: 'Y' });
      expect(ctx.alert.open.calls.allArgs().every((a: any[]) => a[1] === 'projects.project_updated_message')).toBeTrue();
      expect(component.showManageModal).toBeFalse();
    });

    /**
     * @description If sessionStorage refuses the password it is still shown in the manage modal of that project only.
     * @input  sessionStorage.setItem throws; create project 8 with generated_password; then open project 7
     * @output revealedPassword.password 'S3cret' for project 8; null for project 7
     */
    it('shows the password even when sessionStorage fails', () => {
      spyOn(Storage.prototype, 'setItem').and.throwError('quota');
      dh().post.and.returnValue(of({ id: 8, generated_password: 'S3cret', public_url: 'u' }));
      component.handleFormSubmitted({ name: 'Shop' });
      expect(component.managingProject.id).toBe(8);
      expect(component.revealedPassword).toEqual(jasmine.objectContaining({ password: 'S3cret', url: 'u' }));
      component.openManageModal({ id: 7 });
      expect(component.revealedPassword).toBeNull();
    });
  });

  describe('manage modal', () => {
    /**
     * @description Opening loads the project, its checkpoints, stored password and threads; the page scroll is locked.
     * @input  stored password for project 7; openManageModal({ id: 7 })
     * @output managingProject 7; 1 checkpoint; revealedPassword from storage; getCollection('web/project-threads', { project_id: 7, no_pagination }); body position fixed
     */
    it('opens with project, checkpoints, password and threads', () => {
      sessionStorage.setItem('rpsw_project_pw_7', JSON.stringify({ password: 'pw', url: 'u', generatedAt: 'x' }));
      dh().getCollection.and.returnValue(of([{ id: 3, subject: 'Q' }]));
      component.openManageModal({ id: 7 });
      expect(component.managingProject.name).toBe('Shop');
      expect(component.managingCheckpoints.length).toBe(1);
      expect(component.revealedPassword?.password).toBe('pw');
      expect(dh().getCollection).toHaveBeenCalledWith('web/project-threads', { project_id: 7, no_pagination: 'true' });
      expect(component.managingThreads).toEqual([{ id: 3, subject: 'Q' }] as any);
      expect(document.body.style.position).toBe('fixed');
      expect(component.manageLoading).toBeFalse();
    });

    /**
     * @description A project without checkpoints / stored password, a broken stored value, and a failed load.
     * @input  getOne returns { id: 7 } with invalid JSON stored; then getOne fails
     * @output checkpoints []; revealedPassword null; after failure modal closed and scroll unlocked
     */
    it('handles missing data and a failed load', () => {
      sessionStorage.setItem('rpsw_project_pw_7', '{broken');
      dh().getOne.and.returnValue(of({ id: 7 }));
      component.openManageModal({ id: 7 });
      expect(component.managingCheckpoints).toEqual([]);
      expect(component.revealedPassword).toBeNull();
      dh().getOne.and.returnValue(throwError(() => new Error('x')));
      component.openManageModal({ id: 7 });
      expect(component.showManageModal).toBeFalse();
      expect(component.manageLoading).toBeFalse();
      expect(document.body.style.position).toBe('');
    });

    /**
     * @description Closing clears the modal state and unlocks the scroll.
     * @input  modal open; closeManageModal()
     * @output showManageModal false; managingProject null; lists empty; revealedPassword null; body position ''
     */
    it('closes and clears the modal', () => {
      component.openManageModal({ id: 7 });
      component.closeManageModal();
      expect(component.showManageModal).toBeFalse();
      expect(component.managingProject).toBeNull();
      expect(component.managingCheckpoints).toEqual([]);
      expect(component.managingThreads).toEqual([]);
      expect(component.revealedPassword).toBeNull();
      expect(document.body.style.position).toBe('');
    });

    /**
     * @description The password can be shown / hidden and copied; the public URL falls back to the project URL.
     * @input  revealedPassword { pw, url 'u' }; copy; then no password: copyPublicUrl() with project URL; then nothing
     * @output clipboard 'pw', then 'u', then 'https://x/p/7'; alerts 'projects.password_copied_message', 'projects.url_copied_message'; nothing without data
     */
    it('reveals and copies the password and URL', () => {
      const write = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
      component.copyPassword();
      component.copyPublicUrl();
      expect(write).not.toHaveBeenCalled();
      component.revealedPassword = { password: 'pw', url: 'u', generatedAt: 'x' };
      component.togglePasswordVisibility();
      expect(component.passwordVisible).toBeTrue();
      component.copyPassword();
      component.copyPublicUrl();
      expect(write.calls.allArgs()).toEqual([['pw'], ['u']]);
      expect(ctx.alert.open).toHaveBeenCalledWith('projects.copied_title', 'projects.password_copied_message', 'success');
      expect(ctx.alert.open).toHaveBeenCalledWith('projects.copied_title', 'projects.url_copied_message', 'success');
      component.revealedPassword = null;
      component.managingProject = { id: 7, public_url: 'https://x/p/7' };
      component.copyPublicUrl();
      expect(write).toHaveBeenCalledWith('https://x/p/7');
    });

    /**
     * @description Copying still informs the user where the Clipboard API is missing (non-secure context).
     * @input  navigator.clipboard undefined; copyPassword()
     * @output no error; alert 'projects.password_copied_message'
     */
    it('copes without the Clipboard API', () => {
      spyOnProperty(navigator, 'clipboard', 'get').and.returnValue(undefined as any);
      component.revealedPassword = { password: 'pw', url: 'u', generatedAt: 'x' };
      expect(() => { component.copyPassword(); component.copyPublicUrl(); }).not.toThrow();
      expect(ctx.alert.open).toHaveBeenCalledWith('projects.copied_title', 'projects.password_copied_message', 'success');
    });

    /**
     * @description Regenerating the client password asks first, stores and shows the new one.
     * @input  managingProject 7; confirm → true; API { generated_password: 'New1' }
     * @output post('web/projects/7/regenerate-password', {}); stored 'New1'; passwordVisible true; success alert
     */
    it('regenerates the client password', async () => {
      component.managingProject = { ...project };
      dh().post.and.returnValue(of({ generated_password: 'New1' }));
      await component.regeneratePassword();
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.regenerate_password_confirm_title', 'projects.regenerate_password_confirm_message');
      expect(dh().post).toHaveBeenCalledWith('web/projects/7/regenerate-password', {});
      expect(JSON.parse(sessionStorage.getItem('rpsw_project_pw_7')!).password).toBe('New1');
      expect(component.passwordVisible).toBeTrue();
      expect(component.passwordRegenerating).toBeFalse();
      expect(ctx.alert.open).toHaveBeenCalledWith('projects.password_regenerated_title', 'projects.password_regenerated_message', 'success');
    });

    /**
     * @description Regeneration does nothing without a project, while running, when cancelled; a failure resets the flag.
     * @input  no project; busy; confirm → false; then post fails
     * @output confirm asked only for the cancelled / failed case; post once (failure); passwordRegenerating false
     */
    it('guards password regeneration', async () => {
      await component.regeneratePassword();
      component.managingProject = { ...project };
      component.passwordRegenerating = true;
      await component.regeneratePassword();
      expect(ctx.confirm.open).not.toHaveBeenCalled();
      component.passwordRegenerating = false;
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.regeneratePassword();
      expect(dh().post).not.toHaveBeenCalled();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      dh().post.and.returnValue(throwError(() => new Error('x')));
      await component.regeneratePassword();
      expect(dh().post).toHaveBeenCalledTimes(1);
      expect(component.passwordRegenerating).toBeFalse();
    });
  });

  describe('checkpoints', () => {
    beforeEach(() => component.openManageModal({ id: 7 }));

    /**
     * @description A checkpoint is added with the trimmed label; empty labels are ignored.
     * @input  newCheckpointLabel '  '; then '  Launch '; API { id: 2, label: 'Launch' }
     * @output first nothing; post('web/projects/7/checkpoints', { label: 'Launch' }); list length 2; input cleared
     */
    it('adds checkpoints', () => {
      component.newCheckpointLabel = '  ';
      component.addCheckpoint();
      expect(dh().post).not.toHaveBeenCalled();
      dh().post.and.returnValue(of({ id: 2, label: 'Launch', status: 'new', sort_order: 2 }));
      component.newCheckpointLabel = '  Launch ';
      component.addCheckpoint();
      expect(dh().post).toHaveBeenCalledWith('web/projects/7/checkpoints', { label: 'Launch' });
      expect(component.managingCheckpoints.length).toBe(2);
      expect(component.newCheckpointLabel).toBe('');
      component.managingProject = null;
      component.newCheckpointLabel = 'X';
      component.addCheckpoint();
      expect(dh().post).toHaveBeenCalledTimes(1);
    });

    /**
     * @description Clicking a checkpoint moves it to the next status; a busy checkpoint is not sent twice.
     * @input  checkpoint 1 (new); API { status: 'active' }; then while busy; then a failure
     * @output put('web/projects/7/checkpoints/1', { status: 'active' }); status 'active'; busy request ignored; busy flag cleared after failure
     */
    it('cycles the checkpoint status', () => {
      const cp = component.managingCheckpoints[0];
      dh().put.and.returnValue(of({ ...cp, status: 'active' }));
      component.cycleCheckpointStatus(cp);
      expect(dh().put).toHaveBeenCalledWith('web/projects/7/checkpoints/1', { status: 'active' });
      expect(cp.status).toBe('active');
      expect(component.checkpointBusyIds.size).toBe(0);
      component.checkpointBusyIds.add(1);
      component.cycleCheckpointStatus(cp);
      expect(dh().put).toHaveBeenCalledTimes(1);
      component.checkpointBusyIds.clear();
      dh().put.and.returnValue(throwError(() => new Error('x')));
      component.cycleCheckpointStatus(cp);
      expect(component.checkpointBusyIds.has(1)).toBeFalse();
      component.managingProject = null;
      component.cycleCheckpointStatus(cp);
      expect(dh().put).toHaveBeenCalledTimes(2);
    });

    /**
     * @description Deleting a checkpoint asks with its label first.
     * @input  delete_checkpoint_confirm_message '{label}?'; confirm → false, then true
     * @output confirm ('…title', 'Design?'); nothing deleted after cancel; delete('web/projects/7/checkpoints/1') and removed after confirm
     */
    it('deletes a checkpoint after confirmation', async () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'projects.delete_checkpoint_confirm_message' ? '{label}?' : p));
      const cp = component.managingCheckpoints[0];
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.deleteCheckpoint(cp);
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.delete_checkpoint_confirm_title', 'Design?');
      expect(dh().delete).not.toHaveBeenCalled();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.deleteCheckpoint(cp);
      expect(dh().delete).toHaveBeenCalledWith('web/projects/7/checkpoints/1');
      expect(component.managingCheckpoints).toEqual([]);
      component.managingProject = null;
      await component.deleteCheckpoint(cp);
      expect(dh().delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('project threads in the manage modal', () => {
    const thread = { id: 3, subject: 'Q', priority: 'low', status: 'active', last_message_at: null };

    beforeEach(() => {
      dh().getCollection.and.returnValue(of([{ ...thread }]));
      component.openManageModal({ id: 7 });
    });

    /**
     * @description Opening a thread loads its messages and scrolls the message list to the bottom.
     * @input  openThread(thread); full thread { id: 3, messages: [...] }; message list element 100 px high content
     * @output getOne('web/project-threads/3'); selectedThread replaced; loading false; scrollTop set to 100 (bottom)
     */
    it('opens a thread and scrolls to the newest message', fakeAsync(() => {
      const list = scrollList(100);
      component.pmMessageListEl = { nativeElement: list.el };
      dh().getOne.and.returnValue(of({ ...thread, messages: [{ id: 10, author_type: 'customer', body: 'Hi' }] }));
      component.openThread(thread as any);
      expect(dh().getOne).toHaveBeenCalledWith('web/project-threads/3');
      expect(component.selectedThread?.messages?.length).toBe(1);
      expect(component.threadDetailLoading).toBeFalse();
      tick();
      expect(list.sets).toEqual([100]);
      component.pmMessageListEl = undefined;
      component.openThread(thread as any);
      flush();
      dh().getOne.and.returnValue(throwError(() => new Error('x')));
      component.openThread(thread as any);
      expect(component.threadDetailLoading).toBeFalse();
      component.closeThread();
      expect(component.selectedThread).toBeNull();
    }));

    /**
     * @description Changing the status updates the thread everywhere it is shown.
     * @input  selectedThread 3 (also in managingThreads and threadsData); changeThreadStatus('closed')
     * @output put('web/project-threads/3/status', { status: 'closed' }); all three copies 'closed'; nothing without a selected thread
     */
    it('changes the thread status everywhere', () => {
      component.selectedThread = { ...thread } as any;
      component.threadsData = [{ ...thread }];
      dh().put.and.returnValue(of({ ...thread, status: 'closed' }));
      component.changeThreadStatus('closed');
      expect(dh().put).toHaveBeenCalledWith('web/project-threads/3/status', { status: 'closed' });
      expect(component.selectedThread!.status).toBe('closed');
      expect(component.managingThreads[0].status).toBe('closed');
      expect(component.threadsData[0].status).toBe('closed');
      component.managingThreads = [];
      component.threadsData = [];
      component.changeThreadStatus('active');
      expect(component.selectedThread!.status).toBe('closed');
      component.selectedThread = null;
      component.changeThreadStatus('closed');
      expect(dh().put).toHaveBeenCalledTimes(2);
    });

    /**
     * @description A text reply is posted as JSON, then the thread, project threads and threads table reload.
     * @input  selectedThread 3; replyBody '  Hello '; threadsData row 3; sendReply()
     * @output post('web/project-threads/3/reply', { body: 'Hello' }); last_message_at patched; reply cleared; threads reloaded
     */
    it('sends a text reply', async () => {
      component.selectedThread = { ...thread } as any;
      const rows = [{ id: 3, last_message_at: null }, { id: 4, last_message_at: null }];
      component.threadsData = rows;
      component.replyBody = '  Hello ';
      dh().getCollection.calls.reset();
      await component.sendReply();
      expect(dh().post).toHaveBeenCalledWith('web/project-threads/3/reply', { body: 'Hello' });
      expect(rows[0].last_message_at as any).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(rows[1].last_message_at).toBeNull();
      expect(component.replyBody).toBe('');
      expect(component.replySending).toBeFalse();
      expect(dh().getCollection).toHaveBeenCalledWith('web/project-threads', { project_id: 7, no_pagination: 'true' });
      expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[0]).toBe('web/project-threads');
    });

    /**
     * @description A reply with files is sent as multipart FormData (body + attachments[]); outside the modal no project reload.
     * @input  replyFiles [a.pdf]; replyBody 'See file'; managingProject null
     * @output post body FormData with body 'See file' and one attachments[]; project threads not reloaded
     */
    it('sends a reply with attachments as FormData', async () => {
      component.selectedThread = { ...thread } as any;
      component.managingProject = null;
      component.replyFiles = [file('a.pdf')];
      component.replyBody = 'See file';
      dh().getCollection.calls.reset();
      await component.sendReply();
      const body = dh().post.calls.mostRecent().args[1] as FormData;
      expect(body.get('body')).toBe('See file');
      expect(body.getAll('attachments[]').length).toBe(1);
      expect(component.replyFiles).toEqual([]);
      expect(dh().getCollection).not.toHaveBeenCalled();
    });

    /**
     * @description Empty replies, no thread or a running send do nothing; a failed send keeps the text.
     * @input  body '  '; no thread; sending; then post fails
     * @output post not called for the guards; after failure replyBody kept and replySending false
     */
    it('guards and recovers reply sending', async () => {
      component.replyBody = '  ';
      component.selectedThread = { ...thread } as any;
      await component.sendReply();
      component.replyBody = 'x';
      component.selectedThread = null;
      await component.sendReply();
      component.selectedThread = { ...thread } as any;
      component.replySending = true;
      await component.sendReply();
      expect(dh().post).not.toHaveBeenCalled();
      component.replySending = false;
      dh().post.and.returnValue(throwError(() => new Error('x')));
      await component.sendReply();
      expect(component.replyBody).toBe('x');
      expect(component.replySending).toBeFalse();
    });

    /**
     * @description Older messages are prepended and the scroll position is kept.
     * @input  thread with messages [id 20], has_more true; list scrollHeight 100; API { data: [id 10], has_more false }
     * @output get('…/messages?before_message_id=20'); messages [10, 20]; has_more false; loading false; scrollTop = new height − old height (0 here)
     */
    it('loads older messages', fakeAsync(() => {
      const list = scrollList(100);
      component.pmMessageListEl = { nativeElement: list.el };
      component.selectedThread = { ...thread, has_more_older_messages: true, messages: [{ id: 20 } as any] } as any;
      dh().get.and.returnValue(of({ data: [{ id: 10 }], has_more_older_messages: false }));
      component.loadOlderMessages();
      expect(dh().get).toHaveBeenCalledWith('web/project-threads/3/messages?before_message_id=20');
      expect(component.selectedThread!.messages!.map(m => m.id)).toEqual([10, 20]);
      expect(component.selectedThread!.has_more_older_messages).toBeFalse();
      expect(component.olderMessagesLoading).toBeFalse();
      tick();
      expect(list.sets).toEqual([0]);
    }));

    /**
     * @description Older messages are not requested without a thread, while loading, without more messages or without a first message.
     * @input  the four guard states; then a failing request; then a response after the messages were cleared
     * @output get not called for the guards; loading false after failure; response prepended to an empty list
     */
    it('guards loading of older messages', fakeAsync(() => {
      component.selectedThread = null;
      component.loadOlderMessages();
      component.selectedThread = { ...thread, has_more_older_messages: true, messages: [{ id: 20 } as any] } as any;
      component.olderMessagesLoading = true;
      component.loadOlderMessages();
      component.olderMessagesLoading = false;
      component.selectedThread!.has_more_older_messages = false;
      component.loadOlderMessages();
      component.selectedThread!.has_more_older_messages = true;
      component.selectedThread!.messages = [];
      component.loadOlderMessages();
      component.selectedThread!.messages = undefined;
      component.loadOlderMessages();
      expect(dh().get).not.toHaveBeenCalled();
      component.selectedThread!.messages = [{ id: 20 } as any];
      dh().get.and.returnValue(throwError(() => new Error('x')));
      component.loadOlderMessages();
      expect(component.olderMessagesLoading).toBeFalse();
      const response$ = new Subject<any>();
      dh().get.and.returnValue(response$);
      component.pmMessageListEl = undefined;
      component.loadOlderMessages();
      component.selectedThread!.messages = undefined;
      response$.next({ data: [{ id: 5 }], has_more_older_messages: false });
      expect(component.selectedThread!.messages!.map(m => m.id)).toEqual([5]);
      flush();
    }));
  });

  describe('attachments', () => {
    /**
     * @description File sizes are shown in KB below 1 MB, otherwise in MB; missing size is empty.
     * @input  formatFileSize(0), (2048), (5 * 1024 * 1024), (undefined)
     * @output '0 KB', '2 KB', '5.0 MB', ''
     */
    it('formats file sizes', () => {
      expect(component.formatFileSize(0)).toBe('0 KB');
      expect(component.formatFileSize(2048)).toBe('2 KB');
      expect(component.formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
      expect(component.formatFileSize(undefined as any)).toBe('');
    });

    /**
     * @description Allowed files are added; wrong type, files over 15 MB and files without extension are refused (first error shown).
     * @input  a.PDF, virus.exe, big.zip (16 MB), README
     * @output replyFiles ['a.PDF']; replyFileError 'projects.attachment_error_type' (first error only); input value cleared
     */
    it('validates selected reply files', () => {
      const event = fileEvent(file('a.PDF'), file('virus.exe'), file('big.zip', 16 * 1024 * 1024), file('README'));
      component.onReplyFilesSelected(event);
      expect(component.replyFiles.map(f => f.name)).toEqual(['a.PDF']);
      expect(component.replyFileError).toBe('projects.attachment_error_type');
      expect((event.target as HTMLInputElement).value).toBe('');
      component.onReplyFilesSelected(fileEvent(file('big.zip', 16 * 1024 * 1024)));
      expect(component.replyFileError).toBe('projects.attachment_error_size');
      component.removeReplyFile(0);
      expect(component.replyFiles).toEqual([]);
      expect(component.replyFileError).toBeNull();
    });

    /**
     * @description At most 5 attachments; an empty selection changes nothing.
     * @input  6 pdf files; then an empty selection
     * @output 5 files kept; error 'projects.attachment_error_too_many'; empty selection ignored
     */
    it('limits the number of attachments', () => {
      component.onReplyFilesSelected(fileEvent(...[1, 2, 3, 4, 5, 6].map(i => file(`f${i}.pdf`))));
      expect(component.replyFiles.length).toBe(5);
      expect(component.replyFileError).toBe('projects.attachment_error_too_many');
      component.onReplyFilesSelected(fileEvent());
      component.onReplyFilesSelected({ target: {} } as any);
      expect(component.replyFiles.length).toBe(5);
    });

    /**
     * @description The thread modal uses the same validation with its own list.
     * @input  onThreadModalReplyFilesSelected(a.png, x.bat); remove; empty selection
     * @output threadModalReplyFiles ['a.png']; error 'projects.attachment_error_type'; removed and error cleared; empty selection ignored
     */
    it('validates thread modal reply files', () => {
      component.onThreadModalReplyFilesSelected(fileEvent(file('a.png'), file('x.bat')));
      expect(component.threadModalReplyFiles.map(f => f.name)).toEqual(['a.png']);
      expect(component.threadModalReplyFileError).toBe('projects.attachment_error_type');
      component.removeThreadModalReplyFile(0);
      expect(component.threadModalReplyFiles).toEqual([]);
      expect(component.threadModalReplyFileError).toBeNull();
      component.onThreadModalReplyFilesSelected(fileEvent());
      expect(component.threadModalReplyFiles).toEqual([]);
    });
  });

  describe('threads table and thread modal', () => {
    /**
     * @description Filters, clearing and paging reload the threads table.
     * @input  applyThreadsFilters({ priority: 'high' }) on page 3; clearThreadsFilters(); page change 2; page size 50
     * @output filters merged and page 1; defaults restored; page 2; size 50 and page 1; each step reloads
     */
    it('filters and pages the threads table', () => {
      component.threadsCurrentPage = 3;
      component.applyThreadsFilters({ priority: 'high' });
      expect(component.threadsFilters).toEqual({ sort_by: 'last_message_at', sort_direction: 'desc', status: 'active', priority: 'high' });
      expect(component.threadsCurrentPage).toBe(1);
      component.clearThreadsFilters();
      expect(component.threadsFilters).toEqual({ sort_by: 'last_message_at', sort_direction: 'desc', status: 'active' });
      component.handleThreadsPageChange(2);
      expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[1]).toBe(2);
      component.handleThreadsItemsPerPageChange(50);
      expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args.slice(1, 3)).toEqual([1, 50]);
      expect(ctx.genericTable.getPaginatedData).toHaveBeenCalledTimes(4);
    });

    /**
     * @description The thread modal loads the full thread, locks the scroll and scrolls to the newest message; it can be closed.
     * @input  openThreadModal({ id: 3 }); then a failing load; closeThreadModal()
     * @output get('web/project-threads/3'); activeThread replaced; loading false; body fixed; scrolled to 80; after close activeThread null and body ''
     */
    it('opens and closes the thread modal', fakeAsync(() => {
      const list = scrollList(80);
      component.threadModalMessageListEl = { nativeElement: list.el };
      dh().get.and.returnValue(of({ id: 3, subject: 'Q', messages: [{ id: 1 }] }));
      component.openThreadModal({ id: 3 });
      expect(dh().get).toHaveBeenCalledWith('web/project-threads/3');
      expect(component.activeThread.messages.length).toBe(1);
      expect(component.threadModalLoading).toBeFalse();
      expect(document.body.style.position).toBe('fixed');
      tick();
      expect(list.sets).toEqual([80]);
      dh().get.and.returnValue(throwError(() => new Error('x')));
      component.openThreadModal({ id: 3 });
      expect(component.threadModalLoading).toBeFalse();
      component.closeThreadModal();
      expect(component.showThreadModal).toBeFalse();
      expect(component.activeThread).toBeNull();
      expect(document.body.style.position).toBe('');
    }));

    /**
     * @description A reply from the thread modal (text or with files) reloads the thread and the table.
     * @input  activeThread 3; text reply; then reply with a file; then a failure
     * @output post('web/project-threads/3/reply', { body: 'Hi' }); second post FormData; reply cleared; failure keeps the text
     */
    it('sends replies from the thread modal', async () => {
      dh().get.and.returnValue(of({ id: 3, messages: [] }));
      component.activeThread = { id: 3 };
      component.threadModalReplyBody = ' Hi ';
      await component.sendThreadModalReply();
      expect(dh().post).toHaveBeenCalledWith('web/project-threads/3/reply', { body: 'Hi' });
      expect(component.threadModalReplyBody).toBe('');
      expect(dh().get).toHaveBeenCalledWith('web/project-threads/3');
      component.threadModalReplyFiles = [file('a.pdf')];
      component.threadModalReplyBody = 'With file';
      await component.sendThreadModalReply();
      expect(dh().post.calls.mostRecent().args[1]).toEqual(jasmine.any(FormData));
      dh().post.and.returnValue(throwError(() => new Error('x')));
      component.threadModalReplyBody = 'Keep';
      await component.sendThreadModalReply();
      expect(component.threadModalReplyBody).toBe('Keep');
      expect(component.threadModalReplySending).toBeFalse();
    });

    /**
     * @description Empty text, no thread or a running send do nothing in the thread modal.
     * @input  body '  '; no activeThread; sending true
     * @output post not called
     */
    it('guards thread modal replies', async () => {
      component.activeThread = { id: 3 };
      component.threadModalReplyBody = '  ';
      await component.sendThreadModalReply();
      component.threadModalReplyBody = 'x';
      component.activeThread = null;
      await component.sendThreadModalReply();
      component.activeThread = { id: 3 };
      component.threadModalReplySending = true;
      await component.sendThreadModalReply();
      expect(dh().post).not.toHaveBeenCalled();
    });

    /**
     * @description Older messages in the thread modal are prepended; guards and failures are handled.
     * @input  activeThread with messages [20], more true; API { data: [10] }; guard states; failure; late response
     * @output get('…/messages?before_message_id=20'); messages [10, 20]; guards no request; loading false after failure
     */
    it('loads older messages in the thread modal', fakeAsync(() => {
      const list = scrollList(60);
      component.threadModalMessageListEl = { nativeElement: list.el };
      component.activeThread = { id: 3, has_more_older_messages: true, messages: [{ id: 20 }] };
      dh().get.and.returnValue(of({ data: [{ id: 10 }], has_more_older_messages: false }));
      component.loadOlderThreadModalMessages();
      expect(dh().get).toHaveBeenCalledWith('web/project-threads/3/messages?before_message_id=20');
      expect(component.activeThread.messages.map((m: any) => m.id)).toEqual([10, 20]);
      tick();
      expect(list.sets).toEqual([0]);
      dh().get.calls.reset();
      component.activeThread = null;
      component.loadOlderThreadModalMessages();
      component.activeThread = { id: 3, has_more_older_messages: true, messages: [{ id: 20 }] };
      component.threadModalOlderMessagesLoading = true;
      component.loadOlderThreadModalMessages();
      component.threadModalOlderMessagesLoading = false;
      component.activeThread.has_more_older_messages = false;
      component.loadOlderThreadModalMessages();
      component.activeThread.has_more_older_messages = true;
      component.activeThread.messages = [];
      component.loadOlderThreadModalMessages();
      expect(dh().get).not.toHaveBeenCalled();
      component.activeThread.messages = [{ id: 20 }];
      dh().get.and.returnValue(throwError(() => new Error('x')));
      component.loadOlderThreadModalMessages();
      expect(component.threadModalOlderMessagesLoading).toBeFalse();
      const response$ = new Subject<any>();
      dh().get.and.returnValue(response$);
      component.threadModalMessageListEl = undefined;
      component.loadOlderThreadModalMessages();
      component.activeThread.messages = undefined;
      response$.next({ data: [{ id: 5 }], has_more_older_messages: false });
      expect(component.activeThread.messages.map((m: any) => m.id)).toEqual([5]);
      flush();
    }));
  });

  /**
   * @description Thread status and author labels are translated.
   * @input  threadStatusLabel('closed'), ('active'); threadAuthorLabel('admin'), ('customer')
   * @output 'projects.thread_status_closed', '…_active'; 'projects.thread_author_admin', '…_customer'
   */
  it('translates thread status and author', () => {
    expect(component.threadStatusLabel('closed')).toBe('projects.thread_status_closed');
    expect(component.threadStatusLabel('active')).toBe('projects.thread_status_active');
    expect(component.threadAuthorLabel('admin')).toBe('projects.thread_author_admin');
    expect(component.threadAuthorLabel('customer')).toBe('projects.thread_author_customer');
  });

  /**
   * @description The page, the manage modal and the thread modal render.
   * @input  detectChanges(); open manage modal (with a thread); open thread modal
   * @output texts 'projects.table_header', 'Shop' and the thread subject rendered
   */
  it('renders the page and both modals', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('projects.table_header');
    dh().getCollection.and.returnValue(of([{ id: 3, subject: 'Question about launch', priority: 'low', status: 'active', last_message_at: null }]));
    component.openManageModal({ id: 7 });
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Shop');
    expect(fixture.nativeElement.textContent).toContain('Question about launch');
    component.closeManageModal();
    dh().get.and.returnValue(of({ id: 3, subject: 'Question about launch', messages: [{ id: 1, author_type: 'admin', body: 'Hello', created_at: '2026-01-01' }] }));
    component.openThreadModal({ id: 3 });
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hello');
    flush();
    discardPeriodicTasks();
  }));
});
