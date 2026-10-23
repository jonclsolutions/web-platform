/**
 * @file cookie-consent.component.spec.ts
 * @path src/app/public/web-pages/cookie-consent/cookie-consent.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the cookie consent banner (GDPR / ePrivacy): shown until a valid consent
 *   exists, accept all / necessary only / custom settings saved through CookieConsentService,
 *   the settings panel pre-filled with the current choice and re-opened on request.
 * @dependencies
 * - createPublicPageContext; real CookieConsentService (localStorage key cleared around tests).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CookieConsentComponent } from './cookie-consent.component';
import { CookieConsentService } from '../../../shared/services/cookie-consent.service';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('CookieConsentComponent', () => {
  let fixture: ComponentFixture<CookieConsentComponent>;
  let consent: CookieConsentService;
  const t = { title: 'Cookies', btn_accept_all: 'Accept all', btn_necessary_only: 'Necessary', btn_settings: 'Settings', btn_save_settings: 'Save', btn_back: 'Back' };
  const visible = () => !!fixture.nativeElement.textContent.includes('Cookies');

  /** Creates the banner after the storage was prepared. */
  function create(): void {
    const ctx = createPublicPageContext({ translations: { cookie_consent: t } });
    TestBed.configureTestingModule({ imports: [CookieConsentComponent], providers: ctx.providers });
    consent = TestBed.inject(CookieConsentService);
    fixture = TestBed.createComponent(CookieConsentComponent);
    fixture.detectChanges();
  }

  beforeEach(() => localStorage.removeItem('rpsw_cookie_consent'));
  afterEach(() => localStorage.removeItem('rpsw_cookie_consent'));

  /**
   * @description No consent → banner shown; accept all stores everything and hides it.
   * @input Empty storage; acceptAll().
   * @output visible; consent all true; hidden.
   */
  it('asks for consent and accepts all', () => {
    create();
    expect(fixture.componentInstance.visible).toBeTrue();
    expect(visible()).toBeTrue();
    fixture.componentInstance.acceptAll();
    fixture.detectChanges();
    expect(consent.current!.analytics).toBeTrue();
    expect(consent.current!.marketing).toBeTrue();
    expect(visible()).toBeFalse();
  });

  /**
   * @description "Necessary only" refuses every optional category.
   * @input rejectNonEssential().
   * @output functional / analytics / marketing false; hidden.
   */
  it('stores necessary cookies only', () => {
    create();
    fixture.componentInstance.rejectNonEssential();
    expect([consent.current!.functional, consent.current!.analytics, consent.current!.marketing]).toEqual([false, false, false]);
    expect(fixture.componentInstance.visible).toBeFalse();
  });

  /**
   * @description Existing valid consent → hidden; an "open settings" request shows the settings
   *   pre-filled with the stored choice; a custom selection is saved; toggling back closes the panel.
   * @input Stored {analytics true}; openSettings(); draft.marketing = true; saveSettings(); toggleSettings ×2.
   * @output Hidden; visible + showSettings + draft {analytics true}; stored marketing true; panel toggled.
   */
  it('re-opens the settings with the current choice', () => {
    localStorage.setItem('rpsw_cookie_consent', JSON.stringify({ necessary: true, functional: false, analytics: true, marketing: false, timestamp: new Date().toISOString(), version: 1 }));
    create();
    const banner = fixture.componentInstance;
    expect(banner.visible).toBeFalse();

    consent.openSettings();
    expect(banner.visible).toBeTrue();
    expect(banner.showSettings).toBeTrue();
    expect(banner.draft).toEqual({ functional: false, analytics: true, marketing: false });

    banner.toggleSettings();
    expect(banner.showSettings).toBeFalse();
    banner.toggleSettings();
    banner.draft.marketing = true;
    banner.saveSettings();
    expect(consent.current!.marketing).toBeTrue();
    expect(consent.current!.analytics).toBeTrue();
    expect(banner.visible).toBeFalse();
    expect(banner.showSettings).toBeFalse();
  });
});
