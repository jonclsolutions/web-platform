/**
 * @file legal-docs.service.spec.ts
 * @path src/app/shared/services/legal-docs.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of LegalDocsService: documents cached per slug + language, a failed
 *   load answers null (not cached) and preload() warms the cache.
 * @dependencies
 * - PublicDataService spy.
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { LegalDocsService } from './legal-docs.service';
import { PublicDataService } from './public-data.service';

describe('LegalDocsService', () => {
  let service: LegalDocsService;
  let publicData: jasmine.SpyObj<PublicDataService>;

  beforeEach(() => {
    publicData = jasmine.createSpyObj('PublicDataService', ['get']);
    publicData.get.and.callFake(((endpoint: string, params: any) => of({ endpoint, lang: params.lang })) as any);
    TestBed.configureTestingModule({ providers: [{ provide: PublicDataService, useValue: publicData }] });
    service = TestBed.inject(LegalDocsService);
  });

  /**
   * @description preload + getDocument of the same slug / language → one request; another
   *   language → own request.
   * @input preload('gdpr', 'cz'); getDocument('gdpr', 'cz'); getDocument('gdpr', 'en').
   * @output public/legal/gdpr requested with lang cz once and en once; cached doc returned.
   */
  it('caches documents per slug and language', async () => {
    await service.preload('gdpr', 'cz');
    let doc: any;
    service.getDocument('gdpr', 'cz').subscribe(d => (doc = d));
    expect(doc).toEqual({ endpoint: 'public/legal/gdpr', lang: 'cz' });
    service.getDocument('gdpr', 'en').subscribe();
    expect(publicData.get.calls.allArgs()).toEqual([['public/legal/gdpr', { lang: 'cz' }], ['public/legal/gdpr', { lang: 'en' }]]);
  });

  /**
   * @description A failed load is logged, answers null and is retried next time.
   * @input get fails once, then succeeds.
   * @output null + console.error; second call requests again and returns the doc.
   */
  it('answers null on failure and does not cache it', () => {
    spyOn(console, 'error');
    publicData.get.and.returnValues(throwError(() => new Error('x')) as any, of({ ok: true }) as any);
    const docs: any[] = [];
    service.getDocument('tos', 'cz').subscribe(d => docs.push(d));
    service.getDocument('tos', 'cz').subscribe(d => docs.push(d));
    expect(docs).toEqual([null, { ok: true }]);
    expect(console.error).toHaveBeenCalled();
  });

  /**
   * @description The footer sentence comes from the translation with the date; the API text is
   *   the fallback; no footer for a document without one.
   * @input effectiveFooter(doc, 'Valid from {date}'); (doc, undefined); ({ footer_effective: null }); (null)
   * @output 'Valid from 15.06.2026'; the API text; null; null.
   */
  it('builds the translated effective-from footer', () => {
    const doc = { footer_effective: 'This policy is effective from 15.06.2026.', last_update_date: '15.06.2026' };
    expect(service.effectiveFooter(doc, 'Valid from {date}')).toBe('Valid from 15.06.2026');
    expect(service.effectiveFooter(doc, undefined)).toBe('This policy is effective from 15.06.2026.');
    expect(service.effectiveFooter({ footer_effective: null }, 'x {date}')).toBeNull();
    expect(service.effectiveFooter(null, 'x')).toBeNull();
  });
});
