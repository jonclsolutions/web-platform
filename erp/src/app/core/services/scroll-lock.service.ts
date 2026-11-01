/**
 * @file scroll-lock.service.ts
 * @path src/app/core/services/scroll-lock.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Centralized shared background scroll lock for all modal / overlay components
 * (export popup, import popup, form builder, details builder, graph builder, confirm dialog,
 * ...). Uses a reference counter (not a plain true / false) - with several overlays open at
 * once, scrolling is unlocked only after THE LAST one closes.
 * @usage In `ngOnInit()` / an imperative `show()`: `this.scrollLock.lock()`.
 *        In `ngOnDestroy()` / an imperative `hide()`: `this.scrollLock.unlock()`.
 *        Every `lock()` call MUST have a matching `unlock()`.
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