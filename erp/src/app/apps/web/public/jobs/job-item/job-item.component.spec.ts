/**
 * @file job-item.component.spec.ts
 * @path src/app/apps/web/public/jobs/job-item/job-item.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of JobItemComponent (job detail + application form): the position of the
 *   route slug from the database (public/web/jobs, texts per language, missing ones 'Cannot load text'),
 *   form validation (Unicode names, e-mail, phone, consent), the CV size limit (20 MB) and the
 *   multipart submit with success / API error; a public page (BasePublicComponent, finding #47) with
 *   translated texts only (finding #44).
 * @dependencies
 * - createPublicPageContext (translations, site settings cache, public/web/jobs answered by the
 *   PublicDataService stub); ActivatedRoute with paramMap id.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { JobItemComponent } from './job-item.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../../testing/public-test-helpers';

describe('JobItemComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<JobItemComponent>;
  let component: JobItemComponent;
  /** Positions of public/web/jobs. */
  const JOBS = [{
    slug: 'dev', title: { cz: 'Developer', en: 'Developer EN' }, summary: { cz: 'Code' }, type: { cz: 'Full-time' }, location: {},
    sections: [{ heading: {}, body: { cz: 'Intro\n• one' } }, { heading: { cz: 'Tasks:', en: 'Tasks EN:' }, body: { cz: 'Write code' } }],
  }];
  const jobs = { not_found: 'Position not found', form_error_generic: 'Try again', form_too_many_requests: 'Slow down', form_captcha_failed: 'Robot?', form_email_limit: 'Enough for this address', form_cv_type_error: 'Typ nelze. Povolené: {types}' };

  /** Creates the page for the job id in the route. */
  function create(id: string | null = 'dev'): void {
    ctx = createPublicPageContext({ translations: { jobs }, settings: { settings: { contact_email: 'hr@x.cz' } } });
    ctx.publicData.get.and.callFake((endpoint: string) => of(endpoint === 'public/web/jobs' ? JOBS : {}));
    TestBed.configureTestingModule({
      imports: [JobItemComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } }]
    });
    fixture = TestBed.createComponent(JobItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Completes the background captcha check (`solve`) and submits - the widget is reset after every refused submission. */
  const solve = () => ctx.turnstile.render.calls.mostRecent().args[1]('captcha-token');
  const send = () => { solve(); component.onSubmit(); };

  /** Fills a valid application. */
  const fill = () => component.applicationForm.setValue({
    first_name: 'Žofie', last_name: "O'Neil-Nová", email: 'z@x.cz', phone: '+420 777 123 456', message: 'Hi', dataProcessingAgreement: true
  });
  const cv = (size = 1000) => { const f = new File(['cv'], 'cv.pdf'); Object.defineProperty(f, 'size', { value: size }); return f; };

  /**
   * @description The position of the route slug comes from public/web/jobs in the current language
   *   (an optional field empty everywhere is left out, a missing text = 'Cannot load text'), the
   *   blocks keep their lines; the site settings come from the startup cache; an unknown slug shows
   *   "not found"; no admin services / i18n (finding #47).
   * @input slug 'dev' (cz, then en); slug 'missing'.
   * @output job in cz (type, no location, 2 blocks); en: English title / heading, other texts
   *   'Cannot load text'; one GET public/web/jobs; web module; not found text.
   */
  it('loads the job by the route slug', () => {
    create();
    expect(component.job).toEqual({
      title: 'Developer', type: 'Full-time', location: null,
      sections: [{ heading: null, body: 'Intro\n• one' }, { heading: 'Tasks:', body: 'Write code' }],
    });
    expect(ctx.publicData.get).toHaveBeenCalledOnceWith('public/web/jobs');
    expect(ctx.localization.setModule).toHaveBeenCalledWith('web');
    expect(component.settings).toEqual({ contact_email: 'hr@x.cz' });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Developer');
    expect(text).toContain('Full-time');
    expect(fixture.nativeElement.querySelectorAll('.job-desc-block').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.job-desc-block strong')?.textContent).toBe('Tasks:');

    ctx.localization.setLanguage('en');
    expect(component.job).toEqual({
      title: 'Developer EN', type: 'Cannot load text', location: null,
      sections: [{ heading: null, body: 'Cannot load text' }, { heading: 'Tasks EN:', body: 'Cannot load text' }],
    });

    TestBed.resetTestingModule();
    create('missing');
    expect(component.job).toBeNull();
    expect(component.jobsLoaded).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Position not found');
  });

  /**
   * @description Validation: Unicode names with apostrophe / hyphen accepted, digits refused;
   *   invalid e-mail / phone refused; consent required.
   * @input Valid application; first_name 'Jan2'; email 'x'; phone 'abc'; consent false.
   * @output valid; each invalid.
   */
  it('validates the application form', () => {
    create();
    fill();
    expect(component.applicationForm.valid).toBeTrue();
    const invalid = (field: string, value: any) => {
      fill();
      component.applicationForm.get(field)!.setValue(value);
      return component.applicationForm.get(field)!.invalid;
    };
    expect(invalid('first_name', 'Jan2')).toBeTrue();
    expect(invalid('email', 'x')).toBeTrue();
    expect(invalid('phone', 'abc')).toBeTrue();
    expect(invalid('dataProcessingAgreement', false)).toBeTrue();
  });

  /**
   * @description CV: no file ignored; > 20 MB refused (input cleared); valid accepted.
   * @input files []; 21 MB file; 1 kB file.
   * @output nothing; fileSizeError + selectedFile null + value ''; selectedFile set, no error.
   */
  it('checks the CV size', () => {
    create();
    component.onFileSelected({ target: { files: [] } });
    expect(component.selectedFile).toBeNull();
    const target: any = { files: [cv(21 * 1024 * 1024)], value: 'C:/cv.pdf' };
    component.onFileSelected({ target });
    expect(component.fileSizeError).toBeTrue();
    expect(target.value).toBe('');
    component.onFileSelected({ target: { files: [cv()] } });
    expect(component.fileSizeError).toBeFalse();
    expect(component.selectedFile!.name).toBe('cv.pdf');
  });

  /**
   * @description CV type: the picker offers every file and no type list is shown up front; xml,
   *   svg and a name without extension (rules of the API, job_application) are refused right when
   *   chosen and only then the error lists the allowed types (translated, English default without
   *   translation); without the rules of the API the browser does not check (the API decides).
   * @input file input; cv.xml; logo.svg; README; t without form_cv_type_error; cvRules null + tool.exe.
   * @output no accept, no type list; fileTypeError, selectedFile null, input cleared, error span
   *   with 'PDF, DOC'; default text; tool.exe kept.
   */
  it('checks the CV type against the upload rules', () => {
    create();
    expect((fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement).hasAttribute('accept')).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain('Povolené');

    for (const name of ['cv.xml', 'logo.svg', 'README']) {
      const target: any = { files: [new File(['x'], name)], value: 'C:/' + name };
      component.onFileSelected({ target });
      expect(component.fileTypeError).withContext(name).toBeTrue();
      expect(component.fileSizeError).toBeFalse();
      expect(component.selectedFile).toBeNull();
      expect(target.value).toBe('');
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Typ nelze. Povolené: PDF, DOC, DOCX');

    component.t = { ...component.t, form_cv_type_error: undefined };
    expect(component.cvTypeErrorText).toContain('This file type cannot be uploaded. Allowed types: PDF');

    component.cvRules = null;
    expect(component.cvTypeErrorText).toBe('This file type cannot be uploaded. Allowed types: ');
    component.onFileSelected({ target: { files: [new File(['x'], 'tool.exe')] } });
    expect(component.fileTypeError).toBeFalse();
    expect(component.selectedFile!.name).toBe('tool.exe');
  });

  /**
   * @description The API refused the CV (content of another type than the name says, 422 on
   *   cv_file): the type error is shown at the file field and another file must be chosen.
   * @input valid application; post fails 422 { errors: { cv_file } }.
   * @output fileTypeError, selectedFile null, no general error, not submitted.
   */
  it('shows a CV refused by the API at the file field', () => {
    create();
    fill();
    component.onFileSelected({ target: { files: [cv()] } });
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 422, error: { errors: { cv_file: ['The file type is not allowed.'] } } })));
    send();
    expect(component.fileTypeError).toBeTrue();
    expect(component.selectedFile).toBeNull();
    expect(component.errorMessage).toBeNull();
    expect(component.isSubmitted).toBeFalse();
  });

  /**
   * @description Submit: invalid form or missing CV only marks the fields; a valid application
   *   is posted as FormData (consent '1', position name, CV); success shows the thank-you state;
   *   errors show the translated text (never the English API message, findings #44 / #53).
   * @input Submit empty; valid without CV; valid + CV ok; API error with message; without message; 429.
   * @output No post + touched; no post; post job_applications with fields; isSubmitted; 'Try again' twice; 'Slow down'.
   */
  it('submits the application', () => {
    create();
    send();
    expect(ctx.publicData.post).not.toHaveBeenCalled();
    expect(component.applicationForm.touched).toBeTrue();
    fill();
    send();
    expect(ctx.publicData.post).not.toHaveBeenCalled();

    component.onFileSelected({ target: { files: [cv()] } });
    send();
    const [endpoint, fd] = ctx.publicData.post.calls.mostRecent().args as [string, FormData];
    expect(endpoint).toBe('job_applications');
    expect(fd.get('first_name')).toBe('Žofie');
    expect(fd.get('dataProcessingAgreement')).toBe('1');
    expect(fd.get('position_name')).toBe('Developer');
    expect((fd.get('cv_file') as File).name).toBe('cv.pdf');
    expect(fd.get('captcha_token')).toBe('captcha-token');
    expect(component.isSubmitted).toBeTrue();

    ctx.publicData.post.and.returnValue(throwError(() => ({ error: { message: 'Bad CV' } })));
    send();
    expect(component.errorMessage).toBe('Try again');
    ctx.publicData.post.and.returnValue(throwError(() => ({})));
    send();
    expect(component.errorMessage).toBe('Try again');
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 429 })));
    send();
    expect(component.errorMessage).toBe('Slow down');
  });

  /**
   * @description Open finding #64: the contact strip shows the phone (and its separator) only
   *   when there is one.
   * @input Settings with e-mail only; then with phone '+420 1'.
   * @output no tel: link / separator; then tel:+4201 and one separator.
   */
  it('shows the phone in the contact strip only with a phone', () => {
    create();
    expect(fixture.nativeElement.querySelector('.job-contact-strip')).not.toBeNull();
    const el: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance as any;
    expect(el.querySelector('a[href^="tel:"]')).toBeNull();
    expect(el.querySelector('.job-contact-sep')).toBeNull();
    component.settings = { contact_email: 'hr@x.cz', contact_phone: '+420 1' };
    component.cdr.markForCheck();
    fixture.detectChanges();
    expect(el.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe('tel:+4201');
    expect(el.querySelectorAll('.job-contact-sep').length).toBe(1);
  });

  /**
   * @description Invisible captcha (PublicFormGuard): a submit before the background check is
   *   done waits for the token, then posts it with the empty honeypot field. A refused captcha
   *   (422 captcha_required) and the quota of the address (429 error_code RECIPIENT_LIMIT) have
   *   their own texts (general ones without them); after every refusal the widget is reset.
   * @input Valid application + CV, submit before the token; token; 422; 429; texts removed: 429, 422.
   * @output No post until the token, then captcha_token + website ''; 'Robot?' + reset('widget-1');
   *   'Enough for this address'; 'Slow down'; 'Try again'.
   */
  it('waits for the invisible captcha and reports its refusals', async () => {
    create();
    await fixture.whenStable();
    fill();
    component.onFileSelected({ target: { files: [cv()] } });
    component.onSubmit();
    expect(ctx.publicData.post).not.toHaveBeenCalled();
    solve();
    const fd = ctx.publicData.post.calls.mostRecent().args[1] as FormData;
    expect([fd.get('captcha_token'), fd.get('website')]).toEqual(['captcha-token', '']);

    component.isSubmitted = false;
    fixture.detectChanges();
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 422, error: { captcha_required: true } })));
    send();
    expect(component.errorMessage).toBe('Robot?');
    expect(ctx.turnstile.reset).toHaveBeenCalledWith('widget-1');

    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 429, error: { error_code: 'RECIPIENT_LIMIT' } })));
    send();
    expect(component.errorMessage).toBe('Enough for this address');

    // Without the own texts the general ones are shown.
    component.t = { ...component.t, form_captcha_failed: undefined, form_email_limit: undefined };
    send();
    expect(component.errorMessage).toBe('Slow down');
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 422, error: { captcha_required: true } })));
    send();
    expect(component.errorMessage).toBe('Try again');
  });
});
