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
 */

import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { KbFooterComponent } from './substitutions/kb-footer/kb-footer.component';
import { KB_PAGES } from './data/kb-pages.data';
import { KBPage } from '../../../shared/interfaces/kb-content';
/** Jedna skupina v bočním menu ("General", "Roles", "Web", ...) se svými seřazenými stránkami. */
interface NavGroup {
  name: string;
  pages: KBPage[];
}

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [RouterModule, KbFooterComponent],
  templateUrl: './knowledge-base.component.html',
  styleUrl: './knowledge-base.component.css'
})
export class KnowledgeBaseComponent {
  isMenuOpen = false;

  constructor(private router: Router) {}

  /**
   * @description Seskupí KB_PAGES podle `navGroup`, seřadí uvnitř skupiny podle
   * `navOrder` a skupiny samotné podle nejnižšího `navOrder` v nich obsaženém - tak,
   * aby přidání nové stránky s vlastním `navOrder` řídilo pořadí i bez ruční úpravy
   * pořadí skupin.
   */
  get navGroups(): NavGroup[] {
    const groups = new Map<string, KBPage[]>();
    for (const page of KB_PAGES) {
      if (!groups.has(page.navGroup)) groups.set(page.navGroup, []);
      groups.get(page.navGroup)!.push(page);
    }

    return Array.from(groups.entries())
      .map(([name, pages]) => ({
        name,
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