/**
 * @file cookie-consent.component.spec.ts
 * @path src/app/public/legal/cookie-consent/cookie-consent.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the cookie consent banner (GDPR / ePrivacy): shown until a valid consent
 *   exists, accept all / necessary only / custom settings saved through CookieConsentService,
 *   the settings panel pre-filled with the current choice and re-opened on request.
 * @dependencies
 * - createPublicPageContext; real CookieConsentService (localStorage key cleared around tests).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicTextEditorService } from '../../text-editor/public-text-editor.service';
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

  beforeEach(() => localStorage.removeItem('jsw_cookie_consent'));
  afterEach(() => localStorage.removeItem('jsw_cookie_consent'));

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
    localStorage.setItem('jsw_cookie_consent', JSON.stringify({ necessary: true, functional: false, analytics: true, marketing: false, timestamp: new Date().toISOString(), version: 1 }));
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

  /**
   * @description In the visual text editor of the admin the bar is never shown (no consent asked
   *   from the administrator), not even after a request to open the settings.
   * @input PublicTextEditorService active; empty storage; openSettings requested
   * @output visible false, no text of the bar
   */
  it('stays hidden in the visual text editor', () => {
    const ctx = createPublicPageContext({ translations: { cookie_consent: t } });
    TestBed.configureTestingModule({ imports: [CookieConsentComponent], providers: [...ctx.providers, { provide: PublicTextEditorService, useValue: { active: true } }] });
    consent = TestBed.inject(CookieConsentService);
    fixture = TestBed.createComponent(CookieConsentComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.visible).toBeFalse();
    expect(visible()).toBeFalse();
  });

  /**
   * @description The page "Lišta cookies a nabídka jazyka" of the editor shows the bar for its
   *   texts: Settings / Back switch the panel, the other buttons store nothing and keep it open.
   * @input PublicTextEditorService active + banners; empty storage; acceptAll, rejectNonEssential,
   *   toggleSettings, saveSettings
   * @output visible with the texts; no consent stored; showSettings toggled; still visible
   */
  it('shows the bar for its texts on the banners page of the editor', () => {
    const ctx = createPublicPageContext({ translations: { cookie_consent: t } });
    TestBed.configureTestingModule({ imports: [CookieConsentComponent], providers: [...ctx.providers, { provide: PublicTextEditorService, useValue: { active: true, banners: true } }] });
    consent = TestBed.inject(CookieConsentService);
    fixture = TestBed.createComponent(CookieConsentComponent);
    fixture.detectChanges();
    const banner = fixture.componentInstance;
    expect(visible()).toBeTrue();
    banner.acceptAll();
    banner.rejectNonEssential();
    banner.toggleSettings();
    expect(banner.showSettings).toBeTrue();
    banner.saveSettings();
    expect(consent.current).toBeNull();
    expect(localStorage.getItem('jsw_cookie_consent')).toBeNull();
    expect(banner.visible).toBeTrue();
  });
});
