import { Component, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';

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

  /**
   * @description IDs of the sections in the order they appear on the page - the single source of
   * truth of the left side list ("scrollspy") and of the computation which section is "active"
   * by the scroll position. Must match the `id` attributes of the <section> elements of the
   * template.
   */
  private readonly sectionIds: string[] = [
    'kb-security', 'kb-legal', 'kb-admin', 'kb-uiux', 'kb-database',
    'kb-api', 'kb-hosting', 'kb-deployment', 'kb-performance', 'kb-support', 'kb-glossary'
  ];

  /**
   * @description ID of the currently "active" section (highlighted in the left list) - computed
   * from the scroll position, see `recomputeActiveSection()`. The default (before the first
   * scroll) is derived from the URL fragment (#kb-...), otherwise the first section.
   */
  activeSectionId: string = (typeof window !== 'undefined' && window.location.hash)
    ? window.location.hash.replace('#', '')
    : 'kb-security';

  /**
   * @note `inject()` instead of a constructor parameter - the component has no own constructor
   * (it delegates to `BasePublicComponent`), so nothing changes in the inheritance / `super()`
   * call.
   */
  private cd = inject(ChangeDetectorRef);

  /** @description Prevents running the computation more than once per animation frame on fast scrolling. */
  private scrollTicking = false;

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
   * @description Finds the last section whose top edge already "passed" the threshold (matches the
   * `scroll-margin-top` of the sections in CSS) - the section the user is reading now. Simple and
   * cheap (a few `getBoundingClientRect()` calls on a small, fixed number of sections).
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

    if (current !== this.activeSectionId) {
      this.activeSectionId = current;
      this.cd.markForCheck();
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
      // Updates the URL fragment without another navigation jump of the browser.
      history.replaceState(null, '', `#${targetId}`);
    }
  }
}