/**
 * @file contact.component.spec.ts
 * @path src/app/apps/web/public/contact/contact.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ContactComponent (contact / inquiry form): form validation, stats from the
 *   home texts, attachment texts for the uploader, the multipart submit (language, optional
 *   phone, attachments) with success, error and double-submit protection; the captcha (token
 *   required, sent, reset after a refusal, own texts of the guard refusals).
 * @dependencies
 * - createPublicPageContext (post spy); AlertDialogService spied (errors are shown in the app dialog).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { By } from '@angular/platform-browser';
import { ContactComponent } from './contact.component';
import { MultiFileUploadComponent } from '../../../../shared/components/multi-file-upload/multi-file-upload.component';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('ContactComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<ContactComponent>;
  let component: ContactComponent;
  const contact = {
    buttons: { send: 'Send', sending: 'Sending…' }, errors: { submit_error: 'Failed', submit_error_title: 'Not sent', too_many_requests: 'Slow down', captcha_failed: 'Robot?', captcha_load: 'No captcha', email_limit: 'Enough for this address' },
    attachment_uploader: { limits_hint: '(max. {max} souborů)', dropzone_label: 'Drop', error_max_files: 'Max {max}', total_label: 'Total' }
  };
  const home = { stats_projects_count: '50', stats_projects_text: 'Projects', stats_years_count: '5', stats_years_text: 'Years', stats_solutions_count: '9', stats_solutions_text: 'Solutions' };

  beforeEach(() => {
    ctx = createPublicPageContext({ translations: { contact, home }, settings: { settings: {} } });
    TestBed.configureTestingModule({ imports: [ContactComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(ContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const fill = (overrides: any = {}) => component.contactForm.setValue({ subject: 'Web', email: 'a@b.cz', phone: '', message: 'Hello there!', gdpr: true, ...overrides });
  /** Completes the background captcha check (`solve`) and submits - the widget is reset after every refused submission. */
  const solve = () => ctx.turnstile.render.calls.mostRecent().args[1]('captcha-token');
  const send = () => { solve(); component.onSubmit(); };

  /**
   * @description Stats and uploader texts come from the translations; button text follows the
   *   loading state ('...' without texts); the subject is preselected to 'new_project' (an empty
   *   one is invalid); fields report invalid only after touch.
   * @input Translations above; subject default, then ''; email 'x' touched.
   * @output 3 stats; uploader texts mapped (missing → undefined); 'Send'; subject 'new_project' (valid,
   *   select shows it), '' invalid; fieldInvalid true; '...' / {} without t.
   */
  it('prepares the texts and validates fields', () => {
    expect(component.stats).toEqual([{ value: '50', label: 'Projects' }, { value: '5', label: 'Years' }, { value: '9', label: 'Solutions' }]);
    expect(component.attachmentUploaderTexts).toEqual(jasmine.objectContaining({ limitsHint: '(max. {max} souborů)', dropzoneLabel: 'Drop', errorMaxFiles: 'Max {max}', totalLabel: 'Total' }));
    expect(component.btnText).toBe('Send');
    expect(component.contactForm.get('subject')!.value).toBe('new_project');
    expect(component.contactForm.get('subject')!.valid).toBeTrue();
    expect((fixture.nativeElement.querySelector('#subject') as HTMLSelectElement).value).toBe('new_project');
    component.contactForm.get('subject')!.setValue('');
    expect(component.contactForm.get('subject')!.valid).toBeFalse();
    expect(component.fieldInvalid('email')).toBeFalse();
    component.contactForm.get('email')!.setValue('x');
    component.contactForm.get('email')!.markAsTouched();
    expect(component.fieldInvalid('email')).toBeTrue();
    expect(component.fieldInvalid('unknown')).toBeFalse();

    ctx.setTranslations({ contact: { buttons: {} } });
    expect(component.attachmentUploaderTexts).toEqual({});
    component.t = null;
    expect(component.btnText).toBe('...');
  });

  /**
   * @description Submit: invalid form → nothing; valid → FormData with the mapped fields, the
   *   current language, the phone only when filled and every attachment; success state.
   * @input Empty form; valid form + phone '+420 777' + 2 files, language 'en'.
   * @output No post; post raw_request_commissions with thema / contact_email / contact_phone /
   *   order_description / lang 'en' / 2 attachments; isSubmitted true, isLoading false.
   */
  it('sends the inquiry with attachments', () => {
    send();
    expect(ctx.publicData.post).not.toHaveBeenCalled();

    ctx.localization.currentLanguage$.next('en');
    fill({ phone: '+420 777' });
    component.onFilesChanged([new File(['a'], 'a.pdf'), new File(['b'], 'b.png')]);
    send();
    const [endpoint, fd] = ctx.publicData.post.calls.mostRecent().args as [string, FormData];
    expect(endpoint).toBe('raw_request_commissions');
    expect(fd.get('captcha_token')).toBe('captcha-token');
    expect([fd.get('thema'), fd.get('contact_email'), fd.get('contact_phone'), fd.get('order_description'), fd.get('lang')])
      .toEqual(['Web', 'a@b.cz', '+420 777', 'Hello there!', 'en']);
    expect((fd.getAll('attachments[]') as File[]).map(f => f.name)).toEqual(['a.pdf', 'b.png']);
    expect(component.isSubmitted()).toBeTrue();
    expect(component.isLoading()).toBeFalse();
  });

  /**
   * @description Without a phone it is not sent; while sending a second submit is ignored and
   *   the button says "sending"; errors are shown translated in the app dialog - never the English API
   *   message, no window.alert (findings #45 / #53); 429 has its own text.
   * @input Pending request + second submit; error with API message; error without; 429.
   * @output One post, no contact_phone, 'Sending…'; dialog ('Not sent', 'Failed') twice; ('Not sent', 'Slow down').
   */
  it('prevents double submits and reports errors', () => {
    const pending = new Subject<any>();
    ctx.publicData.post.and.returnValue(pending);
    fill();
    send();
    send();
    expect(ctx.publicData.post).toHaveBeenCalledTimes(1);
    expect((ctx.publicData.post.calls.mostRecent().args[1] as FormData).has('contact_phone')).toBeFalse();
    expect(component.btnText).toBe('Sending…');
    pending.complete();
    expect(component.isLoading()).toBeFalse();

    const nativeAlert = spyOn(window, 'alert');
    const alertSpy = spyOn(TestBed.inject(AlertDialogService), 'open');
    ctx.publicData.post.and.returnValue(throwError(() => ({ error: { message: 'Spam' } })));
    send();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Failed', 'danger');
    ctx.publicData.post.and.returnValue(throwError(() => ({})));
    send();
    expect(alertSpy.calls.count()).toBe(2);
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 429 })));
    send();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Slow down', 'danger');
    expect(nativeAlert).not.toHaveBeenCalled();
    expect(component.isSubmitted()).toBeFalse();
  });

  /**
   * @description Open finding #64: without a phone (none set or switched off in the admin) the
   *   contact list has no phone row.
   * @input Settings {} (no phone, no address).
   * @output No tel: link, no address element.
   */
  it('renders no phone row without a phone', () => {
    expect(fixture.nativeElement.querySelector('a[href^="tel:"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.info-address')).toBeNull();
  });

  /**
   * @description The uploader gets the rules of the API (raw_request_commission): allowed types
   *   (no svg / xml), counts and sizes. A 422 refusal of an attachment (content does not match the
   *   name) shows its own translated text, falling back to the general error text.
   * @input uploader inputs; post 422 { errors: { 'attachments.0' } } with and without errors.attachment_rejected.
   * @output 10 files / 20 MB / 50 MB, pdf allowed, svg / xml not; limits hint translated; dialog ('Not sent', 'Bad file'); then ('Not sent', 'Failed').
   */
  it('passes the upload rules to the uploader and reports a refused attachment', () => {
    const uploader = fixture.debugElement.query(By.directive(MultiFileUploadComponent)).componentInstance as MultiFileUploadComponent;
    expect([uploader.maxFiles, uploader.maxFileSizeMb, uploader.maxTotalSizeMb]).toEqual([10, 20, 50]);
    expect(uploader.allowedExtensions).toContain('pdf');
    expect(uploader.allowedExtensions).not.toContain('svg');
    expect(uploader.allowedExtensions).not.toContain('xml');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mfu-hint').textContent).toBe('(max. 10 souborů)');

    const alertSpy = spyOn(TestBed.inject(AlertDialogService), 'open');
    const refused = { status: 422, error: { errors: { 'attachments.0': ['This file type is not allowed.'] } } };
    ctx.publicData.post.and.returnValue(throwError(() => refused));
    component.t = { ...component.t, errors: { ...component.t.errors, attachment_rejected: 'Bad file' } };
    fill();
    send();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Bad file', 'danger');
    component.t = { ...component.t, errors: { ...component.t.errors, attachment_rejected: undefined } };
    send();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Failed', 'danger');
  });

  /**
   * @description Invisible captcha (PublicFormGuard): the widget is rendered invisibly
   *   (interaction-only) and never blocks the button; a submit before the background check is done
   *   waits for the token, then posts it with the empty honeypot field. A refused captcha (422
   *   captcha_required) and the quota of the address (429 error_code RECIPIENT_LIMIT) have their
   *   own texts (general ones without them); after every refusal the widget is reset.
   * @input Valid form, submit before the token; token; 422; 429; texts removed: 429, 422.
   * @output render(theme auto, interaction-only); button enabled, no post until the token, then
   *   captcha_token + website ''; 'Robot?' + reset('widget-1'); 'Enough for this address'; 'Slow down'; 'Failed'.
   */
  it('waits for the invisible captcha and reports its refusals', async () => {
    await fixture.whenStable();
    expect(ctx.turnstile.render).toHaveBeenCalledTimes(1);
    expect(ctx.turnstile.render.calls.mostRecent().args[3]).toEqual({ theme: 'auto', appearance: 'interaction-only' });

    fill();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeFalse();
    component.onSubmit();
    expect(ctx.publicData.post).not.toHaveBeenCalled();
    expect(component.isLoading()).toBeTrue();
    solve();
    const fd = ctx.publicData.post.calls.mostRecent().args[1] as FormData;
    expect([fd.get('captcha_token'), fd.get('website')]).toEqual(['captcha-token', '']);

    component.isSubmitted.set(false);
    const alertSpy = spyOn(TestBed.inject(AlertDialogService), 'open');
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 422, error: { captcha_required: true } })));
    send();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Robot?', 'danger');
    expect(ctx.turnstile.reset).toHaveBeenCalledWith('widget-1');

    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 429, error: { error_code: 'RECIPIENT_LIMIT' } })));
    send();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Enough for this address', 'danger');

    // Without the own texts the general ones are shown.
    component.t = { ...component.t, errors: { submit_error: 'Failed', submit_error_title: 'Not sent', too_many_requests: 'Slow down' } };
    send();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Slow down', 'danger');
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 422, error: { captcha_required: true } })));
    send();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Failed', 'danger');
  });
});
