/**
 * @file kb-article.component.ts
 * @path src/app/admin/intranet/knowledge-base/kb-article/kb-article.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Generický renderer JEDNÉ stránky Knowledge Base - vezme `id` z route
 * parametru, dohledá odpovídající `KBPage` v `KB_PAGES` (viz kb-pages.data.ts) a
 * vykreslí ji podle `page.sections`/`block.type`. JEDINÁ komponenta pro VŠECHNY
 * statické stránky manuálu - přidání nové stránky nevyžaduje žádnou novou komponentu,
 * jen nový záznam v datovém poli.
 * @dependencies
 * - ActivatedRoute: Čte `:pageId` route parametr.
 * - KB_PAGES: Statická data všech stránek manuálu.
 * - AdminLocalizationService: Jazyk pro rozřešení `LocalizedText` polí + breadcrumb prefix.
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * `l(loc)` metoda rozřeší libovolné `LocalizedText` pole podle aktuálního admin
 * jazyka - volá se v šabloně pro KAŽDÝ textový blok (lead/text/alert/note/list/grid/
 * flow/image/link). Nejde o getter budující nová pole (žádné NG0956 riziko) - jen
 * čistá funkce vracející string, `@for` v šabloně trackuje podle `$index` na
 * NEMĚNNÉM `section.blocks`/`block.items` poli, takže časté volání `l()` nezpůsobuje
 * žádné zbytečné přebudování DOM. `breadcrumb` byl ODSTRANĚN z datového modelu -
 * skládá se tady dynamicky (`breadcrumb_root` + přeložený název skupiny + navLabel),
 * viz `breadcrumb` getter níže.
 */

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { KB_PAGES } from '../data/kb-pages.data';
import { KBPage, LocalizedText, resolveLoc } from '../../../../shared/interfaces/kb-content';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';

@Component({
  selector: 'app-kb-article',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './kb-article.component.html',
  styleUrl: './kb-article.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KbArticleComponent implements OnInit, OnDestroy {
  page: KBPage | null = null;

  public readonly i18n = inject(AdminLocalizationService);

  private routeSubscription?: Subscription;
  private langSubscription: Subscription;

  constructor(
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef
  ) {
    // Po přepnutí admin jazyka donutí OnPush komponentu přehodnotit `l()`/breadcrumb
    // výstupy - stejný vzor jako TableBuilderComponent/GraphBuilderComponent.
    this.langSubscription = this.i18n.translations$.subscribe(() => this.cd.markForCheck());
  }

  get currentLang(): string {
    return this.i18n.getCurrentLanguage();
  }

  /** @description Rozřeší libovolné `LocalizedText` pole podle aktuálního jazyka. */
  l(loc: LocalizedText): string {
    return resolveLoc(loc, this.currentLang);
  }

  /**
   * @description Skládá breadcrumb dynamicky z přeloženého kořene, názvu skupiny
   * a navLabel stránky - viz refactor-note v hlavičce souboru.
   */
  get breadcrumb(): string {
    if (!this.page) return '';
    const root = this.i18n.getValue('knowledge-base.breadcrumb_root');
    const group = this.i18n.getValue(`knowledge-base.nav_group_${this.page.navGroup}`);
    const label = this.l(this.page.navLabel);
    return `${root} / ${group} / ${label}`;
  }

  get notFoundText(): string {
    return this.i18n.getValue('knowledge-base.page_not_found');
  }

  ngOnInit(): void {
    // paramMap subscribe (ne snapshot) - stránka se dá přepnout i pouhou navigací mezi
    // dvěma :pageId routami stejné komponenty, Angular by ji jinak znovu nevytvořil.
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const id = params.get('pageId');
      this.page = KB_PAGES.find(p => p.id === id) ?? null;
      this.cd.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.langSubscription?.unsubscribe();
  }
}