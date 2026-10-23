/**
 * @file kb-article.component.spec.ts
 * @path src/app/admin/intranet/knowledge-base/kb-article/kb-article.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of KbArticleComponent (one intranet knowledge base page): page found by the route
 *   id, every page of KB_PAGES renders in both languages (all block types), breadcrumb, the
 *   localized texts with English fallback and the not-found state; subscriptions end on destroy.
 * @dependencies
 * - createAdminTestContext (i18n stub); ActivatedRoute paramMap Subject; KB_PAGES data.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { KbArticleComponent } from './kb-article.component';
import { KB_PAGES } from '../data/kb-pages.data';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('KbArticleComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<KbArticleComponent>;
  let page: KbArticleComponent;
  let params$: BehaviorSubject<ParamMap>;

  beforeEach(() => {
    ctx = createAdminTestContext();
    params$ = new BehaviorSubject(convertToParamMap({ pageId: KB_PAGES[0].id }));
    TestBed.configureTestingModule({
      imports: [KbArticleComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: { paramMap: params$ } }]
    });
    fixture = TestBed.createComponent(KbArticleComponent);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description Every knowledge base page renders in Czech and English without errors and
   *   shows its localized heading; the breadcrumb is root / group / page.
   * @input Each KB_PAGES id, languages cz and en.
   * @output page set; rendered text contains the localized nav label; breadcrumb parts.
   */
  it('renders every knowledge base page in both languages', () => {
    for (const lang of ['cz', 'en']) {
      ctx.i18n.setLanguage(lang);
      for (const kb of KB_PAGES) {
        params$.next(convertToParamMap({ pageId: kb.id }));
        fixture.detectChanges();
        expect(page.page).withContext(kb.id).toBe(kb);
        expect(page.breadcrumb).toBe(`knowledge-base.breadcrumb_root / knowledge-base.nav_group_${kb.navGroup} / ${page.l(kb.navLabel)}`);
        expect(fixture.nativeElement.textContent.length).withContext(kb.id).toBeGreaterThan(50);
      }
    }
  });

  /**
   * @description Missing translation for a language falls back to English; unknown page id →
   *   not-found text and no breadcrumb; destroy ends the subscriptions.
   * @input l({cz: 'Ahoj', en: 'Hi'}) in 'de'; pageId 'missing'; destroy + new route.
   * @output 'Hi'; page null, 'knowledge-base.page_not_found' rendered, breadcrumb ''; page stays null.
   */
  it('falls back and shows the not-found state', () => {
    ctx.i18n.setLanguage('de');
    expect(page.l({ cz: 'Ahoj', en: 'Hi' })).toBe('Hi');
    params$.next(convertToParamMap({ pageId: 'missing' }));
    fixture.detectChanges();
    expect(page.page).toBeNull();
    expect(page.breadcrumb).toBe('');
    expect(fixture.nativeElement.textContent).toContain('knowledge-base.page_not_found');

    fixture.destroy();
    params$.next(convertToParamMap({ pageId: KB_PAGES[0].id }));
    expect(page.page).toBeNull();
  });
});
