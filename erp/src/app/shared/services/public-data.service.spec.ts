/**
 * @file public-data.service.spec.ts
 * @path src/app/shared/services/public-data.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the public PublicDataService: GET / POST to the API base URL,
 *   storage URLs, site settings and the no-cache status endpoints; errors are logged and
 *   rethrown unchanged; the cached settings stream.
 * @dependencies
 * - HttpTestingController.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PublicDataService } from './public-data.service';
import { environment } from '../../../environments/environment';

const API = environment.base_api_url;

describe('PublicDataService (shared)', () => {
  let service: PublicDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PublicDataService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  /**
   * @description get with params, post with body, getSiteSettings endpoint.
   * @input get('public/faq', {lang: 'en'}); post('public/contact', {a: 1}); getSiteSettings().
   * @output GET …/public/faq?lang=en; POST body {a: 1}; GET …/public/legal/config.
   */
  it('sends requests to the API base URL', () => {
    let got: any;
    service.get('public/faq', { lang: 'en' }).subscribe(r => (got = r));
    http.expectOne(`${API}/public/faq?lang=en`).flush([1]);
    expect(got).toEqual([1]);

    service.post('public/contact', { a: 1 }).subscribe();
    const post = http.expectOne(`${API}/public/contact`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ a: 1 });
    post.flush({});

    service.getSiteSettings().subscribe(r => (got = r));
    http.expectOne(`${API}/public/legal/config`).flush({ settings: {} });
    expect(got).toEqual({ settings: {} });
  });

  /**
   * @description Status endpoints are requested with no-cache headers.
   * @input getShopStatus(); getWebStatus().
   * @output Cache-Control 'no-cache, no-store, must-revalidate', Pragma, Expires on both.
   */
  it('requests the status endpoints without caching', () => {
    service.getShopStatus().subscribe();
    service.getWebStatus().subscribe();
    for (const url of [`${API}/shop/public/status`, `${API}/web/public/status`]) {
      const req = http.expectOne(url);
      expect(req.request.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(req.request.headers.get('Pragma')).toBe('no-cache');
      expect(req.request.headers.get('Expires')).toBe('0');
      req.flush({});
    }
  });

  /**
   * @description Errors are logged and the original HttpErrorResponse is rethrown.
   * @input GET answered 404.
   * @output Error with status 404 + console.error with the status.
   */
  it('logs and rethrows errors', () => {
    spyOn(console, 'error');
    let error: any;
    service.get('x').subscribe({ error: e => (error = e) });
    http.expectOne(`${API}/x`).flush({ message: 'no' }, { status: 404, statusText: 'Not Found' });
    expect(error.status).toBe(404);
    expect((console.error as jasmine.Spy).calls.mostRecent().args[0]).toContain('Status: 404');
  });

  /**
   * @description Storage URLs: empty → '', absolute kept, relative under /storage/; cached
   *   settings are published to subscribers.
   * @input '', 'https://cdn/x.png', 'logo.png'; setCachedSettings({a: 1}).
   * @output '', unchanged, '/storage/logo.png'; stream null → {a: 1}.
   */
  it('builds storage URLs and caches settings', () => {
    expect(service.getStorageUrl('')).toBe('');
    expect(service.getStorageUrl('https://cdn/x.png')).toBe('https://cdn/x.png');
    expect(service.getStorageUrl('logo.png')).toBe('/storage/logo.png');

    const values: any[] = [];
    service.siteSettingsValue$.subscribe(v => values.push(v));
    service.setCachedSettings({ a: 1 });
    expect(values).toEqual([null, { a: 1 }]);
  });
});
