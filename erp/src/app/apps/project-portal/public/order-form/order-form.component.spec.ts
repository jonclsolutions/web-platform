/**
 * @file order-form.component.spec.ts
 * @path src/app/apps/project-portal/public/order-form/order-form.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the order form of the project portal: link states (valid with the
 *   prefill of the lead, unknown, used, expired), the multipart submit with the lead token,
 *   attachments, language and invisible captcha, the error texts, the upload rules, the legal
 *   documents in a window and the contact line.
 * @dependencies
 * - createPublicPageContext (PublicDataService / TurnstileService stubs, upload rules stub);
 *   ProjectPortalLocalizationService stub (getValue returns the key); ActivatedRoute with the token.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { OrderFormComponent } from './order-form.component';
import { ProjectPortalLocalizationService, PROJECT_PORTAL_AVAILABLE_LANGUAGES } from '../project-portal-localization.service';
import { MultiFileUploadComponent } from '../../../../shared/components/multi-file-upload/multi-file-upload.component';
import { LegalDocumentDialogComponent } from '../../../../public/legal/legal-document-dialog/legal-document-dialog.component';
import { LegalDocsService } from '../../../../shared/services/legal-docs.service';
import { SKIP_ADMIN_AUTH } from '../../../../core/interceptors/skip-admin-auth';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('OrderFormComponent (project portal)', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<OrderFormComponent>;
  let component: OrderFormComponent;
  const lead = { subject_name: 'ACME', contact_person: null, contact_email: 'a@acme.cz', contact_phone: null };
  const el = () => fixture.nativeElement as HTMLElement;

  /** Completes the background captcha check and submits (the widget is reset after every refusal). */
  const solve = () => ctx.turnstile.render.calls.mostRecent().args[1]('captcha-token');
  const send = () => { solve(); component.onSubmit(); };
  const fill = () => component.orderForm.patchValue({ ico: '123', order_description: 'Website', dataProcessingAgreement: true, tosAgreement: true });

  /** Creates the page for the token; `leadReply` answers the prefill request. */
  function create(token: string, leadReply: any = of(lead), settings: any = { settings: { contact_email: 'info@x.cz', contact_phone: '+420 1' } }): void {
    ctx = createPublicPageContext({ settings });
    ctx.publicData.get.and.returnValue(leadReply);
    TestBed.configureTestingModule({
      imports: [OrderFormComponent],
      providers: [
        ...ctx.providers,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token }) } } },
        { provide: ProjectPortalLocalizationService, useValue: {
          translations$: new BehaviorSubject({}), availableLanguages: PROJECT_PORTAL_AVAILABLE_LANGUAGES,
          getValue: (k: string) => k, getCurrentLanguage: () => 'en', setLanguage: jasmine.createSpy('setLanguage'),
        } },
        { provide: LegalDocsService, useValue: { getDocument: jasmine.createSpy('getDocument').and.returnValue(of({ sections: [] })) } },
      ],
    });
    fixture = TestBed.createComponent(OrderFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description The token of the URL loads the lead without the admin session and prefills the
   *   form (person → company name fallback); 410 = used, 410 LINK_EXPIRED = expired, else unknown.
   * @input token 'abc' with lead; person 'Eva' + phone; 410; 410 LINK_EXPIRED; 404.
   * @output GET project-portal/public/sales-leads/abc (SKIP_ADMIN_AUTH); 'valid' + ACME / e-mail;
   *   'Eva' / '777'; 'used' with its title; 'expired'; 'invalid'.
   */
  it('resolves the order link', () => {
    create('abc');
    const [path, , , context] = ctx.publicData.get.calls.mostRecent().args;
    expect(path).toBe('project-portal/public/sales-leads/abc');
    expect(context.get(SKIP_ADMIN_AUTH)).toBeTrue();
    expect(component.linkState).toBe('valid');
    expect(component.orderForm.getRawValue()).toEqual(jasmine.objectContaining({ client_name: 'ACME', client_email: 'a@acme.cz', client_phone: '' }));
    expect(el().querySelector('form.of-form')).not.toBeNull();

    TestBed.resetTestingModule();
    create('abc', of({ ...lead, contact_person: 'Eva', subject_name: null, contact_phone: '777' }));
    expect([component.orderForm.value.client_name, component.orderForm.value.client_phone]).toEqual(['Eva', '777']);

    TestBed.resetTestingModule();
    create('used', throwError(() => ({ status: 410 })));
    expect(component.linkState).toBe('used');
    expect(el().querySelector('.of-title')!.textContent).toContain('order_link_used_title');
    expect(el().querySelector('form')).toBeNull();
    TestBed.resetTestingModule();
    create('old', throwError(() => ({ status: 410, error: { error_code: 'LINK_EXPIRED' } })));
    expect(component.linkState).toBe('expired');
    TestBed.resetTestingModule();
    create('bad', throwError(() => ({ status: 404 })));
    expect(component.linkState).toBe('invalid');
  });

  /**
   * @description Submit: an invalid form is not sent; a valid order is posted (without the admin
   *   session) with the fields, the lead token, the files, the language and the captcha token; then
   *   the thank-you state; a used / expired link on submit shows its state.
   * @input Empty description; filled form + 1 file; 410; 410 LINK_EXPIRED.
   * @output No post; post project-portal/public/sales-orders with ACME / 123 / abc / en / captcha /
   *   brief.pdf; isSubmitted + thank-you title; 'used'; 'expired'.
   */
  it('submits the order', () => {
    create('abc');
    component.orderForm.patchValue({ order_description: '' });
    send();
    expect(ctx.publicData.post).not.toHaveBeenCalled();

    fill();
    component.onFilesChanged([new File(['x'], 'brief.pdf')]);
    send();
    const [endpoint, fd, , context] = ctx.publicData.post.calls.mostRecent().args as [string, FormData, unknown, any];
    expect(endpoint).toBe('project-portal/public/sales-orders');
    expect(context.get(SKIP_ADMIN_AUTH)).toBeTrue();
    expect([fd.get('client_name'), fd.get('ico'), fd.get('lead_token'), fd.get('lang'), fd.get('captcha_token')]).toEqual(['ACME', '123', 'abc', 'en', 'captcha-token']);
    expect((fd.get('attachments[]') as File).name).toBe('brief.pdf');
    expect(component.isSubmitted).toBeTrue();
    expect(component.isLoading).toBeFalse();
    fixture.detectChanges();
    expect(el().querySelector('.of-title')!.textContent).toContain('order_thanks_title');

    TestBed.resetTestingModule();
    create('abc');
    fill();
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 410 })));
    send();
    expect(component.linkState).toBe('used');
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 410, error: { error_code: 'LINK_EXPIRED' } })));
    send();
    expect(component.linkState).toBe('expired');
  });

  /**
   * @description Refusals have their own texts and reset the captcha: captcha, quota of the
   *   address, too many requests, a refused attachment, any other error.
   * @input 422 captcha_required; 429 RECIPIENT_LIMIT; 429; 422 errors.attachments; 500.
   * @output order_error_captcha + reset('widget-1'); order_error_email_limit; order_error_too_many;
   *   order_error_attachment; order_error_submit.
   */
  it('reports the refusals of the order', async () => {
    create('abc');
    await fixture.whenStable();
    fill();
    const cases: [any, string][] = [
      [{ status: 422, error: { captcha_required: true } }, 'order_error_captcha'],
      [{ status: 429, error: { error_code: 'RECIPIENT_LIMIT' } }, 'order_error_email_limit'],
      [{ status: 429 }, 'order_error_too_many'],
      [{ status: 422, error: { errors: { attachments: ['Too large.'] } } }, 'order_error_attachment'],
      [{ status: 500 }, 'order_error_submit'],
    ];
    for (const [error, text] of cases) {
      ctx.publicData.post.and.returnValue(throwError(() => error));
      send();
      expect(component.errorMessage).toBe(text);
    }
    expect(ctx.turnstile.reset).toHaveBeenCalledWith('widget-1');
    fixture.detectChanges();
    expect(el().querySelector('.of-form-error')!.textContent).toContain('order_error_submit');
  });

  /**
   * @description The uploader gets the rules of the API (profile sales_order) and the texts of the
   *   portal.
   * @input rendered form
   * @output 10 files / 20 MB / 50 MB; docx allowed, svg not; limits hint key of the portal
   */
  it('passes the upload rules and texts to the uploader', () => {
    create('abc');
    const uploader = fixture.debugElement.query(By.directive(MultiFileUploadComponent)).componentInstance as MultiFileUploadComponent;
    expect([uploader.maxFiles, uploader.maxFileSizeMb, uploader.maxTotalSizeMb]).toEqual([10, 20, 50]);
    expect(uploader.allowedExtensions).toContain('docx');
    expect(uploader.allowedExtensions).not.toContain('svg');
    expect(component.uploaderTexts.limitsHint).toBe('order_upload_limits_hint');
  });

  /**
   * @description The links of the consents open the legal document in a window (privacy policy
   *   'gdpr', terms 'tos') in the language of the page; closing removes it.
   * @input click the privacy link; closed; click the terms link
   * @output dialog slug 'gdpr' lang 'en' heading 'order_gdpr_title'; none; slug 'tos'
   */
  it('opens the legal documents in a window', () => {
    create('abc');
    const links = el().querySelectorAll('button.of-link');
    (links[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    let dialog = fixture.debugElement.query(By.directive(LegalDocumentDialogComponent)).componentInstance as LegalDocumentDialogComponent;
    expect([dialog.slug, dialog.lang, dialog.heading]).toEqual(['gdpr', 'en', 'order_gdpr_title']);
    dialog.closed.emit();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(LegalDocumentDialogComponent))).toBeNull();
    (links[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    dialog = fixture.debugElement.query(By.directive(LegalDocumentDialogComponent)).componentInstance as LegalDocumentDialogComponent;
    expect(dialog.slug).toBe('tos');
  });

  /**
   * @description The contact of the supplier is shown under the card; without contact data nothing.
   * @input settings with e-mail + phone; settings without them
   * @output mailto:info@x.cz and tel:+420 1; no .of-contact
   */
  it('shows the contact of the supplier', () => {
    create('abc');
    expect(el().querySelector('.of-contact a[href="mailto:info@x.cz"]')).not.toBeNull();
    expect(el().querySelector('.of-contact a[href="tel:+420 1"]')).not.toBeNull();
    TestBed.resetTestingModule();
    create('abc', of(lead), { settings: {} });
    expect(el().querySelector('.of-contact')).toBeNull();
  });
});
