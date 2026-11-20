/**
 * @file knowledge-base.component.ts
 * @path src/app/admin/intranet/knowledge-base/knowledge-base.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shell component of the Knowledge Base - own header (home = back to the
 * administration, admin language switcher), responsive side menu and the routed pages. The menu
 * comes from the API (`GET knowledge-base`) - only the pages the signed-in user may open, in the
 * current admin language; it is reloaded after a language switch. A page with chapters (its
 * headed sections) can be expanded in the menu - the page that is open is expanded by itself and
 * collapses again when another page opens, unless the user expanded it - and a
 * chapter link opens the page right at that chapter (fragment `kb-s-N`, see KbArticleComponent).
 * @dependencies
 * - KnowledgeBaseService: menu of the allowed pages.
 * - RouterModule: Nested routing (`:pageId` -> KbArticleComponent).
 * - AdminLocalizationService: Static i18n of the admin UI (section `knowledge-base`), current
 *   language, language switch (the same languages as the admin header).
 * - PublicDataService: site settings loaded at startup - the logo of the website (top left).
 */

import { Component, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter, switchMap } from 'rxjs';
import { KbFooterComponent } from './substitutions/kb-footer/kb-footer.component';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KBMenuItem } from '../../../shared/interfaces/kb-content';
import { AdminLanguageMeta, AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { PublicDataService } from '../../../shared/services/public-data.service';

/** One group of the side menu with its sorted pages. */
interface NavGroup {
  /** Stable identifier (KBNavGroupKey) - used as the `track` key in the template. */
  key: string;
  /** Translated display name of the group. */
  label: string;
  pages: KBMenuItem[];
}

/**
 * @description Layout shell of the internal Knowledge Base.
 * @usage Routed at `/admin/intranet/knowledge-base` (admin-routing.module.ts); child routes render
 *   inside its `<router-outlet>`.
 * @note Group headings come from the admin i18n JSON (section `knowledge-base`, keys
 *   `nav_group_{group}`); page labels from the API. Every group used in the API's structure.json
 *   therefore needs a matching key in EVERY admin language file.
 */
@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [RouterModule, KbFooterComponent],
  templateUrl: './knowledge-base.component.html',
  styleUrls: ['../../shared-styles/theme.css', './knowledge-base.component.css']
})
export class KnowledgeBaseComponent implements OnDestroy {
  isMenuOpen = false;
  isLangMenuOpen = false;

  public readonly i18n = inject(AdminLocalizationService);
  private readonly kb = inject(KnowledgeBaseService);
  private readonly publicData = inject(PublicDataService);
  public get strings(): any { return this.i18n.getMergedSection('knowledge-base'); }
  public t(key: string): string { return this.i18n.getValue(`knowledge-base.${key}`); }

  /** Languages of the switcher - the same as in the admin header. */
  readonly languages: AdminLanguageMeta[] = this.i18n.availableLanguages;

  /** Logo of the website (site settings), null = the neutral square. */
  logoUrl: string | null = null;

  /** Menu model (groups + their sorted pages) bound by the template. */
  navGroups: NavGroup[] = [];
  /** Last loaded menu - regrouped when only the texts of the admin UI change. */
  private menu: KBMenuItem[] = [];

  /** Pages whose chapters the user expanded in the menu. */
  private readonly opened = new Set<string>();
  /** Pages whose chapters the user collapsed (also the open page, which is otherwise expanded). */
  private readonly closed = new Set<string>();
  /** Id of the page that is open (null on the start page of the manual). */
  activePageId: string | null = null;
  /** Fragment of the current URL - the chapter that was opened (`kb-s-N`). */
  activeFragment: string | null = null;

  private readonly subscriptions = new Subscription();

