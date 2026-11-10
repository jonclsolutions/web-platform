/**
 * @file kb-article.component.spec.ts
 * @path src/app/admin/intranet/knowledge-base/kb-article/kb-article.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of KbArticleComponent: the page of the route parameter loaded in the
 *   current language (again after a navigation or a language switch), every block type
 *   rendered, breadcrumb, the not-found state (missing / not allowed page) without a flash while
 *   loading.
 * @dependencies
 * - createAdminTestContext (i18n stub); ActivatedRoute paramMap subject; KnowledgeBaseService stub.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { KbArticleComponent } from './kb-article.component';
import { KnowledgeBaseService } from '../knowledge-base.service';
import { KBPage } from '../../../../shared/interfaces/kb-content';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('KbArticleComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<KbArticleComponent>;
  let article: KbArticleComponent;
  let params$: BehaviorSubject<ParamMap>;
  let service: jasmine.SpyObj<KnowledgeBaseService>;

  /** A page using every block type. */
  const page = (lang: string): KBPage => ({
    id: 'guide', group: 'core', order: 1, navLabel: `Guide ${lang}`, header: `Header ${lang}`,
    sections: [
      { key: 'intro', blocks: [{ type: 'lead', content: 'Lead' }, { type: 'text', content: 'Text' }] },
      { heading: 'Chapter', blocks: [
        { type: 'alert', variant: 'info', content: 'Alert' },
        { type: 'note', highlight: true, content: 'Note' },
        { type: 'image', path: 'x.png', alt: 'Alt', caption: 'Caption' },
        { type: 'link', label: 'Inside', url: '/admin' },
        { type: 'link', label: 'Outside', url: 'https://example.com', external: true },
        { type: 'list', items: ['One', 'Two'] },
        { type: 'list', ordered: true, items: ['First'] },
        { type: 'grid', cards: [{ title: 'Card', text: 'Card text' }] },
        { type: 'flow', steps: [{ label: 'Step', text: 'Step text', active: true }] },
      ] },
    ],
  });

  beforeEach(() => {
    ctx = createAdminTestContext();
    service = jasmine.createSpyObj<KnowledgeBaseService>('KnowledgeBaseService', ['menu', 'page']);
    service.page.and.callFake((id: string, lang: string) => of(id === 'guide' ? page(lang) : null));
    params$ = new BehaviorSubject(convertToParamMap({ pageId: 'guide' }));
    TestBed.configureTestingModule({
      imports: [KbArticleComponent],
      providers: [...ctx.providers, provideRouter([]), { provide: KnowledgeBaseService, useValue: service },
        { provide: ActivatedRoute, useValue: { paramMap: params$ } }],
    });
    fixture = TestBed.createComponent(KbArticleComponent);
    article = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The page renders every block type in the current language; a language switch
   *   loads the page again; the breadcrumb is root / group / page.
   * @input pageId 'guide' in cz; setLanguage('en').
   * @output page('guide', 'cz'); all texts rendered, external link target _blank, image under
   *   /assets/kb/; then page('guide', 'en') and 'Header en'; breadcrumb parts.
   */
  it('renders the page of the route in the current language', () => {
    expect(service.page).toHaveBeenCalledWith('guide', 'cz');
    const el: HTMLElement = fixture.nativeElement;
    for (const text of ['Header cz', 'Lead', 'Text', 'Chapter', 'Alert', 'Note', 'Caption', 'Inside', 'Outside', 'One', 'First', 'Card text', 'Step text']) {
      expect(el.textContent).withContext(text).toContain(text);
    }
    expect(el.querySelector('a[target="_blank"]')!.getAttribute('href')).toBe('https://example.com');
    expect(el.querySelector('img')!.getAttribute('src')).toBe('/assets/kb/x.png');
    expect(el.querySelector('.flow-item.active')).not.toBeNull();

    ctx.i18n.setLanguage('en');
    fixture.detectChanges();
    expect(service.page).toHaveBeenCalledWith('guide', 'en');
    expect(el.querySelector('h1')!.textContent).toBe('Header en');
    expect(article.breadcrumb).toBe('knowledge-base.breadcrumb_root / knowledge-base.nav_group_core / Guide en');
  });

  /**
   * @description A missing or not allowed page shows "not found" (no breadcrumb); nothing is
   *   shown while the page is still loading; destroy ends the subscriptions.
   * @input pageId 'missing'; no pageId; a pending request; destroy + new route.
   * @output page null + not-found text; loading true without the text; no call after destroy.
   */
  it('shows the not-found state only after loading', () => {
    params$.next(convertToParamMap({ pageId: 'missing' }));
    fixture.detectChanges();
    expect(article.page).toBeNull();
    expect(article.breadcrumb).toBe('');
    expect(fixture.nativeElement.textContent).toContain('knowledge-base.page_not_found');

    params$.next(convertToParamMap({}));
    expect(service.page).toHaveBeenCalledWith('', 'cz');

    const pending = new Subject<KBPage | null>();
    service.page.and.returnValue(pending);
    params$.next(convertToParamMap({ pageId: 'slow' }));
    fixture.detectChanges();
    expect(article.loading).toBeTrue();
    expect(fixture.nativeElement.textContent).not.toContain('knowledge-base.page_not_found');

    fixture.destroy();
    service.page.calls.reset();
    params$.next(convertToParamMap({ pageId: 'guide' }));
    expect(service.page).not.toHaveBeenCalled();
  });
});
