/**
 * @file email-template-editor.component.spec.ts
 * @path src/app/admin/components/email-template-editor/email-template-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of EmailTemplateEditorComponent (shared confirmation e-mail editor of
 *   the inquiries and the orders): loading of the languages and the stored texts (by the field
 *   prefix), the preview with the fallback to the defaults of the section, language switch,
 *   saving and closing; empty fields of the shown language marked orange, their number on the
 *   language tabs and the hint; texts of a language stored as an empty array are saved.
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
   * @description Loads the active languages and the texts of the prefix; the preview shows the
   *   stored texts of the shown language, the rows with their samples and the subject suffix;
   *   missing texts fall back to the defaults of the section.
   * @input  languages cz, en, de (inactive); stored texts.
   * @output languages cz/en; get(endpoint); preview subject/title/intro/outro, greeting, IČO;
   *   email label default; rendered rows + 'Předmět – X'.
   */
  it('loads and previews the template', () => {
    create(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }]), of(stored));
    expect(dh().get).toHaveBeenCalledWith('web/settings/sales-order-email-template');
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);
    expect(component.loading).toBeFalse();
    expect(['subject', 'title', 'intro', 'outro'].map(f => component.preview(f as any))).toEqual(['Předmět', 'Titulek', 'Úvod', 'Závěr']);
    expect([component.previewLabel('greeting'), component.previewLabel('summary_header'), component.previewLabel('label_ico')]).toEqual(['Dobrý den', 'Shrnutí', 'IČO']);
    expect(component.previewLabel('label_email')).toBe('sales-orders.email_tpl_default_label_email');
    expect(component.placeholderKey('label_email')).toBe('email_tpl_placeholder_email');

    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.email-tpl-preview-table tr').length).toBe(2);
    expect(el.querySelector('.email-tpl-preview-subject-value')!.textContent!.trim()).toBe('Předmět – X');
    expect(el.querySelectorAll('.email-tpl-lang-tabs .rbb-btn').length).toBe(2);
  });

  /**
   * @description Switching the language shows its texts (the Czech ones, then the defaults
   *   where empty - as the backend sends them) and prepares its labels; a missing current language selects the first offered one; failed answers
   *   keep Czech and end the loading.
   * @input  switchLang('en'), switchLang('sk'); languages en, de + null template; both requests fail.
   * @output en subject 'Subject', title 'Titulek' (Czech), greeting 'Dobrý den' (Czech), email
   *   label default - the placeholders the same (Czech / default); labels sk {}; currentLang 'en' and an empty template;
   *   languages [cz], loading false.
   */
  it('switches languages and survives missing data', () => {
    create(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English' }]), of(stored));
    component.switchLang('en');
    expect([component.currentLang, component.preview('subject'), component.preview('title')]).toEqual(['en', 'Subject', 'Titulek']);
    expect([component.previewLabel('greeting'), component.previewLabel('label_email')]).toEqual(['Dobrý den', 'sales-orders.email_tpl_default_label_email']);
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
   * @input  save() pending + save() + close(); success; failing save; close().
   * @output one put(endpoint, sales_order_email_*); closed once after success + alert; failure: no close; close → 2.
   */
  it('saves and closes', () => {
    create(of([{ code: 'cz', name: 'Čeština' }]), of(stored));
    const response$ = new Subject<any>();
    dh().put.and.returnValue(response$);
    component.save();
    component.save();
    component.close();
    expect(closed).toBe(0);
    expect(dh().put).toHaveBeenCalledOnceWith('web/settings/sales-order-email-template', {
      sales_order_email_subject_i18n: stored.sales_order_email_subject_i18n,
      sales_order_email_title_i18n: stored.sales_order_email_title_i18n,
      sales_order_email_intro_i18n: stored.sales_order_email_intro_i18n,
      sales_order_email_outro_i18n: stored.sales_order_email_outro_i18n,
      sales_order_email_labels_i18n: stored.sales_order_email_labels_i18n,
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
   * @description Empty fields: every field empty in the shown language gets the orange class, the
   *   hint is shown and each language tab carries its number of empty fields; filling a field
   *   removes its mark; a language with everything filled has no hint.
   * @input languages cz, en; stored texts (cz: all but label_email; en: subject only).
   * @output cz: 1 missing (label_email), 1 marked input, hint 'email-template-editor.missing_hint';
   *   en: 7 missing; after filling label_email in cz: 0, no mark, no hint.
   */
  it('marks the empty fields of a language', () => {
    create(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English' }]), of(JSON.parse(JSON.stringify(stored))));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(component.missingCount('cz')).toBe(1);
    expect(component.missingCount('en')).toBe(7);
    expect(el.querySelectorAll('.email-tpl-input--missing').length).toBe(1);
    expect(el.querySelector('.email-tpl-missing-hint')!.textContent!.trim()).toBe('email-template-editor.missing_hint');
    expect(component.langItems.map(i => i.count)).toEqual([1, 7]);
    expect(component.isFilled('  ')).toBeFalse();

    component.template.labels_i18n['cz']['label_email'] = 'E-mail';
    (component as any).cd.markForCheck(); // OnPush - typing into the field marks it in the app
    fixture.detectChanges();
    expect(component.missingCount('cz')).toBe(0);
    expect(el.querySelectorAll('.email-tpl-input--missing').length).toBe(0);
    expect(el.querySelector('.email-tpl-missing-hint')).toBeNull();
  });

  /**
   * @description A language saved without any text comes back from the API as an empty JSON
   *   array (an empty PHP array); texts typed into it must reach the request body (regression:
   *   the save reported success and stored nothing).
   * @input stored subject `[]`, labels { cz: {greeting}, en: [] }; en subject + greeting typed; save().
   * @output the JSON body of the PUT carries subject.en and labels.en.greeting, cz kept.
   */
  it('saves the texts of a language stored as an empty array', () => {
    create(of([{ code: 'cz', name: 'Čeština' }, { code: 'en', name: 'English' }]),
      of({ sales_order_email_subject_i18n: [], sales_order_email_labels_i18n: { cz: { greeting: 'Dobrý den' }, en: [] } }));
    dh().put.and.returnValue(of({}));
    component.switchLang('en');
    component.template.subject_i18n['en'] = 'Thank you';
    component.template.labels_i18n['en']['greeting'] = 'Hello';
    component.save();

    const body = JSON.parse(JSON.stringify(dh().put.calls.mostRecent().args[1]));
    expect(body.sales_order_email_subject_i18n).toEqual({ en: 'Thank you' });
    expect(body.sales_order_email_labels_i18n).toEqual({ cz: { greeting: 'Dobrý den' }, en: { greeting: 'Hello' } });
  });
});
