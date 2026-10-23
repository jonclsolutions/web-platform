/**
 * @file scroll-lock.service.spec.ts
 * @path src/app/core/services/scroll-lock.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ScrollLockService: reference-counted body lock (fixed position at
 *   the saved scroll offset), released only by the last unlock which restores the scroll; extra
 *   unlocks are harmless.
 * @dependencies
 * - window.scrollY getter and window.scrollTo spied; body styles reset after each test.
 */

import { TestBed } from '@angular/core/testing';
import { ScrollLockService } from './scroll-lock.service';

describe('ScrollLockService', () => {
  let service: ScrollLockService;
  const body = () => document.body.style;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScrollLockService);
    spyOnProperty(window, 'scrollY', 'get').and.returnValue(120);
    spyOn(window, 'scrollTo');
  });
  afterEach(() => document.body.removeAttribute('style'));

  /**
   * @description Two locks need two unlocks; the last restores styles and scroll position.
   * @input lock(); lock(); unlock(); unlock(); unlock().
   * @output fixed at top -120px; still fixed after 1st unlock; cleared + scrollTo(0, 120) once.
   */
  it('locks once and restores on the last unlock', () => {
    service.lock();
    service.lock();
    expect(body().position).toBe('fixed');
    expect(body().top).toBe('-120px');
    expect(body().width).toBe('100%');

    service.unlock();
    expect(body().position).toBe('fixed');
    expect(window.scrollTo).not.toHaveBeenCalled();

    service.unlock();
    expect(body().position).toBe('');
    expect(body().top).toBe('');
    expect(window.scrollTo).toHaveBeenCalledOnceWith(0, 120);

    service.unlock();
    service.lock();
    expect(body().position).toBe('fixed');
  });
});
