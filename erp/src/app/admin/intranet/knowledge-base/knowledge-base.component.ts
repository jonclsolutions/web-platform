/**
 * @file knowledge-base.component.ts
 * @path src/app/admin/intranet/knowledge-base/knowledge-base.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shell komponenta Knowledge Base - layout, responzivní menu, a GENEROVÁNÍ
 * bočního menu z `KB_PAGES` dat (viz kb-pages.data.ts). Přidání nové stránky do
 * KB_PAGES se v menu projeví automaticky, bez úpravy téhle komponenty nebo šablony.
 * @dependencies
 * - RouterModule: Nested routing (`:pageId` -> KbArticleComponent) + samostatná
 *   `support-form` route.
 * - KB_PAGES: Zdroj dat pro menu i obsah jednotlivých stránek.
 * - AdminLocalizationService: Statické i18n admin UI + jazyk pro rozřešení
 *   `LocalizedText` polí v KB_PAGES (navLabel).
 *
 * @bugfix-note (2026-10) Menu group headings showed "Cannot load text":
 * `navGroups` is a CACHED array (group labels are resolved once, inside
 * `buildNavGroups()`), but it was rebuilt only on `i18n.currentLanguage$`. That stream
 * says which language is SELECTED, not that its JSON is LOADED:
 * - on a page reload / direct URL entry the component is constructed while the JSON
 *   request is still pending, so every `t()` call returned the service fallback text,
 *   and nothing rebuilt the cache once the JSON arrived;
 * - on a language switch `currentLanguage$` emits BEFORE the new JSON is fetched, so
 *   the headings were rebuilt from the previous language's data.
 * Fix: rebuild on `i18n.translations$` instead - it emits the current state on
 * subscribe and again every time a language file finishes loading (or fails), which is
 * exactly when the cached labels become stale. `AdminLocalizationService` is unchanged.
 */

import { Component, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { KbFooterComponent } from './substitutions/kb-footer/kb-footer.component';
import { KB_PAGES } from './data/kb-pages.data';
import { KBPage, resolveLoc } from '../../../shared/interfaces/kb-content';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/** Jedna skupina v bočním menu se svými seřazenými stránkami. */
interface NavGroup {
  /** Stabilní identifikátor (KBNavGroupKey) - použit jako `track` klíč v šabloně. */
  key: string;
  /** Přeložený zobrazovaný název skupiny. */
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
  styleUrl: './knowledge-base.component.css'
})
export class KnowledgeBaseComponent implements OnDestroy {
  isMenuOpen = false;

  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('knowledge-base'); }
  public t(key: string): string { return this.i18n.getValue(`knowledge-base.${key}`); }

  /**
   * @description Cached menu model (groups + their sorted pages) bound by the template.
   * Rebuilt in the constructor subscription every time the translation data changes -
   * see bugfix-note (2026-10) in the file header.
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
   * would rebuild too early - see bugfix-note (2026-10) in the file header.
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
   * @description Aktuální jazyk pro rozřešení `LocalizedText` polí (`navLabel`).
   */
  get currentLang(): string {
    return this.i18n.getCurrentLanguage();
  }

  /** @description Zpřístupní `resolveLoc()` v šabloně pro `page.navLabel`. */
  navLabel(page: KBPage): string {
    return resolveLoc(page.navLabel, this.currentLang);
  }

  /**
   * @description Seskupí KB_PAGES podle `navGroup`, seřadí uvnitř skupiny podle
   * `navOrder` a skupiny samotné podle nejnižšího `navOrder` v nich obsaženém - tak,
   * aby přidání nové stránky s vlastním `navOrder` řídilo pořadí i bez ruční úpravy
   * pořadí skupin. Název skupiny se překládá přes `AdminLocalizationService`
   * (klíč `nav_group_{key}`, sekce 'knowledge-base').
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