  /**
   * @description Loads the menu for the current language (again after every language switch) and
   *   rebuilds the group headings whenever the admin texts change.
   */
  constructor(private router: Router, private cd: ChangeDetectorRef) {
    this.subscriptions.add(this.i18n.currentLanguage$
      .pipe(switchMap(lang => this.kb.menu(lang)))
      .subscribe(menu => {
        this.menu = menu;
        this.navGroups = this.buildNavGroups();
        this.cd.markForCheck();
      }));
    this.subscriptions.add(this.publicData.siteSettingsValue$.subscribe(data => {
      const path = data?.settings?.logo_path;
      this.logoUrl = path ? this.publicData.getStorageUrl(path) : null;
      this.cd.markForCheck();
    }));
    this.subscriptions.add(this.i18n.translations$.subscribe(() => {
      this.navGroups = this.buildNavGroups();
      this.cd.markForCheck();
    }));
    this.syncWithUrl();
    this.subscriptions.add(this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.syncWithUrl();
        this.cd.markForCheck();
      }));
  }

  /**
   * @description Reads the open page and chapter from the URL; a newly opened page shows its
   *   chapters even if the user collapsed them before.
   */
  private syncWithUrl(): void {
    const tree = this.router.parseUrl(this.router.url);
    const segments = tree.root.children['primary']?.segments.map(s => s.path) ?? [];
    const base = segments.indexOf('knowledge-base');
    this.activePageId = base >= 0 && segments.length > base + 1 ? segments[base + 1] : null;
    this.activeFragment = tree.fragment;
    if (this.activePageId) this.closed.delete(this.activePageId);
  }

  /**
   * @description Whether the chapters of a page are shown in the menu.
   * @param pageId Page id.
   */
  isExpanded(pageId: string): boolean {
    return !this.closed.has(pageId) && (this.opened.has(pageId) || pageId === this.activePageId);
  }

  /**
   * @description Shows or hides the chapters of a page in the menu.
   * @param pageId Page id.
   */
  toggleChapters(pageId: string): void {
    if (this.isExpanded(pageId)) {
      this.opened.delete(pageId);
      this.closed.add(pageId);
    } else {
      this.closed.delete(pageId);
      this.opened.add(pageId);
    }
  }

  /**
   * @description A chapter link was clicked: closes the mobile menu; on the page that is already
   *   open it scrolls to the chapter at once (the router does not navigate to the same address
   *   again and does not reload the page). Another page jumps to the chapter after it loads.
   * @param pageId Page of the chapter.
   * @param anchor Index of the chapter section.
   */
  openChapter(pageId: string, anchor: number): void {
    this.closeMenu();
    if (pageId !== this.activePageId) return;
    document.getElementById(`kb-s-${anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get currentLanguageCode(): string {
    return this.i18n.getCurrentLanguage();
  }

  get currentLanguageMeta(): AdminLanguageMeta | undefined {
    return this.languages.find(l => l.code === this.currentLanguageCode);
  }

  toggleLangMenu(): void {
    this.isLangMenuOpen = !this.isLangMenuOpen;
  }

  closeLangMenu(): void {
    this.isLangMenuOpen = false;
  }

  /**
   * @description Switches the admin language (the whole administration, as in its header).
   * @param code Language code.
   */
  selectLanguage(code: string): void {
    this.i18n.setLanguage(code);
    this.isLangMenuOpen = false;
  }

  /**
   * @description Groups the menu by `group`, sorts inside a group by `order` and the groups by
   *   the lowest `order` they contain. The group name is translated (key `nav_group_{group}`).
   */
  private buildNavGroups(): NavGroup[] {
    const groups = new Map<string, KBMenuItem[]>();
    for (const page of this.menu) {
      if (!groups.has(page.group)) groups.set(page.group, []);
      groups.get(page.group)!.push(page);
    }

    return Array.from(groups.entries())
      .map(([key, pages]) => ({
        key,
        label: this.t(`nav_group_${key}`),
        pages: pages.slice().sort((a, b) => a.order - b.order)
      }))
      .sort((a, b) => Math.min(...a.pages.map(p => p.order)) - Math.min(...b.pages.map(p => p.order)));
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  isRootPath(): boolean {
    return this.router.url === '/admin/intranet/knowledge-base';
  }
}
