/**
 * @file user-request.component.spec.ts
 * @path src/app/admin/web-pages/user-request/user-request.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of UserRequestComponent and user-request.config.ts – requests sent
 *   from the public contact form: translated configuration, theme / status / priority options,
 *   form validation, chartable columns, toolbar by permission and view, toolbar actions, create /
 *   update, and the e-mail template editor (languages, loading, per-language texts with
 *   translated defaults in the preview, saving).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of } from 'rxjs';

import { UserRequestComponent } from './user-request.component';
import {
  USER_REQUEST_PRIORITY_OPTIONS, USER_REQUEST_PRIORITY_VALUES, USER_REQUEST_STATUS_OPTIONS, USER_REQUEST_STATUS_VALUES,
  USER_REQUEST_THEMA_OPTIONS, USER_REQUEST_THEMA_VALUES
} from './user-request.config';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('UserRequestComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<UserRequestComponent>;
  let component: UserRequestComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;
  const filter = (key: string) => component.filterColumns.find(c => c.key === key) as any;

  /** DataHandler.get answers for the e-mail template editor. */
  const answer = (languages: any, template: any) => {
    (ctx.dataHandler as any).get.and.callFake((url: string) => {
      if (url === 'languages/web') return languages;
      if (url === 'web/settings/raw-request-email-template') return template;
      return of({});
    });
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [UserRequestComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(UserRequestComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The page configuration is built from the 'user-request' translations.
   * @input  component created
   * @output caption; row buttons with web-user-requests-* permissions and labels; 6 + 4 columns; 5 filters; 11 detail columns
   */
  it('builds the page configuration from translations', () => {
    expect(component.tableCaption).toBe('user-request.table_header');
    expect(component.buttons.map(b => [b.display_name, b.permission])).toEqual([
      ['user-request.btn_details', undefined], ['user-request.btn_edit', 'web-user-requests-update'], ['user-request.btn_delete', 'web-user-requests-delete']
    ]);
    expect(component.userRequestColumns.map(c => c.key)).toEqual(['id', 'thema', 'contact_email', 'status', 'priority', 'created_at']);
    expect(component.trashUserRequestColumns.map(c => c.key)).toEqual(['id', 'thema', 'contact_email', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'thema', 'contact_email', 'status', 'priority']);
    expect(component.detailsColumns.length).toBe(11);
    expect(component.t('btn_edit')).toBe('user-request.btn_edit');
  });

  /**
   * @description Theme, status and priority options with translated labels; the *_OPTIONS aliases equal the values.
   * @input  thema / status / priority fields and filters
   * @output values = exported constants; labels 'user-request.thema_careers', 'user-request.status_cancelled', 'user-request.priority_high'
   */
  it('offers translated theme, status and priority options', () => {
    expect(field('thema').options.map((o: any) => o.value)).toEqual(USER_REQUEST_THEMA_VALUES);
    expect(field('status').options.map((o: any) => o.value)).toEqual(USER_REQUEST_STATUS_VALUES);
    expect(field('priority').options.map((o: any) => o.value)).toEqual(USER_REQUEST_PRIORITY_VALUES);
    expect(field('thema').options[2].label).toBe('user-request.thema_careers');
    expect(field('status').options[3].label).toBe('user-request.status_cancelled');
    expect(field('priority').options[2].label).toBe('user-request.priority_high');
    expect(['thema', 'status', 'priority'].map(k => filter(k).options.length)).toEqual([4, 4, 3]);
    expect(USER_REQUEST_THEMA_OPTIONS).toBe(USER_REQUEST_THEMA_VALUES);
    expect(USER_REQUEST_STATUS_OPTIONS).toBe(USER_REQUEST_STATUS_VALUES);
    expect(USER_REQUEST_PRIORITY_OPTIONS).toBe(USER_REQUEST_PRIORITY_VALUES);
  });

  /**
   * @description E-mail is required and checked; the phone is optional with a format check.
   * @input  contact_email / contact_phone patterns; required fields
   * @output 'a@b.cz' ok, 'a@b' rejected; '+420 123 456 789' ok, '12' rejected; required thema, contact_email, status, priority, order_description
   */
  it('validates the request form', () => {
    const email = new RegExp(`^${field('contact_email').pattern}$`);
    const phone = new RegExp(field('contact_phone').pattern);
    expect(email.test('a@b.cz')).toBeTrue();
    expect(email.test('a@b')).toBeFalse();
    expect(phone.test('+420 123 456 789')).toBeTrue();
    expect(phone.test('12')).toBeFalse();
    expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['thema', 'contact_email', 'status', 'priority', 'order_description']);
    expect(field('attachments').type).toBe('files');
  });

  /**
   * @description Theme, status and priority can be charted (count).
   * @input  graphColumns getter
   * @output thema, status, priority with their value lists
   */
  it('offers chartable columns', () => {
    expect(component.graphColumns).toEqual([
      { key: 'thema', label: 'user-request.details_thema', aggregation: 'count', possibleValues: USER_REQUEST_THEMA_VALUES },
      { key: 'status', label: 'user-request.details_status', aggregation: 'count', possibleValues: USER_REQUEST_STATUS_VALUES },
      { key: 'priority', label: 'user-request.details_priority', aggregation: 'count', possibleValues: USER_REQUEST_PRIORITY_VALUES }
    ]);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:user-request.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:user-request.table_header');
  });

  /**
   * @description Toolbar buttons without permission are hidden; create/export/import hidden in the trash.
   * @input  granted []; then all; then trash view with open filters
   * @output create / e-mail template / report / trash hidden without permission; trash view: create/export/import hidden, labels switched
   */
  it('builds the toolbar by permission and view', () => {
    ctx.permissions.granted = new Set();
    let t = toolbar();
    expect(['handleCreateFormOpened', 'openEmailTemplateEditor', 'openGraphBuilder', 'toggleTable'].map(a => t[a].showIf)).toEqual([false, false, false, false]);
    ctx.permissions.granted = 'all';
    t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeTrue();
    expect(t['openEmailTemplateEditor'].showIf).toBeTrue();
    expect(t['toggleTable'].label).toBe('user-request.toolbar_show_trash');
    expect(t['toggleFilters'].label).toBe('user-request.toolbar_filters');
    component.showTrashTable = true;
    component.isFilterVisible = true;
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable', 'triggerImport'].map(a => t[a].showIf)).toEqual([false, false, false]);
    expect(t['toggleTable'].label).toBe('user-request.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('user-request.toolbar_hide_filters');
  });

  /**
   * @description Toolbar actions call their handlers; import goes through the active table.
   * @input  handleToolbarAction(each action) with an activeTable spy; then without a table
   * @output handlers called once; importData() once; no error without a table or for unknown actions
   */
  it('dispatches the toolbar actions', () => {
    const names = ['toggleFilters', 'handleCreateFormOpened', 'exportActiveTable', 'openEmailTemplateEditor', 'openGraphBuilder', 'toggleTable'];
    const spies = names.map(n => spyOn(component as any, n));
    names.forEach(a => component.handleToolbarAction(a));
    spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
    const table = jasmine.createSpyObj('TableBuilderComponent', ['importData']);
    component.activeTable = table;
    component.handleToolbarAction('triggerImport');
    expect(table.importData).toHaveBeenCalledTimes(1);
    component.activeTable = undefined as any;
    expect(() => { component.handleToolbarAction('triggerImport'); component.handleToolbarAction('unknown'); }).not.toThrow();
  });

  /**
   * @description Requests of web/raw_request_commissions are loaded after the auth check; refresh keeps the filters.
   * @input  ngOnInit(); filters { status: 'new' }; refreshData()
   * @output getPaginatedData('web/raw_request_commissions', …) twice; refresh with status 'new'
   */
  it('loads the requests', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0])).toEqual(['web/raw_request_commissions', 'web/raw_request_commissions']);
    component.filters = { status: 'new' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ status: 'new' }));
    discardPeriodicTasks();
  }));

  /**
   * @description A request with id is updated, a new one created; each shows its message and reloads.
   * @input  handleFormSubmitted({ id: 2, status: 'done' }), then ({ thema: 'other' })
   * @output put('web/raw_request_commissions/2', …) + 'user-request.crud_updated_message'; post(…) + 'user-request.crud_created_message'; form closed
   */
  it('updates and creates requests', () => {
    component.showCreateForm = true;
    component.handleFormSubmitted({ id: 2, status: 'done' });
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/raw_request_commissions/2', { id: 2, status: 'done' });
    expect(ctx.alert.open).toHaveBeenCalledWith('user-request.crud_success_title', 'user-request.crud_updated_message', 'success');
    component.handleFormSubmitted({ thema: 'other' });
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('web/raw_request_commissions', { thema: 'other' });
    expect(ctx.alert.open).toHaveBeenCalledWith('user-request.crud_success_title', 'user-request.crud_created_message', 'success');
    expect(component.showCreateForm).toBeFalse();
  });

  /**
   * @description The toolbar opens the shared template editor with the summary rows of the
   *   inquiry e-mail (sample values, date in the admin locale) and the subject suffix; closing
   *   hides it.
   * @input  openEmailTemplateEditor(); closeEmailTemplateEditor().
   * @output modal open; rows thema … date with samples; suffix ' – user-request.thema_new_project'; closed.
   */
  it('opens and closes the e-mail template editor', () => {
    component.openEmailTemplateEditor();
    expect(component.showEmailTemplateModal).toBeTrue();
    expect(component.emailTemplateRows.map(r => r.key)).toEqual(['label_thema', 'label_email', 'label_phone', 'label_description', 'label_attachments', 'label_date']);
    expect(component.emailTemplateRows[0].sample).toBe('user-request.thema_new_project');
    expect(component.emailTemplateRows[5].sample).toBe(new Date(2026, 7, 21, 15, 32).toLocaleString('cs-CZ',
      { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    expect(component.emailTemplateSubjectSuffix).toBe(' – user-request.thema_new_project');
    component.closeEmailTemplateEditor();
    expect(component.showEmailTemplateModal).toBeFalse();
  });

  /**
   * @description The page and the open template modal render.
   * @input  detectChanges(); then modal open with one language
   * @output text contains 'user-request.table_header'; the editor shows the preview subject default with the inquiry endpoint
   */
  it('renders the page and the template modal', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('user-request.table_header');
    answer(of([{ code: 'cz', name: 'Čeština' }]), of({}));
    component.openEmailTemplateEditor();
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('user-request.email_tpl_default_subject');
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('web/settings/raw-request-email-template');
    discardPeriodicTasks();
  }));
});
