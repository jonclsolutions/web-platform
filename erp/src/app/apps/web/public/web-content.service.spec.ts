/**
 * @file web-content.service.spec.ts
 * @path src/app/apps/web/public/web-content.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of WebContentService: one shared request per list (FAQ, jobs, references, knowledge base), a failed
 *   request gives [] and is tried again next time; localizedText / optionalText pick the current
 *   language ('Cannot load text' when missing, null for an optional field empty everywhere).
 * @dependencies
 * - PublicDataService stub (get).
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MISSING_TEXT, WebContentService, localizedText, optionalText } from './web-content.service';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { PublicTextEditorService } from '../../../public/text-editor/public-text-editor.service';
import { scanMarks } from '../../../public/text-editor/text-editor-markers';

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
   * @input faq(), jobs(), references(), knowledgeBase() twice each.
   * @output GET public/web/faq, public/web/jobs, public/web/references, public/web/knowledge-base once each; the answers
   *   passed on.
   */
  it('shares one request per list', () => {
    const answers: Record<string, unknown[]> = { 'public/web/faq': [{ id: 1 }], 'public/web/jobs': [{ slug: 'dev' }], 'public/web/references': [{ id: 7 }], 'public/web/knowledge-base': [{ id: 9 }] };
    get.and.callFake((endpoint: string) => of(answers[endpoint]));
    const results: unknown[] = [];
    service.faq().subscribe(r => results.push(r));
    service.faq().subscribe(r => results.push(r));
    service.jobs().subscribe(r => results.push(r));
    service.jobs().subscribe(r => results.push(r));
    service.references().subscribe(r => results.push(r));
    service.references().subscribe(r => results.push(r));
    service.knowledgeBase().subscribe(r => results.push(r));
    service.knowledgeBase().subscribe(r => results.push(r));

    expect(get.calls.allArgs()).toEqual([['public/web/faq'], ['public/web/jobs'], ['public/web/references'], ['public/web/knowledge-base']]);
    expect(results).toEqual([[{ id: 1 }], [{ id: 1 }], [{ slug: 'dev' }], [{ slug: 'dev' }], [{ id: 7 }], [{ id: 7 }], [{ id: 9 }], [{ id: 9 }]]);
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

  /**
   * @description In the visual text editor of the admin the texts of the content are marked with
   *   their part of the admin (blue outline); identifiers stay.
   * @input editor mode; GET public/web/faq answers a category
   * @output name.cz marked as content of faq; id unchanged
   */
  it('marks the content for the visual text editor', () => {
    const editor = TestBed.inject(PublicTextEditorService);
    Object.defineProperty(editor, 'active', { value: true });
    get.and.returnValue(of([{ id: 4, name: { cz: 'Obecné' }, items: [] }]));
    let list: any[] = [];
    service.faq().subscribe(r => (list = r));
    const marks = scanMarks(list[0].name.cz);
    expect(editor.entry(marks[0].index!)).toEqual({ kind: 'content', section: 'faq' });
    expect(list[0].id).toBe(4);
  });
});
