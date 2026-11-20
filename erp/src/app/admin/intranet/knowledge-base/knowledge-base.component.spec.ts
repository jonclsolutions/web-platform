/**
 * @file knowledge-base.component.spec.ts
 * @path src/app/admin/intranet/knowledge-base/knowledge-base.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of KnowledgeBaseComponent (the KB shell): the side menu built from the
 *   API menu (only the allowed pages), reloaded after a language switch, translated group
 *   headings; the header (logo of the website, home link, admin language switcher); mobile menu
 *   and the root path; expandable chapters of a page (the open page expands by itself, a chapter
 *   link opens the page at the chapter).
 * @dependencies
 * - createAdminTestContext (i18n stub with a language subject); KnowledgeBaseService stub.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { KnowledgeBaseComponent } from './knowledge-base.component';
import { KnowledgeBaseService } from './knowledge-base.service';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { KBMenuItem } from '../../../shared/interfaces/kb-content';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('KnowledgeBaseComponent (intranet)', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<KnowledgeBaseComponent>;
  let kb: KnowledgeBaseComponent;
  let service: jasmine.SpyObj<KnowledgeBaseService>;
  let settings$: BehaviorSubject<any>;

  const menu: KBMenuItem[] = [
    { id: 'shop-orders', group: 'shop', order: 40, label: 'Orders', sections: [{ anchor: 1, heading: '01. Statuses' }, { anchor: 3, heading: '02. Editing' }] },
    { id: 'contacts', group: 'general', order: 3, label: 'Contacts' },
    { id: 'introductions', group: 'general', order: 1, label: 'Intro' },
    { id: 'administrators', group: 'core', order: 22, label: 'Admins' },
  ];

  beforeEach(() => {
    ctx = createAdminTestContext();
    service = jasmine.createSpyObj<KnowledgeBaseService>('KnowledgeBaseService', ['menu', 'page']);
    service.menu.and.callFake((lang: string) => of(lang === 'en' ? menu : menu.slice(0, 2)));
    settings$ = new BehaviorSubject<any>(null);
    TestBed.configureTestingModule({
      imports: [KnowledgeBaseComponent],
      providers: [...ctx.providers, provideRouter([]), { provide: KnowledgeBaseService, useValue: service },
        { provide: PublicDataService, useValue: { siteSettingsValue$: settings$, getStorageUrl: (path: string) => `/storage/${path}` } }],
    });
    fixture = TestBed.createComponent(KnowledgeBaseComponent);
    kb = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The menu shows only the pages of the API answer, grouped and sorted (pages by
   *   order, groups by their lowest order), with translated group labels; a language switch
   *   loads the menu of that language.
   * @input menu of cz = [shop-orders, contacts]; setLanguage('en') (4 pages).
   * @output cz: groups general, shop; en: general [introductions, contacts], core, shop; labels
   *   'knowledge-base.nav_group_<key>'; links rendered.
   */
  it('builds the menu of the allowed pages per language', () => {
    expect(service.menu).toHaveBeenCalledWith('cz');
    expect(kb.navGroups.map(g => g.key)).toEqual(['general', 'shop']);

    ctx.i18n.setLanguage('en');
    fixture.detectChanges();
    expect(service.menu).toHaveBeenCalledWith('en');
    expect(kb.navGroups.map(g => g.key)).toEqual(['general', 'core', 'shop']);
    expect(kb.navGroups[0].pages.map(p => p.id)).toEqual(['introductions', 'contacts']);
    expect(kb.navGroups[0].label).toBe('knowledge-base.nav_group_general');
    const links = Array.from(fixture.nativeElement.querySelectorAll('.kb-nav a')).map((a: any) => a.textContent.trim());
    expect(links).toContain('1. Intro');
    expect(links).toContain('40. Orders');
  });

  /**
   * @description Header: the home link leads back to the administration; the language switcher
   *   lists the admin languages and switches the admin language; new texts regroup the menu;
   *   menu toggle / close; root path; destroy ends the subscriptions.
   * @input render; open the language menu, pick 'en'; translations$; toggles; urls; destroy.
   * @output home href '/admin'; options = admin languages; setLanguage('en'), menu closed; new
   *   groups array; menu states; root true / false; no rebuild after destroy.
   */
  it('has a home link, a language switcher and a mobile menu', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.kb-home-link')!.getAttribute('href')).toBe('/admin');

    (el.querySelector('.kb-lang-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const options = el.querySelectorAll('.kb-lang-option');
    expect(options.length).toBe(kb.languages.length);
    expect(kb.currentLanguageMeta?.code).toBe('cz');
    const en = Array.from(options).find(o => o.textContent!.includes(kb.languages.find(l => l.code === 'en')!.name)) as HTMLButtonElement;
    en.click();
    expect(ctx.i18n.setLanguage).toHaveBeenCalledWith('en');
    expect(kb.isLangMenuOpen).toBeFalse();
    kb.toggleLangMenu();
    kb.closeLangMenu();
    expect(kb.isLangMenuOpen).toBeFalse();

    const before = kb.navGroups;
    ctx.i18n.translations$.next({ changed: true });
    expect(kb.navGroups).not.toBe(before);

    kb.toggleMenu();
    expect(kb.isMenuOpen).toBeTrue();
    kb.closeMenu();
    expect(kb.isMenuOpen).toBeFalse();

    const url = spyOnProperty(TestBed.inject(Router), 'url', 'get').and.returnValue('/admin/intranet/knowledge-base');
    expect(kb.isRootPath()).toBeTrue();
    url.and.returnValue('/admin/intranet/knowledge-base/introductions');
    expect(kb.isRootPath()).toBeFalse();

    fixture.destroy();
    const after = kb.navGroups;
    ctx.i18n.translations$.next({ again: true });
    expect(kb.navGroups).toBe(after);
  });

  /**
   * @description Chapters: a page with chapters has a toggle that shows the indented chapter links
   *   (heading text, link to the page with the fragment kb-s-N); the open page expands by itself
   *   (also after the user collapsed it before), can be collapsed, and its opened chapter is
   *   highlighted; a chapter of the open page scrolls at once, a chapter of another page only
   *   navigates.
   * @input Menu cz (shop-orders with 2 chapters, contacts without); toggle; navigation to
   *   shop-orders#kb-s-3; openChapter on the open page and on another one.
   * @output one toggle; no chapters, then 2 links '01. Statuses' / '02. Editing' with
   *   href …/shop-orders#kb-s-1; collapsed again; after navigation expanded, activeFragment
   *   kb-s-3 highlighted; scrollIntoView smooth for the open page only; menu closed.
   */
  it('expands the chapters of a page and opens a chapter', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const toggles = el.querySelectorAll('.chapter-toggle');
    expect(toggles.length).toBe(1);
    expect(el.querySelector('.kb-chapters')).toBeNull();

    (toggles[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    const links = Array.from(el.querySelectorAll('a.kb-chapter')) as HTMLAnchorElement[];
    expect(links.map(a => a.textContent!.trim())).toEqual(['01. Statuses', '02. Editing']);
    expect(links[0].getAttribute('href')).toContain('shop-orders#kb-s-1');
    kb.toggleChapters('shop-orders');
    fixture.detectChanges();
    expect(el.querySelector('.kb-chapters')).toBeNull();

    const router = TestBed.inject(Router);
    router.resetConfig([{ path: 'admin/intranet/knowledge-base/:pageId', children: [] }]);
    await router.navigateByUrl('/admin/intranet/knowledge-base/shop-orders#kb-s-3');
    fixture.detectChanges();
    expect(kb.activePageId).toBe('shop-orders');
    expect(kb.activeFragment).toBe('kb-s-3');
    expect(kb.isExpanded('shop-orders')).toBeTrue();
    expect(el.querySelector('a.kb-chapter.active-chapter')!.textContent!.trim()).toBe('02. Editing');
    kb.toggleChapters('shop-orders');
    expect(kb.isExpanded('shop-orders')).toBeFalse();
    kb.toggleChapters('shop-orders');
    expect(kb.isExpanded('shop-orders')).toBeTrue();

    const target = document.createElement('section');
    target.id = 'kb-s-1';
    document.body.appendChild(target);
    const intoView = spyOn(target, 'scrollIntoView');
    kb.isMenuOpen = true;
    kb.openChapter('shop-orders', 1);
    expect(intoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(kb.isMenuOpen).toBeFalse();
    intoView.calls.reset();
    kb.openChapter('contacts', 1);
    expect(intoView).not.toHaveBeenCalled();
    target.remove();
  });

  /**
   * @description Top left: the logo of the website from the site settings; without one (or before
   *   the settings load) the neutral square.
   * @input settings null; then logo_path 'site-logos/logo.png'; then without a logo.
   * @output .logo-square; img /storage/site-logos/logo.png; .logo-square again.
   */
  it('shows the logo of the website', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.logo-square')).not.toBeNull();
    settings$.next({ settings: { logo_path: 'site-logos/logo.png' } });
    fixture.detectChanges();
    expect(el.querySelector('.kb-logo')!.getAttribute('src')).toBe('/storage/site-logos/logo.png');
    settings$.next({ settings: { logo_path: null } });
    fixture.detectChanges();
    expect(el.querySelector('.kb-logo')).toBeNull();
  });
});
