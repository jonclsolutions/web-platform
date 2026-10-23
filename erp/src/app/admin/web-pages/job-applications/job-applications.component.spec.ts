/**
 * @file job-applications.component.spec.ts
 * @path src/app/admin/web-pages/job-applications/job-applications.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of JobApplicationsComponent and job-applications.config.ts – job
 *   applications sent from the public web: translated configuration, applicant data read-only in
 *   the form (only state and internal note editable, nothing can be created here), chartable
 *   columns, toolbar by permission and view, the delayed edit form and saving.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';

import { JobApplicationsComponent } from './job-applications.component';
import { JOB_APPLICATION_STATE_VALUES } from './job-applications.config';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('JobApplicationsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<JobApplicationsComponent>;
  let component: JobApplicationsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [JobApplicationsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(JobApplicationsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The page configuration is built from the 'job-applications' translations.
   * @input  component created
   * @output caption; row buttons details/edit/delete with web-job-applications-* permissions; 5 + 4 columns; 4 filters; 10 detail columns (attachments as files)
   */
  it('builds the page configuration from translations', () => {
    expect(component.tableCaption).toBe('job-applications.table_header');
    expect(component.buttons.map(b => b.permission)).toEqual([undefined, 'web-job-applications-update', 'web-job-applications-delete']);
    expect(component.columns.map(c => c.key)).toEqual(['id', 'full_name', 'position_name', 'state', 'created_at']);
    expect(component.trashColumns.map(c => c.key)).toEqual(['id', 'full_name', 'position_name', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'last_name', 'position_name', 'state']);
    expect(component.detailsColumns.find(c => c.key === 'attachments')!.type).toBe('files');
    expect(component.detailsColumns.length).toBe(10);
    expect(component.t('btn_edit')).toBe('job-applications.btn_edit');
  });

  /**
   * @description Applicant data is read-only; only state (required) and internal note can be changed; nothing is created here.
   * @input  formFields
   * @output editable ['state', 'internal_note']; show_in_create false for all; state options = JOB_APPLICATION_STATE_VALUES with labels
   */
  it('lets the admin change only state and internal note', () => {
    expect(component.formFields.filter(f => f.editable).map(f => f.column_name)).toEqual(['state', 'internal_note']);
    expect(component.formFields.every(f => f.show_in_create === false)).toBeTrue();
    expect(field('state').required).toBeTrue();
    expect(field('state').options.map((o: any) => o.value)).toEqual(JOB_APPLICATION_STATE_VALUES);
    expect(field('state').options[0].label).toBe('job-applications.state_new');
    expect(component.filterColumns.find(c => c.key === 'state')!.options!.length).toBe(5);
  });

  /**
   * @description Position and state can be charted (count).
   * @input  detailsColumns
   * @output graphColumns position_name (no fixed values) and state (JOB_APPLICATION_STATE_VALUES)
   */
  it('offers chartable columns', () => {
    expect(component.graphColumns).toEqual([
      { key: 'position_name', label: 'job-applications.details_position', aggregation: 'count', possibleValues: undefined },
      { key: 'state', label: 'job-applications.details_state', aggregation: 'count', possibleValues: JOB_APPLICATION_STATE_VALUES }
    ]);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:job-applications.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:job-applications.table_header');
  });

  /**
   * @description Toolbar: no create/import; report and trash need permissions; export hidden in the trash.
   * @input  granted []; then all with trash view and open filters
   * @output actions toggleFilters, exportActiveTable, openGraphBuilder, toggleTable; report/trash hidden without permission; trash view: export hidden, labels switched
   */
  it('builds the toolbar by permission and view', () => {
    expect(component.toolbarButtons.map(b => b.action)).toEqual(['toggleFilters', 'exportActiveTable', 'openGraphBuilder', 'toggleTable']);
    ctx.permissions.granted = new Set();
    expect(toolbar()['openGraphBuilder'].showIf).toBeFalse();
    expect(toolbar()['toggleTable'].showIf).toBeFalse();
    ctx.permissions.granted = 'all';
    let t = toolbar();
    expect(t['exportActiveTable'].showIf).toBeTrue();
    expect(t['toggleTable'].label).toBe('job-applications.toolbar_show_trash');
    expect(t['toggleFilters'].label).toBe('job-applications.toolbar_filters');
    component.showTrashTable = true;
    component.isFilterVisible = true;
    t = toolbar();
    expect(t['exportActiveTable'].showIf).toBeFalse();
    expect(t['toggleTable'].label).toBe('job-applications.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('job-applications.toolbar_hide_filters');
  });

  /**
   * @description Toolbar actions call their handlers; create is not offered on this page.
   * @input  handleToolbarAction(toggleFilters | exportActiveTable | openGraphBuilder | toggleTable | handleCreateFormOpened)
   * @output the four handlers called once; create form not opened
   */
  it('dispatches the toolbar actions', () => {
    const names = ['toggleFilters', 'exportActiveTable', 'openGraphBuilder', 'toggleTable'];
    const spies = names.map(n => spyOn(component as any, n));
    names.forEach(a => component.handleToolbarAction(a));
    spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
    component.handleToolbarAction('handleCreateFormOpened');
    expect(component.showCreateForm).toBeFalse();
  });

  /**
   * @description Applications of web/job_applications are loaded after the auth check; refresh keeps the filters.
   * @input  ngOnInit(); filters { state: 'new' }; refreshData()
   * @output getPaginatedData('web/job_applications', …) for active and trash; refresh with state 'new'
   */
  it('loads the applications', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0])).toEqual(['web/job_applications', 'web/job_applications']);
    component.filters = { state: 'new' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ state: 'new' }));
    discardPeriodicTasks();
  }));

  /**
   * @description The edit form is closed first and reopened after 50 ms with a deep copy of the row.
   * @input  handleEditFormOpened({ id: 3, attachments: [{ name: 'cv.pdf' }] }); tick(50)
   * @output immediately closed (null); after 50 ms open with an equal but not identical copy (nested array copied too)
   */
  it('opens the edit form with a deep copy after a short delay', fakeAsync(() => {
    const row = { id: 3, attachments: [{ name: 'cv.pdf' }] };
    component.showCreateForm = true;
    component.handleEditFormOpened(row);
    expect(component.showCreateForm).toBeFalse();
    expect(component.selectedItemForEdit).toBeNull();
    tick(50);
    expect(component.showCreateForm).toBeTrue();
    expect(component.selectedItemForEdit).toEqual(row);
    expect(component.selectedItemForEdit.attachments).not.toBe(row.attachments);
  }));

  /**
   * @description Saving updates the application, shows a success message, reloads and closes the form.
   * @input  handleFormSubmitted({ id: 3, state: 'interview' })
   * @output put('web/job_applications/3', { id: 3, state: 'interview' }); alert ('shared.success', 'job-applications.crud_updated_message', 'success'); form closed
   */
  it('saves the application', () => {
    component.showCreateForm = true;
    component.selectedItemForEdit = { id: 3 };
    component.handleFormSubmitted({ id: 3, state: 'interview' });
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/job_applications/3', { id: 3, state: 'interview' });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'job-applications.crud_updated_message', 'success');
    expect(ctx.genericTable.getPaginatedData).toHaveBeenCalled();
    expect(component.showCreateForm).toBeFalse();
    expect(component.selectedItemForEdit).toBeNull();
  });

  /**
   * @description The page renders its title.
   * @input  detectChanges()
   * @output text contains 'job-applications.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('job-applications.table_header');
    discardPeriodicTasks();
  }));
});
