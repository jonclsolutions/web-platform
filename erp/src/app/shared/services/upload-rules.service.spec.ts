/**
 * @file upload-rules.service.spec.ts
 * @path src/app/shared/services/upload-rules.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of UploadRulesService: one request of `GET upload-rules` per session
 *   shared by every profile, an unknown profile and an unreachable API answer null.
 * @dependencies
 * - HttpTestingController (provideHttpClientTesting).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UploadRulesService } from './upload-rules.service';
import { environment } from '../../../environments/environment';
import { TEST_UPLOAD_RULES } from '../../../testing/upload-rules-stub';

describe('UploadRulesService', () => {
  let service: UploadRulesService;
  let http: HttpTestingController;
  const url = `${environment.base_api_url}/upload-rules`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UploadRulesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * @description Two profiles, asked at different times, share ONE request; the profile of the
   *   envelope is returned.
   * @input rules('sales_order'), rules('project_thread') then later rules('job_application').
   * @output one GET upload-rules; the matching profiles of the answer.
   */
  it('loads all profiles once and shares them', () => {
    const got: any[] = [];
    service.rules('sales_order').subscribe(r => got.push(r));
    service.rules('project_thread').subscribe(r => got.push(r));
    http.expectOne(url).flush({ data: TEST_UPLOAD_RULES });
    service.rules('job_application').subscribe(r => got.push(r));
    http.expectNone(url);
    expect(got).toEqual([TEST_UPLOAD_RULES.sales_order, TEST_UPLOAD_RULES.project_thread, TEST_UPLOAD_RULES.job_application]);
  });

  /**
   * @description A profile missing from the answer and an answer without data give null.
   * @input answer { data: { sales_order } } and rules('job_application'); a fresh service answered with {}.
   * @output null; null.
   */
  it('answers null for a missing profile or empty answer', () => {
    let got: any = 'unset';
    service.rules('job_application').subscribe(r => (got = r));
    http.expectOne(url).flush({ data: { sales_order: TEST_UPLOAD_RULES.sales_order } });
    expect(got).toBeNull();

    const fresh = TestBed.runInInjectionContext(() => new UploadRulesService());
    got = 'unset';
    fresh.rules('sales_order').subscribe(r => (got = r));
    http.expectOne(url).flush({});
    expect(got).toBeNull();
  });

  /**
   * @description An unreachable API does not break the forms - the rules are null and the API
   *   decides on submit.
   * @input GET upload-rules answers 500.
   * @output null, no error thrown to the subscriber.
   */
  it('answers null when the API cannot be reached', () => {
    let got: any = 'unset';
    let failed = false;
    service.rules('sales_order').subscribe({ next: r => (got = r), error: () => (failed = true) });
    http.expectOne(url).flush('down', { status: 500, statusText: 'Server Error' });
    expect(got).toBeNull();
    expect(failed).toBeFalse();
  });
});
