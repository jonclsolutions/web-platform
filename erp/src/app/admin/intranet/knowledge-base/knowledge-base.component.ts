/**
 * @file knowledge-base.component.ts
 * @path src/app/admin/intranet/knowledge-base/knowledge-base.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shell component of the Knowledge Base - layout, responsive menu and GENERATION
 * of the side menu from the `KB_PAGES` data (see kb-pages.data.ts). A new page in KB_PAGES
 * shows in the menu automatically, without changing this component or its template.
 * @dependencies
 * - RouterModule: Nested routing (`:pageId` -> KbArticleComponent) + the separate
 *   `support-form` route.
 * - KB_PAGES: Data source of the menu and of the page content.
 * - AdminLocalizationService: Static i18n of the admin UI + language for resolving the
 *   `LocalizedText` fields of KB_PAGES (navLabel).
 */

import { Component, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { KbFooterComponent } from './substitutions/kb-footer/kb-footer.component';
import { KB_PAGES } from './data/kb-pages.data';
import { KBPage, resolveLoc } from '../../../shared/interfaces/kb-content';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/** One group of the side menu with its sorted pages. */
interface NavGroup {
  /** Stable identifier (KBNavGroupKey) - used as the `track` key in the template. */
  key: string;
  /** Translated display name of the group. */
  label: string;
  pages: KBPage[];
}

/**
 * @description Layout shell of the internal Knowledge Base: renders the side menu
 * generated from `KB_PAGES` and hosts the routed article / support-form / news pages.
 * @usage Routed at `/admin/intranet/knowledge-base` (admin-routing.module.ts); child
 * routes render inside its `<router-outlet>`.
 * @note Group headings come from the admin i18n JSON (section `knowledge-base`, keys
 * `nav_group_{navGroup}`); page labels come from `KB_PAGES` (`LocalizedText`). Every
 * `navGroup` value used in `KB_PAGES` therefore needs a matching key in EVERY language
 * file, otherwise that heading shows the service fallback text.
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

  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('knowledge-base'); }
  public t(key: string): string { return this.i18n.getValue(`knowledge-base.${key}`); }

  /**
   * @description Cached menu model (groups + their sorted pages) bound by the template.
   * Rebuilt in the constructor subscription every time the translation data changes -
   *.
   */
  navGroups: NavGroup[] = [];

  /** Subscription to `i18n.translations$` that keeps `navGroups` in sync - released in ngOnDestroy. */
  private langSubscription: Subscription;

  /**
   * @description Wires the menu cache to the translation data.
   * @param router Used by `isRootPath()` to detect the Knowledge Base landing URL.
   * @param cd Marks the view dirty after the cached menu model is replaced.
   * @note `translations$` is a BehaviorSubject stream, so the callback runs
   * synchronously on subscribe (initial build - no separate call needed) and again
   * whenever a language file finishes loading. Subscribing to `currentLanguage$` here
   * would rebuild too early.
   */
  constructor(private router: Router, private cd: ChangeDetectorRef) {
    this.langSubscription = this.i18n.translations$.subscribe(() => {
      this.navGroups = this.buildNavGroups();
      this.cd.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.langSubscription?.unsubscribe();
  }

  /**
   * @description Current language for resolving `LocalizedText` fields (`navLabel`).
   */
  get currentLang(): string {
    return this.i18n.getCurrentLanguage();
  }

  /** @description Exposes `resolveLoc()` to the template for `page.navLabel`. */
  navLabel(page: KBPage): string {
    return resolveLoc(page.navLabel, this.currentLang);
  }

  /**
   * @description Groups KB_PAGES by `navGroup`, sorts inside a group by `navOrder` and the groups
   * by the lowest `navOrder` they contain - so a new page with its own `navOrder` drives the
   * order without manually reordering the groups. The group name is translated through
   * `AdminLocalizationService` (key `nav_group_{key}`, section 'knowledge-base').
   */
  private buildNavGroups(): NavGroup[] {
    const groups = new Map<string, KBPage[]>();
    for (const page of KB_PAGES) {
      if (!groups.has(page.navGroup)) groups.set(page.navGroup, []);
      groups.get(page.navGroup)!.push(page);
    }

    return Array.from(groups.entries())
      .map(([key, pages]) => ({
        key,
        label: this.t(`nav_group_${key}`),
        pages: pages.slice().sort((a, b) => a.navOrder - b.navOrder)
      }))
      .sort((a, b) => Math.min(...a.pages.map(p => p.navOrder)) - Math.min(...b.pages.map(p => p.navOrder)));
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