/**
 * @file email-template-editor.component.spec.ts
 * @path src/app/admin/components/email-template-editor/email-template-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of EmailTemplateEditorComponent (shared confirmation e-mail editor of
 *   the inquiries and the orders): loading of the languages and the stored texts (by the field
 *   prefix), the preview with the fallback to Czech (the default language) and 'Cannot load
 *   text', language switch, saving and closing - not with an incomplete Czech; empty fields of the
 *   shown language marked orange, their number on the language tabs, the hint / the Czech
 *   banner; texts of a language stored as an empty array are saved.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, i18n stub returning `section.key`, alert spy).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { EmailTemplateEditorComponent } from './email-template-editor.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('EmailTemplateEditorComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<EmailTemplateEditorComponent>;
  let component: EmailTemplateEditorComponent;
  let closed: number;

  const stored = {
    sales_order_email_subject_i18n: { cz: 'Předmět', en: 'Subject' },
    sales_order_email_title_i18n: { cz: 'Titulek' },
    sales_order_email_intro_i18n: { cz: 'Úvod' },
    sales_order_email_outro_i18n: { cz: 'Závěr' },
    sales_order_email_labels_i18n: { cz: { greeting: 'Dobrý den', summary_header: 'Shrnutí', label_ico: 'IČO' } }
  };
  /** `stored` with every Czech text (label_email too) - the only state that can be saved. */
  const complete = () => {
    const texts = JSON.parse(JSON.stringify(stored));
    texts.sales_order_email_labels_i18n.cz.label_email = 'E-mail';
    return texts;
  };
  const dh = () => ctx.dataHandler as any;

  /** Creates the editor; `languages` / `template` are the GET answers. */
  function create(languages: any, template: any): void {
    ctx = createAdminTestContext();
    dh().get.and.callFake((url: string) => url === 'languages/web' ? languages : template);
    TestBed.configureTestingModule({ imports: [EmailTemplateEditorComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(EmailTemplateEditorComponent);
    component = fixture.componentInstance;
    component.endpoint = 'web/settings/sales-order-email-template';
    component.fieldPrefix = 'sales_order_email';
    component.i18nSection = 'sales-orders';
    component.rows = [{ key: 'label_ico', sample: '123' }, { key: 'label_email', sample: 'a@b.cz' }];
    component.subjectSuffix = ' – X';
    closed = 0;
    component.closed.subscribe(() => closed++);
    fixture.detectChanges();
  }

  /**
   * @description Loads the languages (a switched off one too - muted tab, the e-mail is prepared
   *   before the language is switched on) and the texts of the prefix; the preview shows the
   *   stored texts of the shown language, the rows with their samples and the subject suffix;
   *   a text empty in Czech too is 'Cannot load text' (never another wording).
   * @input  languages cz, en, de (inactive); stored texts (no Czech label_email).
   * @output languages cz/en/de (de muted); get(endpoint); preview subject/title/intro/outro, greeting, IČO;
   *   email label 'Cannot load text'; rendered rows + 'Předmět – X'.
   */
  it('loads and previews the template', () => {
    create(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }]), of(stored));
    expect(dh().get).toHaveBeenCalledWith('web/settings/sales-order-email-template');
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en', 'de']);
    expect(component.langItems.map(item => !!item.muted)).toEqual([false, false, true]);
    expect(component.loading).toBeFalse();
    expect(['subject', 'title', 'intro', 'outro'].map(f => component.preview(f as any))).toEqual(['Předmět', 'Titulek', 'Úvod', 'Závěr']);
    expect([component.previewLabel('greeting'), component.previewLabel('summary_header'), component.previewLabel('label_ico')]).toEqual(['Dobrý den', 'Shrnutí', 'IČO']);
    expect(component.previewLabel('label_email')).toBe('Cannot load text');
    expect(component.placeholderKey('label_email')).toBe('email_tpl_placeholder_email');

    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.email-tpl-preview-table tr').length).toBe(2);
    expect(el.querySelector('.email-tpl-preview-subject-value')!.textContent!.trim()).toBe('Předmět – X');
    expect(el.querySelectorAll('.email-tpl-lang-tabs .rbb-btn').length).toBe(3);
    expect(el.querySelectorAll('.email-tpl-lang-tabs .rbb-btn--muted').length).toBe(1);
  });

  /**
   * @description Switching the language shows its texts (the Czech ones where empty - as the
   *   backend sends them) and prepares its labels; a missing current language selects the first
   *   offered one; failed answers keep Czech and end the loading.
   * @input  switchLang('en'), switchLang('sk'); languages en, de + null template; both requests fail.
   * @output en subject 'Subject', title 'Titulek' (Czech), greeting 'Dobrý den' (Czech), email
   *   label 'Cannot load text' - the placeholders Czech / the example wording; labels sk {};
   *   currentLang 'en' and an empty template; languages [cz], loading false.
   */
  it('switches languages and survives missing data', () => {
    create(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English' }]), of(stored));
    component.switchLang('en');
    expect([component.currentLang, component.preview('subject'), component.preview('title')]).toEqual(['en', 'Subject', 'Titulek']);
    expect([component.previewLabel('greeting'), component.previewLabel('label_email')]).toEqual(['Dobrý den', 'Cannot load text']);
    expect([component.textPlaceholder('title'), component.labelPlaceholder('greeting'), component.labelPlaceholder('label_email')])
      .toEqual(['Titulek', 'Dobrý den', 'sales-orders.email_tpl_placeholder_email']);
    component.switchLang('sk');
    expect(component.template.labels_i18n['sk']).toEqual({});

    TestBed.resetTestingModule();
    create(of([{ code: 'en', name: 'English' }, { code: 'de', name: 'Deutsch' }]), of(null));
    expect(component.currentLang).toBe('en');
    expect(component.template).toEqual({ subject_i18n: {}, title_i18n: {}, intro_i18n: {}, outro_i18n: {}, labels_i18n: { en: {} } });

    TestBed.resetTestingModule();
    create(throwError(() => new Error('x')), throwError(() => new Error('x')));
    expect(component.languages).toEqual([{ code: 'cz', name: 'Čeština' }]);
    expect(component.loading).toBeFalse();

    TestBed.resetTestingModule();
    create(of(null), of({}));
    expect(component.languages).toEqual([]);
    expect(component.currentLang).toBe('cz');
  });

  /**
   * @description Save sends every field of the prefix once, closes and confirms; while saving
   *   neither a second save nor closing happens; a failure keeps the modal; close emits.
   * @input  complete Czech texts; save() pending + save() + close(); success; failing save; close().
   * @output canSave; one put(endpoint, sales_order_email_*); closed once after success + alert;
   *   failure: no close; close → 2.
   */
  it('saves and closes', () => {
    const texts = complete();
    create(of([{ code: 'cz', name: 'Čeština' }]), of(texts));
    expect(component.canSave).toBeTrue();
    const response$ = new Subject<any>();
    dh().put.and.returnValue(response$);
    component.save();
    component.save();
    component.close();
    expect(closed).toBe(0);
    expect(dh().put).toHaveBeenCalledOnceWith('web/settings/sales-order-email-template', {
      sales_order_email_subject_i18n: texts.sales_order_email_subject_i18n,
      sales_order_email_title_i18n: texts.sales_order_email_title_i18n,
      sales_order_email_intro_i18n: texts.sales_order_email_intro_i18n,
      sales_order_email_outro_i18n: texts.sales_order_email_outro_i18n,
      sales_order_email_labels_i18n: texts.sales_order_email_labels_i18n,
    });
    response$.next({});
    response$.complete();
    expect(closed).toBe(1);
    expect(component.saving).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('sales-orders.email_tpl_saved_title', 'sales-orders.email_tpl_saved_message', 'success');

    dh().put.and.returnValue(throwError(() => new Error('x')));
    component.save();
    expect([closed, component.saving]).toEqual([1, false]);
    component.close();
    expect(closed).toBe(2);
  });

  /**
   * @description Another language list (the e-shop) and labels that are texts of their own: a
   *   multiline row is a full-width textarea, a row without a sample is a paragraph of the
   *   preview (not a table row).
   * @input  languagesEndpoint 'languages/shop' (cz, en); rows label_ico (sample) + withdrawal_info
   *   (multiline, no sample) with a cz text.
   * @output get('languages/shop'); 1 table row; withdrawal paragraph with the cz text; a textarea
   *   in a wide field.
   */
  it('offers other languages and labels that are texts of their own', () => {
    ctx = createAdminTestContext();
    dh().get.and.callFake((url: string) => url === 'languages/shop' ? of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English' }])
      : of({ order_email_labels_i18n: { cz: { withdrawal_info: 'Odstoupení do 14 dnů.' } } }));
    TestBed.configureTestingModule({ imports: [EmailTemplateEditorComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(EmailTemplateEditorComponent);
    component = fixture.componentInstance;
    Object.assign(component, { endpoint: 'shop/settings/order-email-template', fieldPrefix: 'order_email', i18nSection: 'shop-orders', languagesEndpoint: 'languages/shop' });
    component.rows = [{ key: 'label_ico', sample: '123' }, { key: 'withdrawal_info', sample: '', multiline: true }];
    fixture.detectChanges();

    expect(dh().get).toHaveBeenCalledWith('languages/shop');
    expect(dh().get).not.toHaveBeenCalledWith('languages/web');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.email-tpl-preview-table tr').length).toBe(1);
    expect(Array.from(el.querySelectorAll('.email-tpl-preview-text')).map(p => p.textContent!.trim())).toContain('Odstoupení do 14 dnů.');
    expect(el.querySelector('.email-tpl-field--wide textarea')).not.toBeNull();
  });

  /**
   * @description Texts of another e-mail sharing the template (`preview: false`) are edited but
   *   not shown in the preview; `section` puts a full-width heading before its row.
   * @input  rows label_ico (sample), reminder_subject (no sample, preview false, section
   *   'email_tpl_section_unpaid'), label_pay_by (sample, preview false).
   * @output 3 fields; 1 table row; no reminder paragraph (only greeting, intro, outro); heading
   *   'shop-orders.email_tpl_section_unpaid'.
   */
  it('edits texts of another e-mail outside the preview', () => {
    ctx = createAdminTestContext();
    dh().get.and.callFake((url: string) => url === 'languages/web' ? of([{ code: 'cz', name: 'Čeština' }]) : of({}));
    TestBed.configureTestingModule({ imports: [EmailTemplateEditorComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(EmailTemplateEditorComponent);
    component = fixture.componentInstance;
    Object.assign(component, { endpoint: 'shop/settings/order-email-template', fieldPrefix: 'order_email', i18nSection: 'shop-orders' });
    component.rows = [
      { key: 'label_ico', sample: '123' },
      { key: 'reminder_subject', sample: '', preview: false, section: 'email_tpl_section_unpaid' },
      { key: 'label_pay_by', sample: '13.11.2026', preview: false },
    ];
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.email-tpl-labels-grid .email-tpl-field').length).toBe(3);
    expect(el.querySelectorAll('.email-tpl-preview-table tr').length).toBe(1);
    // greeting, intro, outro (nothing stored - 'Cannot load text'); no paragraph of the reminder
    expect(Array.from(el.querySelectorAll('.email-tpl-preview-text')).map(p => p.textContent!.trim()))
      .toEqual(['Cannot load text', 'Cannot load text', 'Cannot load text']);
    expect(el.querySelector('.email-tpl-labels-grid-heading')!.textContent!.trim()).toBe('shop-orders.email_tpl_section_unpaid');
  });
  /**
   * @description Empty fields: every field empty in the shown language gets the orange class and
   *   each language tab carries its number of empty fields. An incomplete Czech (the default
   *   language) blocks the save with a banner in every tab - in another tab with a button back to
   *   Czech; another language gets the orange hint (its empty fields use the Czech text).
   * @input languages cz, en; stored texts (cz: all but label_email; en: subject only); save();
   *   switch to en; the banner button; fill label_email in cz.
   * @output cz: 1 missing, 1 marked input, banner 'email-template-editor.primary_missing' without
   *   a button, no hint, save disabled with a title, save() sends nothing; en: 7 missing, hint +
   *   banner with the button → back to cz; after filling: 0, no mark, no banner, save enabled.
   */
  it('marks the empty fields and needs the whole Czech', () => {
    create(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English' }]), of(JSON.parse(JSON.stringify(stored))));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const saveButton = () => el.querySelector('.am-btn--primary') as HTMLButtonElement;
    expect(component.missingCount('cz')).toBe(1);
    expect(component.missingCount('en')).toBe(7);
    expect(el.querySelectorAll('.email-tpl-input--missing').length).toBe(1);
    expect(el.querySelector('.email-tpl-primary-error span')!.textContent!.trim()).toBe('email-template-editor.primary_missing');
    expect(el.querySelector('.email-tpl-primary-btn')).toBeNull();
    expect(el.querySelector('.email-tpl-missing-hint')).toBeNull();
    expect(component.langItems.map(i => i.count)).toEqual([1, 7]);
    expect(component.isFilled('  ')).toBeFalse();
    expect([component.canSave, saveButton().disabled, saveButton().title]).toEqual([false, true, 'email-template-editor.save_blocked_title']);
    component.save();
    expect(dh().put).not.toHaveBeenCalled();

    component.switchLang('en');
    fixture.detectChanges();
    expect(el.querySelector('.email-tpl-missing-hint')!.textContent!.trim()).toBe('email-template-editor.missing_hint');
    (el.querySelector('.email-tpl-primary-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.currentLang).toBe('cz');

    component.template.labels_i18n['cz']['label_email'] = 'E-mail';
    (component as any).cd.markForCheck(); // OnPush - typing into the field marks it in the app
    fixture.detectChanges();
    expect(component.missingCount('cz')).toBe(0);
    expect(el.querySelectorAll('.email-tpl-input--missing').length).toBe(0);
    expect(el.querySelector('.email-tpl-primary-error')).toBeNull();
    expect([component.canSave, saveButton().disabled]).toEqual([true, false]);
  });

  /**
   * @description A language saved without any text comes back from the API as an empty JSON
   *   array (an empty PHP array); texts typed into it must reach the request body (regression:
   *   the save reported success and stored nothing).
   * @input stored subject `[]`, the other Czech texts complete, labels { cz: complete, en: [] };
   *   cz subject, en subject + greeting typed; save().
   * @output the JSON body of the PUT carries subject cz / en and labels.en.greeting, cz kept.
   */
  it('saves the texts of a language stored as an empty array', () => {
    const texts = complete();
    texts.sales_order_email_subject_i18n = [];
    texts.sales_order_email_labels_i18n.en = [];
    create(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English' }]), of(texts));
    dh().put.and.returnValue(of({}));
    component.template.subject_i18n['cz'] = 'Předmět';
    component.switchLang('en');
    component.template.subject_i18n['en'] = 'Thank you';
    component.template.labels_i18n['en']['greeting'] = 'Hello';
    component.save();

    const body = JSON.parse(JSON.stringify(dh().put.calls.mostRecent().args[1]));
    expect(body.sales_order_email_subject_i18n).toEqual({ cz: 'Předmět', en: 'Thank you' });
    expect(body.sales_order_email_labels_i18n).toEqual({ cz: complete().sales_order_email_labels_i18n.cz, en: { greeting: 'Hello' } });
  });

  /**
   * @description The editor opens in the language it is given (window Jazyky → the e-mail of a
   *   language); a language not offered falls back to the first one.
   * @input initialLang 'en' (offered); then 'sk' (not offered).
   * @output currentLang 'en'; then 'cz'.
   */
  it('opens in the given language', () => {
    ctx = createAdminTestContext();
    dh().get.and.callFake((url: string) => url === 'languages/web' ? of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English' }]) : of(stored));
    TestBed.configureTestingModule({ imports: [EmailTemplateEditorComponent], providers: ctx.providers });
    for (const [lang, expected] of [['en', 'en'], ['sk', 'cz']]) {
      fixture = TestBed.createComponent(EmailTemplateEditorComponent);
      component = fixture.componentInstance;
      Object.assign(component, { endpoint: 'x', fieldPrefix: 'sales_order_email', i18nSection: 'sales-orders', initialLang: lang });
      fixture.detectChanges();
      expect(component.currentLang).toBe(expected);
      fixture.destroy();
    }
  });

  /**
   * @description The hint of the empty fields of a switched off language says "fill in before
   *   switching it on" (customers do not see the language).
   * @input languages cz, en (on), de (off); switch to en, then de.
   * @output missingHint missing_hint; then missing_hint_inactive.
   */
  it('words the hint of a switched off language', () => {
    create(of([{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }]), of(stored));
    component.switchLang('en');
    expect(component.missingHint).toBe('email-template-editor.missing_hint');
    component.switchLang('de');
    expect(component.missingHint).toBe('email-template-editor.missing_hint_inactive');
  });
});
