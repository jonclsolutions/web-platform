/**
 * @file kb-article.component.ts
 * @path src/app/admin/intranet/knowledge-base/kb-article/kb-article.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Generic renderer of ONE Knowledge Base page - takes `id` from the route
 * parameter, finds the matching `KBPage` in `KB_PAGES` (see kb-pages.data.ts) and renders it
 * by `page.sections` / `block.type`. The ONLY component for ALL static manual pages - a new
 * page needs no new component, only a new entry in the data array.
 * @dependencies
 * - ActivatedRoute: Reads the `:pageId` route parameter.
 * - KB_PAGES: Static data of all manual pages.
 * - AdminLocalizationService: Language for resolving `LocalizedText` fields + breadcrumb prefix.
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
    // After switching the admin language, forces the OnPush component to re-evaluate the
    // `l()` / breadcrumb output - same pattern as TableBuilderComponent / GraphBuilderComponent.
    this.langSubscription = this.i18n.translations$.subscribe(() => this.cd.markForCheck());
  }

  get currentLang(): string {
    return this.i18n.getCurrentLanguage();
  }

  /** @description Resolves any `LocalizedText` field by the current language. */
  l(loc: LocalizedText): string {
    return resolveLoc(loc, this.currentLang);
  }

  /**
   * @description Builds the breadcrumb dynamically from the translated root, the group name and
   * the navLabel of the page.
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
    // paramMap subscribe (not snapshot) - the page can change by navigating between two
    // :pageId routes of the same component, Angular would not recreate it otherwise.
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