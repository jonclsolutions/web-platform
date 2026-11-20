/**
 * @file kb-article.component.ts
 * @path src/app/admin/intranet/knowledge-base/kb-article/kb-article.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Generic renderer of ONE Knowledge Base page - takes `id` from the route parameter,
 * loads the page in the current admin language from the API (only the sections the user may see)
 * and renders it by `page.sections` / `block.type`. The ONLY component for ALL static manual
 * pages - a new page needs no new component, only a new entry in the JSON files of the API.
 * @dependencies
 * - ActivatedRoute: Reads the `:pageId` route parameter and the fragment (chapter `kb-s-N`).
 * - ElementRef: the scroll container of the manual (`.kb-main-content` of the shell) - a newly
 *   opened page starts at its top, or at the chapter of the fragment.
 * - KnowledgeBaseService: the page from the API (null = missing / not allowed).
 * - AdminLocalizationService: current language, breadcrumb texts.
 */

import { Component, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Subscription, combineLatest, map, switchMap, tap } from 'rxjs';
import { KBPage } from '../../../../shared/interfaces/kb-content';
import { KnowledgeBaseService } from '../knowledge-base.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';

@Component({
  selector: 'app-kb-article',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './kb-article.component.html',
  styleUrl: './kb-article.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KbArticleComponent implements OnDestroy {
  page: KBPage | null = null;
  /** The page is being loaded (no "not found" flash before the answer). */
  loading = true;

  public readonly i18n = inject(AdminLocalizationService);
  private readonly kb = inject(KnowledgeBaseService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Pending scroll after a render (cleared on destroy). */
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly subscriptions = new Subscription();

  /**
   * @description Loads the page of the route parameter in the current language - again after a
   *   navigation to another page or a language switch.
   */
  constructor(private route: ActivatedRoute, private cd: ChangeDetectorRef) {
    this.subscriptions.add(combineLatest([
      this.route.paramMap.pipe(map(params => params.get('pageId') ?? '')),
      this.i18n.currentLanguage$,
    ]).pipe(
      tap(() => { this.loading = true; this.cd.markForCheck(); }),
      switchMap(([id, lang]) => this.kb.page(id, lang)),
    ).subscribe(page => {
      this.page = page;
      this.loading = false;
      this.cd.markForCheck();
      this.scheduleScroll();
    }));
    // Breadcrumb / "not found" texts follow the admin texts.
    this.subscriptions.add(this.i18n.translations$.subscribe(() => this.cd.markForCheck()));
  }

  /**
   * @description Breadcrumb from the translated root, the group name and the menu label of the page.
   */
  get breadcrumb(): string {
    if (!this.page) return '';
    const root = this.i18n.getValue('knowledge-base.breadcrumb_root');
    const group = this.i18n.getValue(`knowledge-base.nav_group_${this.page.group}`);
    return `${root} / ${group} / ${this.page.navLabel}`;
  }

  /**
   * @description After the loaded page is rendered: jumps to the chapter of the URL fragment
   *   (`kb-s-N`), otherwise scrolls the manual to the top - the component is reused between pages,
   *   so without it a new page would open at the scroll position of the previous one.
   */
  private scheduleScroll(): void {
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null;
      const fragment = this.route.snapshot?.fragment;
      const target = fragment ? document.getElementById(fragment) : null;
      if (target && this.host.nativeElement.contains(target)) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
      const container = this.host.nativeElement.closest('.kb-main-content');
      container?.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  get notFoundText(): string {
    return this.i18n.getValue('knowledge-base.page_not_found');
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
  }
}
