/**
 * @file user-request.component.spec.ts
 * @path src/app/apps/web/admin/user-request/user-request.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of UserRequestComponent and user-request.config.ts – requests sent
 *   from the public contact form: translated configuration, theme / status / priority options,
 *   form validation, chartable columns, toolbar by permission and view, toolbar actions, create /
 *   update, the e-mail template editor (languages, loading, per-language texts with
 *   translated defaults in the preview, saving) and the record popup of the clickable rows
 *   (?record=ID, edit + detail in one, actions, Back, save, delete).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks, flush } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ActivatedRoute, Router, convertToParamMap, ParamMap } from '@angular/router';
import { Location } from '@angular/common';

import { UserRequestComponent } from './user-request.component';
import { USER_REQUEST_PRIORITY_VALUES, USER_REQUEST_STATUS_VALUES, USER_REQUEST_THEMA_VALUES } from './user-request.config';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';
import { AdminNotificationsService } from '../../../../core/services/admin-notifications.service';

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
   * @description Theme, status and priority options with translated labels.
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
   * @output text contains 'user-request.table_header'; the editor (inquiry endpoint) shows the
   *   preview - nothing stored: 'Cannot load text' and the Czech banner
   */
  it('renders the page and the template modal', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('user-request.table_header');
    answer(of([{ code: 'cz', name: 'Čeština' }]), of({}));
    component.openEmailTemplateEditor();
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cannot load text');
    expect(fixture.nativeElement.querySelector('.email-tpl-primary-error')).not.toBeNull();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('web/settings/raw-request-email-template');
    discardPeriodicTasks();
  }));

  /**
   * @description The e-mail item of the Actions menu carries the dot of the attention kind of the
   *   notifications (the same as the side menu): orange while Czech or an active language lacks
   *   texts, grey when only a switched off one does; closing the editor asks the counts again.
   * @input kind web_inquiry_email_missing 2; then 0 + preparing pl 12; then none; close the editor.
   * @output attention true, tone 'attention', title attention_title; tone 'preparing', title
   *   attention_preparing_title; no dot; notifications refresh called.
   */
  it('marks the e-mail item while the template lacks texts', () => {
    const notifications = TestBed.inject(AdminNotificationsService);
    const set = (count: number, preparing?: Record<string, number>) => notifications.kinds.set([
      { kind: 'web_inquiry_email_missing', module: 'web', link: '/admin/web/user-request', count, attention: true, preparing },
    ]);
    const item = () => toolbar()['openEmailTemplateEditor'];
    set(2);
    expect([item().attention, item().attentionTone, item().attentionTitle]).toEqual([true, 'attention', 'email-template-editor.attention_title']);
    set(0, { pl: 12 });
    expect([item().attentionTone, item().attentionTitle]).toEqual(['preparing', 'email-template-editor.attention_preparing_title']);
    notifications.kinds.set([]);
    expect(item().attention).toBeUndefined();

    const refresh = spyOn(notifications, 'refresh');
    component.closeEmailTemplateEditor();
    expect(refresh).toHaveBeenCalled();
  });

  /**
   * @description `?email-template=<lang>` (window Jazyky → the e-mail of a language) opens the
   *   editor in that language and removes the parameter; without the edit permission it is only
   *   removed.
   * @input query email-template=pl; ngOnInit; then granted [] and ngOnInit.
   * @output modal open, emailTemplateLang 'pl', navigate([], { queryParams: { 'email-template':
   *   null }, merge, replaceUrl }); then no modal.
   */
  it('opens the e-mail editor of a language from the address', () => {
    const route = TestBed.inject(ActivatedRoute) as any;
    route.snapshot = { queryParamMap: convertToParamMap({ 'email-template': 'pl' }) };
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.ngOnInit();
    expect([component.showEmailTemplateModal, component.emailTemplateLang]).toEqual([true, 'pl']);
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { 'email-template': null }, queryParamsHandling: 'merge', replaceUrl: true }));

    component.closeEmailTemplateEditor();
    expect(component.emailTemplateLang).toBeNull();
    ctx.permissions.granted = new Set();
    component.ngOnInit();
    expect(component.showEmailTemplateModal).toBeFalse();
  });

  describe('record popup (clickable rows)', () => {
    let query: BehaviorSubject<ParamMap>;
    let navigate: jasmine.Spy;
    let location: jasmine.SpyObj<Location>;
    const record = { id: 12, thema: 'support', contact_email: 'a@b.cz', status: 'new', priority: 'neutral', order_description: 'x', created_at: '2026-11-20T10:00:00Z' };

    /** Page with a controllable address (?record) and the API answering the record. */
    const setup = (permissions: string[] | 'all' = 'all') => {
      TestBed.resetTestingModule();
      ctx = createAdminTestContext();
      query = new BehaviorSubject(convertToParamMap({}));
      location = jasmine.createSpyObj<Location>('Location', ['back', 'path', 'subscribe']);
      TestBed.configureTestingModule({
        imports: [UserRequestComponent],
        providers: [...ctx.providers,
          { provide: ActivatedRoute, useValue: { queryParamMap: query, snapshot: { queryParamMap: convertToParamMap({}) } } },
          { provide: Location, useValue: location }],
      });
      ctx.permissions.granted = permissions === 'all' ? 'all' : new Set(permissions);
      (ctx.dataHandler as any).getOne.and.callFake((url: string) => url.endsWith('/404') ? throwError(() => new Error('404')) : of({ ...record, id: Number(url.split('/').pop()) }));
      fixture = TestBed.createComponent(UserRequestComponent);
      component = fixture.componentInstance;
      navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      fixture.detectChanges();
    };
    const openFromAddress = (id: string) => {
      query.next(convertToParamMap({ record: id }));
      (component as any).cd.markForCheck();
      fixture.detectChanges();
    };
    const detect = () => { (component as any).cd.markForCheck(); fixture.detectChanges(); };

    /**
     * @description The table rows open the record: a row click puts ?record=ID into the address
     *   (a new history entry); the address loads the record from the API (also a link / reload)
     *   and opens the edit form of the page in record mode - the read-only values above the
     *   form, Delete on the left of the footer; rebuilt buttons (texts loaded later) give new
     *   labels, otherwise the same array.
     * @input openRecord({ id: 12 }); query record=12; rebuilt buttons.
     * @output navigate([], { queryParams: { record: 12 }, merge }); getOne('web/raw_request_commissions/12');
     *   recordEditable; edit form open with the record, recordMode, actions [delete]; table with
     *   openOnRowClick and the main column thema; new action labels after the rebuild.
     */
    it('opens a row as the edit form of the record through the address', fakeAsync(() => {
      setup();
      component.openRecord({ id: 12 });
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { record: 12 }, queryParamsHandling: 'merge' }));
      openFromAddress('12');
      expect((ctx.dataHandler as any).getOne).toHaveBeenCalledWith('web/raw_request_commissions/12');
      expect(component.recordItem.id).toBe(12);
      expect(component.recordEditable).toBeTrue();
      expect(component.showCreateForm).toBeTrue();
      expect(component.selectedItemForEdit.id).toBe(12);
      expect(component.recordForm!.recordMode).toBeTrue();
      expect(component.recordActions.map(b => b.action)).toEqual(['delete']);
      expect(fixture.nativeElement.querySelector('app-form-builder app-record-actions')).not.toBeNull();
      expect(component.activeTable.openOnRowClick).toBeTrue();
      expect(component.activeTable.primaryColumnKey).toBe('thema');
      component.openRecord({});
      expect(navigate).toHaveBeenCalledTimes(1);

      const first = component.recordActions;
      expect(component.recordActions).toBe(first);
      component.buttons = component.buttons.map(b => ({ ...b, display_name: b.display_name + '!' }));
      detect();
      expect(component.recordActions).not.toBe(first);
      expect(component.recordActions[0].display_name).toBe('user-request.btn_delete!');
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Without the edit permission the record opens as the detail (with Delete only
     *   with the delete permission); a missing record only leaves the address.
     * @input permissions web-user-requests-view; record=12; then record=404.
     * @output recordEditable false, detail shown, no edit form, actions []; for 404 navigate with
     *   record null + replaceUrl.
     */
    it('opens the detail without the edit permission', fakeAsync(() => {
      setup(['web-user-requests-view']);
      openFromAddress('12');
      expect(component.recordEditable).toBeFalse();
      expect(component.showDetails).toBeTrue();
      expect(component.showCreateForm).toBeFalse();
      expect(component.recordActions).toEqual([]);
      openFromAddress('404');
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { record: null }, replaceUrl: true }));
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Closing: any closing of the popup (cancel, save) closes the record - a row click
     *   goes Back, a link only removes the parameter; Back (parameter gone) closes the popup; with
     *   unsaved changes Back asks and "keep editing" puts the parameter back.
     * @input row click + cancel; link + cancel; Back with a clean form; Back with a dirty form
     *   answered keep / discard.
     * @output location.back(); navigate record null replaceUrl; popup closed; confirm, navigate
     *   record 15 again and still open; then closed.
     */
    it('closes by Cancel or Back and guards unsaved changes', fakeAsync(() => {
      setup();
      component.openRecord({ id: 12 });
      openFromAddress('12');
      component.onCancelForm();
      detect();
      expect(location.back).toHaveBeenCalledTimes(1);
      expect(component.recordItem).toBeNull();

      openFromAddress('13');
      component.onCancelForm();
      detect();
      expect(location.back).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { record: null }, replaceUrl: true }));

      openFromAddress('14');
      query.next(convertToParamMap({}));
      detect();
      expect(component.recordItem).toBeNull();
      expect(component.showCreateForm).toBeFalse();

      openFromAddress('15');
      spyOnProperty(component.recordForm!, 'isDirty').and.returnValue(true);
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      query.next(convertToParamMap({}));
      flush();
      expect(ctx.confirm.open).toHaveBeenCalled();
      expect(component.recordItem.id).toBe(15);
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { record: 15 } }));
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      query.next(convertToParamMap({}));
      flush();
      detect();
      expect(component.recordItem).toBeNull();
      expect(component.showCreateForm).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Saving and actions: the save of the page closes the form and so the record; an
     *   action of the record runs the table action; a deleted record closes its popup (another
     *   deleted row does not).
     * @input handleFormSubmitted ok; onRecordAction('delete'); itemDeleted of row 99, then of 12.
     * @output put + closed record; table.handleAction(record, 'delete'); open after 99, closed after 12.
     */
    it('saves, runs the actions and closes after a delete', fakeAsync(() => {
      setup();
      openFromAddress('12');
      (ctx.dataHandler as any).put.and.returnValue(of({}));
      component.handleFormSubmitted({ id: 12, status: 'done' });
      detect();
      expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/raw_request_commissions/12', { id: 12, status: 'done' });
      expect(component.recordItem).toBeNull();

      openFromAddress('12');
      const action = spyOn(component.activeTable, 'handleAction');
      component.onRecordAction('delete');
      expect(action).toHaveBeenCalledWith(component.recordItem, 'delete');
      component.activeTable.itemDeleted.emit({ id: 99 });
      detect();
      expect(component.recordItem).not.toBeNull();
      component.activeTable.itemDeleted.emit({ id: 12 });
      detect();
      expect(component.showCreateForm).toBeFalse();
      expect(component.recordItem).toBeNull();
      component.onRecordAction('delete');
      expect(action).toHaveBeenCalledTimes(1);
      flush();
      discardPeriodicTasks();
    }));
  });
});
