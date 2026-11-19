/**
 * @file knowledge-base.component.ts
 * @path src/app/apps/web/public/knowledge-base/knowledge-base.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Knowledge base page of the public web (/knowledge-base): the introduction (main
 *   heading + first text) and the blocks - heading, text, optional sub-blocks (smaller heading +
 *   text) and an optional image at the end of the block - with a side list of the blocks
 *   (desktop, "scrollspy") / pills (mobile) and the call to action at the end. The content comes
 *   from the database (admin: web/edit-website, tab Knowledge base) in all languages; the call to
 *   action and the footer link from the `knowledge-base` translations.
 * @note A text missing in the current language shows 'Cannot load text'. Texts are plain text -
 *   their line breaks are kept (CSS `white-space: pre-line`), never HTML.
 * @dependencies
 * - BasePublicComponent (translations, current language), WebContentService (the content),
 *   PublicDataService (URL of an image).
 */

import { Component, ChangeDetectionStrategy, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BasePublicComponent } from '../../../../public/base-public.component';
import { WebContentService, localizedText } from '../web-content.service';

/** One block of the page in the current language. */
export interface KbBlockView {
  /** Element id of the block (`kb-{id}`) - anchor of the side list. */
  anchor: string;
  heading: string;
  text: string;
  items: { title: string; text: string }[];
  /** URL of the image at the end of the block, null = none. */
  image: string | null;
}

@Component({
  selector: 'app-knowledge-base',
  templateUrl: './knowledge-base.component.html',
  styleUrl: './knowledge-base.component.css',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KnowledgeBaseComponent extends BasePublicComponent {

  protected readonly translationKey = 'knowledge-base';

  private readonly webContent = inject(WebContentService);

  /** Introduction of the page in the current language (null until loaded / when there is none). */
  intro: { heading: string; text: string } | null = null;
  /** Shown blocks in the current language. */
  blocks: KbBlockView[] = [];
  /** The content was loaded (an empty knowledge base shows nothing instead of a loader). */
  loaded = false;

  /**
   * @description ID of the currently "active" block (highlighted in the left list) - computed
   * from the scroll position, see `recomputeActiveSection()`. Until the content is loaded it is
   * the URL fragment (#kb-...), afterwards the first block when the fragment is not one of them.
   */
  activeSectionId: string = (typeof window !== 'undefined' && window.location.hash)
    ? window.location.hash.replace('#', '')
    : '';

  /** @description Prevents running the computation more than once per animation frame on fast scrolling. */
  private scrollTicking = false;

  /** @description Element ids of the blocks in the order of the page (scrollspy). */
  private get sectionIds(): string[] {
    return this.blocks.map(block => block.anchor);
  }

  /** @description Loads the content and follows the current language. */
  protected override onInit(): void {
    combineLatest([this.webContent.knowledgeBase(), this.currentLanguage$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([sections, lang]) => {
        const rows = Array.isArray(sections) ? sections : [];
        const intro = rows.find(section => section.intro);
        this.intro = intro ? { heading: localizedText(intro.heading, lang), text: localizedText(intro.text, lang) } : null;
        this.blocks = rows.filter(section => !section.intro).map(section => ({
          anchor: `kb-${section.id}`,
          heading: localizedText(section.heading, lang),
          text: localizedText(section.text, lang),
          items: (section.items ?? []).map(item => ({ title: localizedText(item.title, lang), text: localizedText(item.text, lang) })),
          image: section.image ? this.publicDataService.getStorageUrl(section.image) : null,
        }));
        if (!this.sectionIds.includes(this.activeSectionId)) {
          this.activeSectionId = this.sectionIds[0] ?? '';
        }
        this.loaded = true;
        this.cdr.markForCheck();
      });
  }

  /**
   * @description Watches the window scroll and recomputes which section is "active" - see
   * `recomputeActiveSection()`. Angular unregisters the `@HostListener` binding automatically on
   * destroy, so no `ngOnDestroy()` is needed (and no risk of overriding a clean-up of
   * `BasePublicComponent`).
   */
  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.scrollTicking) return;
    this.scrollTicking = true;
    requestAnimationFrame(() => {
      this.recomputeActiveSection();
      this.scrollTicking = false;
    });
  }

  /**
   * @description Finds the last block whose top edge already "passed" the threshold (matches the
   * `scroll-margin-top` of the sections in CSS) - the block the user is reading now. Simple and
   * cheap (a few `getBoundingClientRect()` calls on the blocks of the page).
   */
  private recomputeActiveSection(): void {
    const threshold = 110;
    let current = this.sectionIds[0];

    for (const id of this.sectionIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.getBoundingClientRect().top - threshold <= 0) {
        current = id;
      } else {
        break;
      }
    }

    if (current !== undefined && current !== this.activeSectionId) {
      this.activeSectionId = current;
      this.cdr.markForCheck();
    }
  }

  /**
   * @description Manually scrolls to a section by id with guaranteed smooth
   *   behavior. Angular's built-in anchorScrolling (ViewportScroller) calls
   *   scrollIntoView() without smooth options and can override CSS
   *   scroll-behavior, causing an instant jump instead of an animated scroll.
   *   This bypasses that by driving the scroll directly.
   * @param event Click event from the TOC link - prevented so the browser/router
   *   doesn't also perform its own (instant) jump.
   * @param targetId Element id to scroll to (without the leading '#').
   */
  scrollToSection(event: Event, targetId: string): void {
    event.preventDefault();
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.activeSectionId = targetId;
      this.cdr.markForCheck();
      // Updates the URL fragment without another navigation jump of the browser.
      history.replaceState(null, '', `#${targetId}`);
    }
  }
}