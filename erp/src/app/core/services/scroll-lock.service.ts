/**
 * @file scroll-lock.service.ts
 * @path src/app/core/services/scroll-lock.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Centralizovaný, sdílený zámek scrollu na pozadí pro všechny modální/
 * overlay komponenty (export popup, import popup, form builder, details builder,
 * graph builder, confirm dialog, atd.). Používá referenční počítadlo (ne prosté
 * true/false) - pokud je otevřeno víc overlayů zároveň, scroll se odemkne až po
 * zavření TOHO POSLEDNÍHO.
 * @refactor-note (2026-08-31) SJEDNOCENÍ MECHANISMU: dřív každá komponenta zamykala
 * scroll nezávisle, dvěma různými technikami - buď prostým `document.body.style.overflow
 * = 'hidden'` (ConfirmDialogComponent, DetailsBuilderComponent, FormBuilderComponent,
 * ExportPopupBuilderComponent), nebo `position: fixed` pinningem s uložením/obnovením
 * `window.scrollY` (GraphBuilderComponent - viz jeho `lockBackgroundScroll()`/
 * `unlockBackgroundScroll()`, bugfix-note 2026-08-27v9: `overflow:hidden` samo o sobě
 * nezastaví scroll-chaining z vnořeného scrollovatelného panelu). Kombinace obou
 * technik napříč SOUČASNĚ otevřenými overlayi (např. confirm dialog nad graph
 * builderem) vedla k nekonzistentnímu chování. Tahle služba používá VŽDY `position:
 * fixed` pinning (robustnější varianta) a je JEDINÝM místem, které smí měnit
 * `document.body.style` kvůli scroll locku - všechny komponenty níže na ni deleguj í.
 * @usage V `ngOnInit()`/imperativním `show()`: `this.scrollLock.lock()`.
 *        V `ngOnDestroy()`/imperativním `hide()`: `this.scrollLock.unlock()`.
 *        Každé volání `lock()` MUSÍ mít odpovídající `unlock()`.
 */
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ScrollLockService {
  private count = 0;
  private savedScrollY = 0;

  lock(): void {
    this.count++;
    if (this.count === 1) {
      this.savedScrollY = window.scrollY;
      const body = document.body.style;
      body.position = 'fixed';
      body.top = `-${this.savedScrollY}px`;
      body.left = '0';
      body.right = '0';
      body.width = '100%';
    }
  }

  unlock(): void {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      const body = document.body.style;
      body.position = '';
      body.top = '';
      body.left = '';
      body.right = '';
      body.width = '';
      window.scrollTo(0, this.savedScrollY);
    }
  }
}