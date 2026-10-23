/**
 * @file base-public.component.spec.ts
 * @path src/app/public/base-public.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of BasePublicComponent (parent of all public pages): translation
 *   module selection, the page's translation section, the optional site settings stream, the
 *   lifecycle hooks, contact links and icon URLs; subscriptions end on destroy.
 * @dependencies
 * - Two minimal concrete pages (web without settings, shop with settings); createPublicPageContext.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BasePublicComponent } from './base-public.component';
import { PublicPageContext, createPublicPageContext } from '../../testing/public-test-helpers';

/** Web page without site settings, recording the hooks. */
@Component({ standalone: true, template: '{{ t?.title }}', changeDetection: ChangeDetectionStrategy.OnPush })
class WebPageComponent extends BasePublicComponent {
  protected readonly translationKey = 'page';
  calls: string[] = [];
  received: any = null;
  protected override onInit(): void { this.calls.push('init'); }
  protected override onDestroy(): void { this.calls.push('destroy'); }
  protected override onTranslationsLoaded(all: any): void { this.received = all; }
}

/** Shop page with site settings and the default hooks. */
@Component({ standalone: true, template: '' })
class ShopPageComponent extends BasePublicComponent {
  protected readonly translationKey = 'page';
  protected override readonly loadSiteSettings = true;
  protected override readonly translationModule = 'shop';
}

describe('BasePublicComponent', () => {
  let ctx: PublicPageContext;

  beforeEach(() => {
    ctx = createPublicPageContext();
    TestBed.configureTestingModule({ imports: [WebPageComponent, ShopPageComponent], providers: ctx.providers });
  });

  /**
   * @description Web page: module 'web', texts of its section (other sections ignored), hooks
   *   called, re-render on new translations, nothing after destroy; settings not read.
   * @input Translations without the section; {page: {title: 'A'}}; {page: {title: 'B'}}; destroy; {page: {title: 'C'}}.
   * @output setModule('web'); t null → 'A' rendered → 'B'; hooks ['init', 'destroy']; t stays 'B'.
   */
  it('loads the page section of the web module', () => {
    const fixture = TestBed.createComponent(WebPageComponent);
    const page = fixture.componentInstance;
    ctx.setTranslations({ other: {} });
    fixture.detectChanges();
    expect(ctx.localization.setModule).toHaveBeenCalledWith('web');
    expect(page.t).toBeNull();

    ctx.setTranslations({ page: { title: 'A' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('A');
    expect(page.received).toEqual({ page: { title: 'A' } });

    ctx.setTranslations({ page: { title: 'B' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('B');

    ctx.publicData.siteSettingsValue$.next({ settings: { contact_email: 'x@y.cz' } });
    expect(page.settings).toBeNull();

    fixture.destroy();
    ctx.setTranslations({ page: { title: 'C' } });
    expect(page.t.title).toBe('B');
    expect(page.calls).toEqual(['init', 'destroy']);
  });

  /**
   * @description Shop page: module 'shop', settings + social links from the stream (null
   *   ignored, missing parts default), mailto / tel links (spaces removed), icon URL, language stream.
   * @input settings null; {settings: {contact_email, contact_phone '+420 777 123'}, social_links: [1]}; {}.
   * @output setModule('shop'); settings / links set; 'mailto:a@b.cz', 'tel:+420777123'; then null / []; 'mailto:', 'tel:'.
   */
  it('reads site settings and builds contact links', () => {
    const fixture = TestBed.createComponent(ShopPageComponent);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    expect(ctx.localization.setModule).toHaveBeenCalledWith('shop');
    expect(page.settings).toBeNull();

    ctx.publicData.siteSettingsValue$.next({ settings: { contact_email: 'a@b.cz', contact_phone: '+420 777 123' }, social_links: [{ id: 1 }] });
    expect(page.socialLinks).toEqual([{ id: 1 }]);
    expect(page.emailHref).toBe('mailto:a@b.cz');
    expect(page.phoneHref).toBe('tel:+420777123');
    expect(page.getIconUrl('icons/fb.svg')).toBe('/storage/icons/fb.svg');

    ctx.publicData.siteSettingsValue$.next({});
    expect(page.settings).toBeNull();
    expect(page.socialLinks).toEqual([]);
    expect(page.emailHref).toBe('mailto:');
    expect(page.phoneHref).toBe('tel:');

    let lang = '';
    page.currentLanguage$.subscribe(l => (lang = l));
    expect(lang).toBe('cz');
    fixture.destroy();
  });
});
