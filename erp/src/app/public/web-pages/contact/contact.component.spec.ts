/**
 * @file contact.component.spec.ts
 * @path src/app/public/web-pages/contact/contact.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ContactComponent (contact / inquiry form): form validation, stats from the
 *   home texts, attachment texts for the uploader, the multipart submit (language, optional
 *   phone, attachments) with success, error and double-submit protection.
 * @dependencies
 * - createPublicPageContext (post spy); AlertDialogService spied (errors are shown in the app dialog).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ContactComponent } from './contact.component';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('ContactComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<ContactComponent>;
  let component: ContactComponent;
  const contact = {
    buttons: { send: 'Send', sending: 'Sending…' }, errors: { submit_error: 'Failed', submit_error_title: 'Not sent', too_many_requests: 'Slow down' },
    attachment_uploader: { dropzone_label: 'Drop', error_max_files: 'Max {max}', total_label: 'Total' }
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

  /**
   * @description Stats and uploader texts come from the translations; button text follows the
   *   loading state ('...' without texts); fields report invalid only after touch.
   * @input Translations above; email 'x' touched.
   * @output 3 stats; uploader texts mapped (missing → undefined); 'Send'; fieldInvalid true; '...' / {} without t.
   */
  it('prepares the texts and validates fields', () => {
    expect(component.stats).toEqual([{ value: '50', label: 'Projects' }, { value: '5', label: 'Years' }, { value: '9', label: 'Solutions' }]);
    expect(component.attachmentUploaderTexts).toEqual(jasmine.objectContaining({ dropzoneLabel: 'Drop', errorMaxFiles: 'Max {max}', totalLabel: 'Total' }));
    expect(component.btnText).toBe('Send');
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
    component.onSubmit();
    expect(ctx.publicData.post).not.toHaveBeenCalled();

    ctx.localization.currentLanguage$.next('en');
    fill({ phone: '+420 777' });
    component.onFilesChanged([new File(['a'], 'a.pdf'), new File(['b'], 'b.png')]);
    component.onSubmit();
    const [endpoint, fd] = ctx.publicData.post.calls.mostRecent().args as [string, FormData];
    expect(endpoint).toBe('raw_request_commissions');
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
    component.onSubmit();
    component.onSubmit();
    expect(ctx.publicData.post).toHaveBeenCalledTimes(1);
    expect((ctx.publicData.post.calls.mostRecent().args[1] as FormData).has('contact_phone')).toBeFalse();
    expect(component.btnText).toBe('Sending…');
    pending.complete();
    expect(component.isLoading()).toBeFalse();

    const nativeAlert = spyOn(window, 'alert');
    const alertSpy = spyOn(TestBed.inject(AlertDialogService), 'open');
    ctx.publicData.post.and.returnValue(throwError(() => ({ error: { message: 'Spam' } })));
    component.onSubmit();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Failed', 'danger');
    ctx.publicData.post.and.returnValue(throwError(() => ({})));
    component.onSubmit();
    expect(alertSpy.calls.count()).toBe(2);
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 429 })));
    component.onSubmit();
    expect(alertSpy).toHaveBeenCalledWith('Not sent', 'Slow down', 'danger');
    expect(nativeAlert).not.toHaveBeenCalled();
    expect(component.isSubmitted()).toBeFalse();
  });
});
