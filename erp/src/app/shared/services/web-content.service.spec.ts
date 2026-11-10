/**
 * @file web-content.service.spec.ts
 * @path src/app/shared/services/web-content.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of WebContentService: one shared request per list (FAQ, jobs), a failed
 *   request gives [] and is tried again next time; localizedText / optionalText pick the current
 *   language ('Cannot load text' when missing, null for an optional field empty everywhere).
 * @dependencies
 * - PublicDataService stub (get).
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MISSING_TEXT, WebContentService, localizedText, optionalText } from './web-content.service';
import { PublicDataService } from './public-data.service';

describe('WebContentService', () => {
  let service: WebContentService;
  let get: jasmine.Spy;

  beforeEach(() => {
    get = jasmine.createSpy('get');
    TestBed.configureTestingModule({ providers: [{ provide: PublicDataService, useValue: { get } }] });
    service = TestBed.inject(WebContentService);
  });

  /**
   * @description Each list is requested once and shared by every subscriber.
   * @input faq() twice, jobs() twice.
   * @output GET public/web/faq once, public/web/jobs once; the answers passed on.
   */
  it('shares one request per list', () => {
    get.and.callFake((endpoint: string) => of(endpoint === 'public/web/faq' ? [{ id: 1 }] : [{ slug: 'dev' }]));
    const results: unknown[] = [];
    service.faq().subscribe(r => results.push(r));
    service.faq().subscribe(r => results.push(r));
    service.jobs().subscribe(r => results.push(r));
    service.jobs().subscribe(r => results.push(r));

    expect(get.calls.allArgs()).toEqual([['public/web/faq'], ['public/web/jobs']]);
    expect(results).toEqual([[{ id: 1 }], [{ id: 1 }], [{ slug: 'dev' }], [{ slug: 'dev' }]]);
  });

  /**
   * @description A failed request answers [] and is not cached.
   * @input GET fails, then succeeds.
   * @output [] then the list; two requests.
   */
  it('answers [] after an error and tries again', () => {
    get.and.returnValue(throwError(() => new Error('down')));
    let first: unknown;
    service.faq().subscribe(r => (first = r));
    expect(first).toEqual([]);

    get.and.returnValue(of([{ id: 2 }]));
    let second: unknown;
    service.faq().subscribe(r => (second = r));
    expect(second).toEqual([{ id: 2 }]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  /**
   * @description Text of the current language; missing / blank = placeholder; an optional field
   *   empty in every language = null.
   * @input { cz, en: ' ' } in cz / en / de; optional {} and { en } in cz.
   * @output text; MISSING_TEXT twice; null; MISSING_TEXT.
   */
  it('picks the text of the current language', () => {
    const text = { cz: 'Ahoj', en: ' ' };
    expect(localizedText(text, 'cz')).toBe('Ahoj');
    expect(localizedText(text, 'en')).toBe(MISSING_TEXT);
    expect(localizedText(null, 'de')).toBe(MISSING_TEXT);
    expect(optionalText({}, 'cz')).toBeNull();
    expect(optionalText({ cz: '' }, 'cz')).toBeNull();
    expect(optionalText({ en: 'Remote' }, 'cz')).toBe(MISSING_TEXT);
    expect(optionalText({ cz: 'Praha' }, 'cz')).toBe('Praha');
  });
});
