/**
 * @file knowledge-base.component.spec.ts
 * @path src/app/admin/intranet/knowledge-base/knowledge-base.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the intranet KnowledgeBaseComponent (layout + side menu): navigation groups
 *   built from KB_PAGES (pages sorted by navOrder, groups by their first page), rebuilt on
 *   translation changes, mobile menu toggle and the root path check.
 * @dependencies
 * - createAdminTestContext; Router url spied.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { KnowledgeBaseComponent } from './knowledge-base.component';
import { KB_PAGES } from './data/kb-pages.data';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('KnowledgeBaseComponent (intranet)', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<KnowledgeBaseComponent>;
  let kb: KnowledgeBaseComponent;

  beforeEach(() => {
    ctx = createAdminTestContext();
    TestBed.configureTestingModule({ imports: [KnowledgeBaseComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(KnowledgeBaseComponent);
    kb = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description Every page appears once, pages sorted inside a group, groups ordered by their
   *   lowest navOrder, translated labels; rendered menu has a link per page.
   * @input KB_PAGES.
   * @output page count equal; sorted orders; label 'knowledge-base.nav_group_<key>'; links rendered.
   */
  it('builds the navigation groups', () => {
    const pages = kb.navGroups.flatMap(g => g.pages);
    expect(pages.length).toBe(KB_PAGES.length);
    for (const group of kb.navGroups) {
      expect(group.label).toBe(`knowledge-base.nav_group_${group.key}`);
      const orders = group.pages.map(p => p.navOrder);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
    const firsts = kb.navGroups.map(g => Math.min(...g.pages.map(p => p.navOrder)));
    expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
    expect(kb.navLabel(KB_PAGES[0])).toBe(KB_PAGES[0].navLabel['cz']);
    expect(fixture.nativeElement.querySelectorAll('a').length).toBeGreaterThan(KB_PAGES.length);
  });

  /**
   * @description New translations rebuild the groups; menu toggle / close; root path; destroy unsubscribes.
   * @input translations$ next; toggleMenu ×2; closeMenu; url root / page; destroy + translations.
   * @output new array; open → closed; true / false; groups not rebuilt after destroy.
   */
  it('reacts to translations, the menu and the route', () => {
    const before = kb.navGroups;
    ctx.i18n.translations$.next({ changed: true });
    expect(kb.navGroups).not.toBe(before);

    kb.toggleMenu();
    expect(kb.isMenuOpen).toBeTrue();
    kb.closeMenu();
    expect(kb.isMenuOpen).toBeFalse();

    const url = spyOnProperty(TestBed.inject(Router), 'url', 'get').and.returnValue('/admin/intranet/knowledge-base');
    expect(kb.isRootPath()).toBeTrue();
    url.and.returnValue('/admin/intranet/knowledge-base/news');
    expect(kb.isRootPath()).toBeFalse();

    fixture.destroy();
    const after = kb.navGroups;
    ctx.i18n.translations$.next({ again: true });
    expect(kb.navGroups).toBe(after);
  });
});
