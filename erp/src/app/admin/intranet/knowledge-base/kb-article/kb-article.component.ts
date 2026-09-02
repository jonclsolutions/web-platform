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
 */

import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { KB_PAGES } from '../data/kb-pages.data';
import { KBPage } from '../../../../shared/interfaces/kb-content';
@Component({
  selector: 'app-kb-article',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './kb-article.component.html',
  styleUrl: './kb-article.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KbArticleComponent implements OnInit {
  page: KBPage | null = null;

  constructor(
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // paramMap subscribe (ne snapshot) - stránka se dá přepnout i pouhou navigací mezi
    // dvěma :pageId routami stejné komponenty, Angular by ji jinak znovu nevytvořil.
    this.route.paramMap.subscribe(params => {
      const id = params.get('pageId');
      this.page = KB_PAGES.find(p => p.id === id) ?? null;
      this.cd.markForCheck();
    });
  }
}