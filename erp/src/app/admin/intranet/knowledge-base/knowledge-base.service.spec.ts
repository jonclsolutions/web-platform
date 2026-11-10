/**
 * @file knowledge-base.service.spec.ts
 * @path src/app/admin/intranet/knowledge-base/knowledge-base.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of KnowledgeBaseService: menu / page requests with the language, the
 *   payload unwrapped, cached per user and language, errors as an empty menu / null page.
 * @dependencies HttpTestingController; AuthService stub (user id of the cache key).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { KnowledgeBaseService } from './knowledge-base.service';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let http: HttpTestingController;
  let userId = '1';
  const api = environment.base_api_url;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { getUserId: () => userId } }],
    });
    service = TestBed.inject(KnowledgeBaseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * @description The menu of a language is requested once per user (cache); another user or
   *   language asks again; an error is an empty menu.
   * @input menu('cz') twice; user 2; menu('en') failing.
   * @output one GET ?lang=cz with the data; a second GET for user 2; [] for the error.
   */
  it('loads and caches the menu', () => {
    const results: any[] = [];
    service.menu('cz').subscribe(r => results.push(r));
    http.expectOne(`${api}/knowledge-base?lang=cz`).flush({ data: [{ id: 'a', group: 'general', order: 1, label: 'A' }] });
    service.menu('cz').subscribe(r => results.push(r));
    expect(results.length).toBe(2);
    expect(results[1][0].id).toBe('a');

    userId = '2';
    service.menu('cz').subscribe();
    http.expectOne(`${api}/knowledge-base?lang=cz`).flush({ data: null });

    service.menu('en').subscribe(r => results.push(r));
    http.expectOne(`${api}/knowledge-base?lang=en`).flush({}, { status: 500, statusText: 'Error' });
    expect(results[2]).toEqual([]);
    userId = '1';
  });

  /**
   * @description A page is requested with its id and language; 404 (missing / not allowed) is null.
   * @input page('administrators', 'en'); page('hidden', 'cz') answering 404; an answer without data.
   * @output the page payload; null; null.
   */
  it('loads a page and maps a refusal to null', () => {
    let result: any;
    service.page('administrators', 'en').subscribe(r => (result = r));
    http.expectOne(`${api}/knowledge-base/pages/administrators?lang=en`).flush({ data: { id: 'administrators' } });
    expect(result.id).toBe('administrators');

    service.page('hidden', 'cz').subscribe(r => (result = r));
    http.expectOne(`${api}/knowledge-base/pages/hidden?lang=cz`).flush({ message: 'Page not found.' }, { status: 404, statusText: 'Not Found' });
    expect(result).toBeNull();

    service.page('empty', 'cz').subscribe(r => (result = r));
    http.expectOne(`${api}/knowledge-base/pages/empty?lang=cz`).flush({});
    expect(result).toBeNull();
  });
});
