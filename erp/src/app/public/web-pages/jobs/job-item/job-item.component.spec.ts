/**
 * @file job-item.component.spec.ts
 * @path src/app/public/web-pages/jobs/job-item/job-item.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of JobItemComponent (job detail + application form): job content by the route id,
 *   form validation (Unicode names, e-mail, phone, consent), the CV size limit (20 MB) and the
 *   multipart submit with success / API error.
 * @dependencies
 * - createAdminTestContext (BaseDataComponent services) + createPublicPageContext; ActivatedRoute with paramMap id.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { JobItemComponent } from './job-item.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('JobItemComponent', () => {
  let admin: AdminTestContext;
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<JobItemComponent>;
  let component: JobItemComponent;
  const jobs = { dev: { title: 'Developer', content: '<p>Code</p>' }, form_error_generic: 'Try again' };

  /** Creates the page for the job id in the route. */
  function create(id: string | null = 'dev'): void {
    admin = createAdminTestContext();
    ctx = createPublicPageContext({ translations: { jobs } });
    ctx.publicData.get.and.returnValue(of({ settings: { contact_email: 'hr@x.cz' } }));
    TestBed.configureTestingModule({
      imports: [JobItemComponent],
      providers: [...admin.providers, ...ctx.providers.slice(3), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } }]
    });
    fixture = TestBed.createComponent(JobItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Fills a valid application. */
  const fill = () => component.applicationForm.setValue({
    first_name: 'Žofie', last_name: "O'Neil-Nová", email: 'z@x.cz', phone: '+420 777 123 456', message: 'Hi', dataProcessingAgreement: true
  });
  const cv = (size = 1000) => { const f = new File(['cv'], 'cv.pdf'); Object.defineProperty(f, 'size', { value: size }); return f; };

  /**
   * @description Job content of the route id and the site settings are loaded; an unknown id
   *   leaves the job empty.
   * @input id 'dev'; id 'missing'.
   * @output job {Developer, <p>Code</p>}, settings from public/legal/config; job null.
   */
  it('loads the job by the route id', () => {
    create();
    expect(component.job).toEqual({ title: 'Developer', fullContent: '<p>Code</p>' });
    expect(ctx.publicData.get).toHaveBeenCalledWith('public/legal/config');
    expect(component.settings).toEqual({ contact_email: 'hr@x.cz' });
    expect(fixture.nativeElement.textContent).toContain('Developer');

    TestBed.resetTestingModule();
    create('missing');
    expect(component.job).toBeNull();
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
   * @description Submit: invalid form or missing CV only marks the fields; a valid application
   *   is posted as FormData (consent '1', position name, CV); success shows the thank-you state;
   *   errors show the API message or the translated fallback.
   * @input Submit empty; valid without CV; valid + CV ok; API error with message; without message.
   * @output No post + touched; no post; post job_applications with fields; isSubmitted; 'Bad CV'; 'Try again'.
   */
  it('submits the application', () => {
    create();
    component.onSubmit();
    expect(ctx.publicData.post).not.toHaveBeenCalled();
    expect(component.applicationForm.touched).toBeTrue();
    fill();
    component.onSubmit();
    expect(ctx.publicData.post).not.toHaveBeenCalled();

    component.onFileSelected({ target: { files: [cv()] } });
    component.onSubmit();
    const [endpoint, fd] = ctx.publicData.post.calls.mostRecent().args as [string, FormData];
    expect(endpoint).toBe('job_applications');
    expect(fd.get('first_name')).toBe('Žofie');
    expect(fd.get('dataProcessingAgreement')).toBe('1');
    expect(fd.get('position_name')).toBe('Developer');
    expect((fd.get('cv_file') as File).name).toBe('cv.pdf');
    expect(component.isSubmitted).toBeTrue();

    ctx.publicData.post.and.returnValue(throwError(() => ({ error: { message: 'Bad CV' } })));
    component.onSubmit();
    expect(component.errorMessage).toBe('Bad CV');
    ctx.publicData.post.and.returnValue(throwError(() => ({})));
    component.onSubmit();
    expect(component.errorMessage).toBe('Try again');
  });
});
