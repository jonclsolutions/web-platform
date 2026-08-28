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
   * @description IDs jednotlivých sekcí v pořadí, v jakém se objevují na stránce -
   * jediný zdroj pravdy pro levý postranní seznam ("scrollspy") i pro výpočet, která
   * sekce je aktuálně "aktivní" podle pozice scrollu. Musí odpovídat `id` atributům
   * <section> elementů v šabloně.
   */
  private readonly sectionIds: string[] = [
    'kb-security', 'kb-legal', 'kb-admin', 'kb-uiux', 'kb-database',
    'kb-api', 'kb-hosting', 'kb-deployment', 'kb-performance', 'kb-support', 'kb-glossary'
  ];

  /**
   * @description ID aktuálně "aktivní" sekce (zvýrazněná v levém seznamu) - vypočtená
   * z pozice scrollu, viz `recomputeActiveSection()`. Výchozí hodnota (než uživatel
   * poprvé scrolluje) se zkusí odvodit z URL fragmentu (#kb-...), jinak první sekce.
   */
  activeSectionId: string = (typeof window !== 'undefined' && window.location.hash)
    ? window.location.hash.replace('#', '')
    : 'kb-security';

  /**
   * @note `inject()` místo přidání parametru do konstruktoru - komponenta zatím
   * žádný vlastní konstruktor nemá (deleguje na `BasePublicComponent`), takhle se
   * nemusí nic měnit na dědičnosti/volání `super()`.
   */
  private cd = inject(ChangeDetectorRef);

  /** @description Zabraňuje spouštění výpočtu vícekrát za jeden animační frame při rychlém scrollování. */
  private scrollTicking = false;

  /**
   * @description Sleduje scroll okna a přepočítává, která sekce je "aktivní" - viz
   * `recomputeActiveSection()`. `@HostListener` binding Angular automaticky odregistruje
   * při zániku komponenty, takže zde není potřeba žádný `ngOnDestroy()` (a tedy ani
   * riziko, že by přepsal případný cleanup z `BasePublicComponent`).
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
   * @description Najde poslední sekci, jejíž horní okraj už "prošel" prahovou hodnotou
   * (odpovídá `scroll-margin-top` sekcí v CSS) - tedy sekci, ve které se uživatel
   * aktuálně nachází při čtení. Jednoduchý, výkonově levný přístup (pár
   * `getBoundingClientRect()` volání na malém, pevném počtu sekcí).
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
      // Aktualizuje URL fragment bez dalšího navigačního skoku prohlížeče.
      history.replaceState(null, '', `#${targetId}`);
    }
  }
}