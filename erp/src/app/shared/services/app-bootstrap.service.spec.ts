/**
 * @file app-bootstrap.service.spec.ts
 * @path src/app/shared/services/app-bootstrap.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AppBootstrapService (APP_INITIALIZER): texts of the public area of
 *   the first URL + site settings (logo preloaded) in parallel, legal docs prefetched only on a
 *   public page (not in the admin / sign-in), and the hover disabling on narrow screens (restored on resize,
 *   applied to lazily injected styles, unreadable cross-origin sheets skipped).
 * @dependencies
 * - LocalizationService / PublicDataService / LegalDocsService spies; window.innerWidth spied;
 *   test <style> elements removed after each test.
 */

import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AppBootstrapService } from './app-bootstrap.service';
import { LocalizationService } from './localization.service';
import { PublicDataService } from './public-data.service';
import { LegalDocsService } from './legal-docs.service';
import { requiresApps } from '../../../testing/requires-apps';

describe('AppBootstrapService', () => {
  let service: AppBootstrapService;
  let localization: jasmine.SpyObj<LocalizationService>;
  let publicData: jasmine.SpyObj<PublicDataService>;
  let legal: jasmine.SpyObj<LegalDocsService>;
  let width: jasmine.Spy;
  let path: jasmine.Spy;
  const styles: HTMLStyleElement[] = [];

  /** Adds a style element with one hover rule and returns that rule. */
  function hoverRule(selector: string): CSSStyleRule {
    const el = document.createElement('style');
    el.textContent = `${selector}:hover { color: red; }`;
    document.head.appendChild(el);
    styles.push(el);
    return el.sheet!.cssRules[0] as CSSStyleRule;
  }

  beforeEach(() => {
    localization = jasmine.createSpyObj('LocalizationService', ['initTranslations', 'getCurrentLanguage']);
    localization.initTranslations.and.resolveTo({});
    localization.getCurrentLanguage.and.returnValue('en');
    publicData = jasmine.createSpyObj('PublicDataService', ['getSiteSettings', 'setCachedSettings', 'getStorageUrl']);
    publicData.getSiteSettings.and.returnValue(of({ settings: {} }));
    legal = jasmine.createSpyObj('LegalDocsService', ['preload']);
    legal.preload.and.resolveTo();
    width = spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1200);

    TestBed.configureTestingModule({
      providers: [
        { provide: LocalizationService, useValue: localization },
        { provide: PublicDataService, useValue: publicData },
        { provide: LegalDocsService, useValue: legal }
      ]
    });
    service = TestBed.inject(AppBootstrapService);
    path = spyOn(service as any, 'currentPath').and.returnValue('/shop/cart');
  });
  afterEach(() => styles.splice(0).forEach(el => el.remove()));

  /**
   * @description A public page: the texts of its area (the application whose public path the URL
   *   starts with, the root area otherwise), settings cached, GDPR + TOS prefetched in the current
   *   language; a logo is preloaded (resolves even when the image fails).
   * @input URLs '/shop/cart' and '/contact'; settings with logo_path 'logo.png'.
   * @output initTranslations('shop') / ('web'); setCachedSettings(data); getStorageUrl('logo.png');
   *   preload('gdpr','en') + preload('tos','en').
   */
  it('initializes the texts of the public area, settings and legal docs', async () => {
    requiresApps('web', 'shop');
    const data = { settings: { logo_path: 'logo.png' } };
    publicData.getSiteSettings.and.returnValue(of(data));
    publicData.getStorageUrl.and.returnValue('/missing-test-logo.png');

    await service.init();
    expect(localization.initTranslations).toHaveBeenCalledWith('shop');
    expect(publicData.setCachedSettings).toHaveBeenCalledWith(data);
    expect(publicData.getStorageUrl).toHaveBeenCalledWith('logo.png');
    expect(legal.preload.calls.allArgs()).toEqual([['gdpr', 'en'], ['tos', 'en']]);

    path.and.returnValue('/contact');
    await service.init();
    expect(localization.initTranslations).toHaveBeenCalledWith('web');
  });

  /**
   * @description The admin and the sign-in pages load no public texts and no legal documents;
   *   failing settings are logged, the app still starts; a failing prefetch is swallowed.
   * @input URLs '/admin/core/logs' and '/auth/login'; then '/' with settings error + preload rejecting.
   * @output No initTranslations, no preload; then preload called, console.error, init resolves.
   *   The root URL belongs to the web (requiresApps).
   */
  it('skips the admin and survives failing requests', async () => {
    requiresApps('web');
    for (const url of ['/admin/core/logs', '/auth/login']) {
      path.and.returnValue(url);
      await service.init();
    }
    expect(localization.initTranslations).not.toHaveBeenCalled();
    expect(legal.preload).not.toHaveBeenCalled();

    spyOn(console, 'error');
    publicData.setCachedSettings.calls.reset();
    path.and.returnValue('/');
    publicData.getSiteSettings.and.returnValue(throwError(() => new Error('down')));
    legal.preload.and.rejectWith(new Error('x'));
    await expectAsync(service.init()).toBeResolved();
    expect(legal.preload).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalled();
    expect(publicData.setCachedSettings).not.toHaveBeenCalled();
  });

  /**
   * @description Narrow screen: hover declarations are emptied; widening restores them on
   *   resize; a style tag added later is processed after the next microtask.
   * @input width 800 + init; resize to 1200; width 800 + resize; new style injected.
   * @output '' → 'color: red;' → '' ; the new rule emptied too.
   */
  it('disables hover styles on narrow screens', fakeAsync(() => {
    const rule = hoverRule('.bootstrap-test-a');
    const plain = document.createElement('style');
    plain.textContent = '.bootstrap-test-plain { color: blue; }';
    document.head.appendChild(plain);
    styles.push(plain);

    width.and.returnValue(800);
    service.init();
    flushMicrotasks();
    expect(rule.style.cssText).toBe('');
    expect((plain.sheet!.cssRules[0] as CSSStyleRule).style.cssText).toBe('color: blue;');

    width.and.returnValue(1200);
    window.dispatchEvent(new Event('resize'));
    expect(rule.style.cssText).toBe('color: red;');

    width.and.returnValue(800);
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    expect(rule.style.cssText).toBe('');
  }));

  /**
   * @description Style tags injected later (lazy-loaded component CSS) are processed once per
   *   batch after the MutationObserver fires; non-style nodes are ignored.
   * @input width 800 + init; two new hover styles + a div appended to <head>.
   * @output Both new rules emptied after the observer callback.
   */
  it('processes lazily injected styles', async () => {
    width.and.returnValue(800);
    await service.init();
    const late = hoverRule('.bootstrap-test-b');
    const later = hoverRule('.bootstrap-test-d');
    document.head.appendChild(document.createElement('div')).remove();
    expect(late.style.cssText).toBe('color: red;');

    await new Promise(resolve => setTimeout(resolve));
    expect(late.style.cssText).toBe('');
    expect(later.style.cssText).toBe('');
  });

  /**
   * @description A stylesheet whose rules cannot be read (cross-origin) is skipped.
   * @input document.styleSheets = [sheet throwing on cssRules, readable sheet with a hover rule].
   * @output No error; the readable hover rule is emptied.
   */
  it('skips unreadable stylesheets', fakeAsync(() => {
    const rule = hoverRule('.bootstrap-test-c');
    const blocked = {};
    Object.defineProperty(blocked, 'cssRules', { get: () => { throw new DOMException('SecurityError'); } });
    spyOnProperty(document, 'styleSheets', 'get').and.returnValue([blocked, rule.parentStyleSheet] as any);
    width.and.returnValue(800);

    service.init();
    flushMicrotasks();
    expect(rule.style.cssText).toBe('');
  }));
});
