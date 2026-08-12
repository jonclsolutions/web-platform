import { Component, ChangeDetectionStrategy } from '@angular/core';
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
      // Aktualizuje URL fragment bez dalšího navigačního skoku prohlížeče.
      history.replaceState(null, '', `#${targetId}`);
    }
  }
}