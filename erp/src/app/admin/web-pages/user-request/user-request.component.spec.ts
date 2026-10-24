/**
 * @file user-request.component.spec.ts
 * @path src/app/admin/web-pages/user-request/user-request.component.spec.ts
 * @project RPSW Web
 * @author RPSW
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
import { Subject, of, throwError } from 'rxjs';

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

  describe('e-mail template editor', () => {
    const template = {
      raw_request_email_subject_i18n: { cz: 'Předmět', en: 'Subject' },
      raw_request_email_title_i18n: { cz: 'Titulek' },
      raw_request_email_intro_i18n: { cz: 'Úvod' },
      raw_request_email_outro_i18n: { cz: 'Závěr' },
      raw_request_email_labels_i18n: { cz: { greeting: 'Dobrý den', summary_header: 'Shrnutí', label_thema: 'Téma', label_email: 'E-mail',
        label_phone: 'Telefon', label_description: 'Popis', label_attachments: 'Přílohy', label_date: 'Datum' } }
    };

    /**
     * @description Opening loads the active web languages and the saved template.
     * @input  languages cz, en, de (inactive); saved template; openEmailTemplateEditor()
     * @output modal open; languages ['cz', 'en']; template texts loaded; labels of the current language present (others are prepared on switch); loading false
     */
    it('loads the languages and the saved template', () => {
      answer(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }]), of(template));
      component.openEmailTemplateEditor();
      expect(component.showEmailTemplateModal).toBeTrue();
      expect(component.emailTemplateLanguages.map(l => l.code)).toEqual(['cz', 'en']);
      expect(component.emailTemplate.subject_i18n).toEqual({ cz: 'Předmět', en: 'Subject' });
      expect(component.emailTemplate.labels_i18n['cz']!.greeting).toBe('Dobrý den');
      expect(component.emailTemplateLoading).toBeFalse();
    });

    /**
     * @description The preview shows the saved texts of the current language.
     * @input  saved template, current language cz
     * @output previewSubject 'Předmět' … previewLabelDate 'Datum'
     */
    it('previews the saved texts of the current language', () => {
      answer(of([{ code: 'cz', name: 'Čeština' }]), of(template));
      component.openEmailTemplateEditor();
      expect([component.previewSubject, component.previewTitle, component.previewIntro, component.previewOutro]).toEqual(['Předmět', 'Titulek', 'Úvod', 'Závěr']);
      expect([component.previewGreeting, component.previewSummaryHeader, component.previewLabelThema, component.previewLabelEmail,
        component.previewLabelPhone, component.previewLabelDescription, component.previewLabelAttachments, component.previewLabelDate])
        .toEqual(['Dobrý den', 'Shrnutí', 'Téma', 'E-mail', 'Telefon', 'Popis', 'Přílohy', 'Datum']);
    });

    /**
     * @description Empty texts fall back to the translated defaults (also before anything is loaded).
     * @input  no template loaded; then switchEmailTemplateLang('en') with only an English subject
     * @output previewTitle 'user-request.email_tpl_default_title', previewGreeting '…default_greeting', previewLabelDate '…default_label_date'; en subject 'Subject'
     */
    it('falls back to the translated defaults', () => {
      expect(component.previewSubject).toBe('user-request.email_tpl_default_subject');
      expect(component.previewGreeting).toBe('user-request.email_tpl_default_greeting');
      answer(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English' }]), of(template));
      component.openEmailTemplateEditor();
      component.switchEmailTemplateLang('en');
      expect(component.emailTemplateCurrentLang).toBe('en');
      expect(component.previewSubject).toBe('Subject');
      expect(component.previewTitle).toBe('user-request.email_tpl_default_title');
      expect(component.previewIntro).toBe('user-request.email_tpl_default_intro');
      expect(component.previewOutro).toBe('user-request.email_tpl_default_outro');
      expect([component.previewSummaryHeader, component.previewLabelThema, component.previewLabelEmail, component.previewLabelPhone,
        component.previewLabelDescription, component.previewLabelAttachments, component.previewLabelDate]).toEqual([
        'user-request.email_tpl_default_summary_header', 'user-request.email_tpl_default_label_thema', 'user-request.email_tpl_default_label_email',
        'user-request.email_tpl_default_label_phone', 'user-request.email_tpl_default_label_description',
        'user-request.email_tpl_default_label_attachments', 'user-request.email_tpl_default_label_date']);
      component.switchEmailTemplateLang('sk');
      expect(component.emailTemplate.labels_i18n['sk']).toEqual({});
    });

    /**
     * @description When the current language is not offered the first available one is selected.
     * @input  languages en, de only; openEmailTemplateEditor()
     * @output emailTemplateCurrentLang 'en'
     */
    it('switches to the first language when Czech is not offered', () => {
      answer(of([{ code: 'en', name: 'English' }, { code: 'de', name: 'Deutsch' }]), of(null));
      component.openEmailTemplateEditor();
      expect(component.emailTemplateCurrentLang).toBe('en');
      expect(component.emailTemplate).toEqual({ subject_i18n: {}, title_i18n: {}, intro_i18n: {}, outro_i18n: {}, labels_i18n: { en: {} } });
    });

    /**
     * @description Missing or failed language data: Czech only; an empty list keeps the current language.
     * @input  languages request fails; then response without languages; template request fails
     * @output languages [{ cz }] after the error; [] for an empty answer with current language kept 'cz'; loading false
     */
    it('falls back to Czech when the languages cannot be loaded', () => {
      answer(throwError(() => new Error('x')), throwError(() => new Error('x')));
      component.openEmailTemplateEditor();
      expect(component.emailTemplateLanguages).toEqual([{ code: 'cz', name: 'Čeština' }]);
      expect(component.emailTemplateLoading).toBeFalse();
      answer(of(null), of({}));
      component.openEmailTemplateEditor();
      expect(component.emailTemplateLanguages).toEqual([]);
      expect(component.emailTemplateCurrentLang).toBe('cz');
    });

    /**
     * @description Saving sends all per-language texts and closes the modal; a running save blocks closing and a second save.
     * @input  template loaded; saveEmailTemplate() while the PUT is pending → close / save again; then the PUT succeeds
     * @output one put('web/settings/raw-request-email-template', { raw_request_email_*_i18n }); modal still open while saving; closed with success alert
     */
    it('saves the template', () => {
      answer(of([{ code: 'cz', name: 'Čeština' }]), of(template));
      component.openEmailTemplateEditor();
      const response$ = new Subject<any>();
      (ctx.dataHandler as any).put.and.returnValue(response$);
      component.saveEmailTemplate();
      component.saveEmailTemplate();
      component.closeEmailTemplateEditor();
      expect(component.showEmailTemplateModal).toBeTrue();
      expect((ctx.dataHandler as any).put).toHaveBeenCalledTimes(1);
      expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/settings/raw-request-email-template', {
        raw_request_email_subject_i18n: template.raw_request_email_subject_i18n,
        raw_request_email_title_i18n: template.raw_request_email_title_i18n,
        raw_request_email_intro_i18n: template.raw_request_email_intro_i18n,
        raw_request_email_outro_i18n: template.raw_request_email_outro_i18n,
        raw_request_email_labels_i18n: template.raw_request_email_labels_i18n
      });
      response$.next({});
      response$.complete();
      expect(component.showEmailTemplateModal).toBeFalse();
      expect(component.emailTemplateSaving).toBeFalse();
      expect(ctx.alert.open).toHaveBeenCalledWith('user-request.email_tpl_saved_title', 'user-request.email_tpl_saved_message', 'success');
    });

    /**
     * @description A failed save keeps the modal open; closing works when not saving.
     * @input  put fails; saveEmailTemplate(); closeEmailTemplateEditor()
     * @output still open after the failure, saving false; closed afterwards
     */
    it('keeps the modal open when saving fails', () => {
      component.showEmailTemplateModal = true;
      (ctx.dataHandler as any).put.and.returnValue(throwError(() => new Error('x')));
      component.saveEmailTemplate();
      expect(component.emailTemplateSaving).toBeFalse();
      expect(component.showEmailTemplateModal).toBeTrue();
      component.closeEmailTemplateEditor();
      expect(component.showEmailTemplateModal).toBeFalse();
    });

    /**
     * @description The preview uses a sample request with a date in the admin locale.
     * @input  emailTemplatePreviewSample
     * @output thema 'user-request.thema_new_project'; attachments ['brief.pdf', 'logo.png']; date formatted with getDateLocale() (cs-CZ)
     */
    it('builds the preview sample', () => {
      const sample = component.emailTemplatePreviewSample;
      expect(sample.thema).toBe('user-request.thema_new_project');
      expect(sample.attachments).toEqual(['brief.pdf', 'logo.png']);
      expect(sample.description).toBe('user-request.email_tpl_preview_description');
      expect(sample.date).toBe(new Date(2026, 7, 21, 15, 32).toLocaleString('cs-CZ',
        { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    });
  });

  /**
   * @description The page and the open template modal render.
   * @input  detectChanges(); then modal open with one language
   * @output text contains 'user-request.table_header'; modal shows the preview subject default
   */
  it('renders the page and the template modal', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('user-request.table_header');
    answer(of([{ code: 'cz', name: 'Čeština' }]), of({}));
    component.openEmailTemplateEditor();
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('user-request.email_tpl_default_subject');
    discardPeriodicTasks();
  }));
});
