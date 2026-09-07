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
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * Komponenta NEdědí BaseDataComponent, proto ruční injection AdminLocalizationService.
 * `navGroups` byl PŮVODNĚ getter volaný Angularem při KAŽDÉM change-detection
 * průchodu (protože šablona ho čte v `@for`) - to by při každém volání stavělo NOVÉ
 * pole NOVÝCH objektů, což je přesně past popsaná u TableBuilderComponent (NG0956 /
 * nekonečná smyčka), i když zde `@for` trackuje podle stabilního `group.key`, takže
 * by k destrukci DOM nedošlo - přesto zbytečná práce na každý CD cyklus. Převedeno na
 * CACHOVANÉ pole `navGroups`, přepočítávané jen v konstruktoru a při reálné změně
 * jazyka (`i18n.currentLanguage$` subscribe) - stejný vzor jako user-request.component.ts.
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
   * @refactor-note (2026-09) Cachované pole místo getteru - viz hlavička souboru.
   * Naplněno v konstruktoru a znovu vždy při přepnutí admin jazyka.
   */
  navGroups: NavGroup[] = [];

  private langSubscription: Subscription;

  constructor(private router: Router, private cd: ChangeDetectorRef) {
    this.navGroups = this.buildNavGroups();

    this.langSubscription = this.i18n.currentLanguage$.subscribe(() => {
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