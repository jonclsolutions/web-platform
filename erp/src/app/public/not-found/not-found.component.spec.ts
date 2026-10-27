/**
 * @file not-found.component.spec.ts
 * @path src/app/public/not-found/not-found.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the shared public 404 page: texts of the `not_found` section of the
 *   area's translation module, button to the home page of the area, look class of the area, the
 *   requested path is NOT shown (2026-10-27c), robots noindex while shown and restored after; and
 *   the route helper (catch-all, title, data, lazy component).
 * @dependencies
 * - createPublicPageContext; ActivatedRoute stub with the area in the route data; Meta.
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Meta } from '@angular/platform-browser';

import { NotFoundComponent } from './not-found.component';
import { publicNotFoundRoute } from './public-not-found.config';
import { PublicPageContext, createPublicPageContext } from '../../../testing/public-test-helpers';

describe('NotFoundComponent', () => {
  let ctx: PublicPageContext;
  let meta: Meta;
  /** Route data the ActivatedRoute stub returns. */
  let routeData: Record<string, unknown>;
  /** Value of router.url. */
  let currentUrl: string;

  /**
   * @description Creates the page for an area (route data value) at a router URL.
   * @param area Route data `publicNotFoundArea` (undefined = no key).
   * @param url Value of router.url.
   */
  function create(area: unknown, url = '/missing') {
    routeData = area === undefined ? {} : { publicNotFoundArea: area };
    currentUrl = url;
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    routeData = {};
    currentUrl = '/missing';
    ctx = createPublicPageContext({ translations: { not_found: { header: '404', text: 'Missing', button: 'Home' } } });
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: { snapshot: { get data() { return routeData; } } } }]
    });
    spyOnProperty(TestBed.inject(Router), 'url', 'get').and.callFake(() => currentUrl);
    meta = TestBed.inject(Meta);
    meta.removeTag('name="robots"');
  });
  afterEach(() => meta.removeTag('name="robots"'));

  /**
   * @description Web area: web translations, button to '/', dark look, the requested address is
   *   not shown (says nothing to a visitor), the decorative illustration image (2026-10-27b),
   *   robots noindex.
   * @input area 'web'; router.url '/missing/page?email=a@b.cz#x'.
   * @output setModule('web'); texts; href '/'; class not-found--web; neither the path nor the query in the page;
   *   <img> assets/images/icons/404-error.svg with alt '' and aria-hidden; no inline svg;
   *   meta robots 'noindex'.
   */
  it('renders the web 404', () => {
    const fixture = create('web', '/missing/page?email=a@b.cz#x');
    const el = fixture.nativeElement as HTMLElement;

    expect(ctx.localization.setModule).toHaveBeenCalledWith('web');
    expect(el.querySelector('h1')!.textContent).toContain('404');
    expect(el.textContent).toContain('Missing');
    expect(el.querySelector('a.home-btn-404')!.getAttribute('href')).toBe('/');
    expect(el.querySelector('.main-content')!.classList).toContain('not-found--web');
    expect(el.textContent).not.toContain('/missing/page');
    expect(el.textContent).not.toContain('a@b.cz');
    const img = el.querySelector('img.not-found-illustration')!;
    expect(img.getAttribute('src')).toBe('assets/images/icons/404-error.svg');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.svg-placeholder')).toBeNull();
    expect(meta.getTag('name="robots"')!.content).toBe('noindex');
  });

  /**
   * @description Shop area: shop translations, button to the catalog entry '/shop', light look,
   *   the inline drawing (no image - the e-shop keeps its look).
   * @input area 'shop'; router.url '/shop/nothing'.
   * @output setModule('shop'); href '/shop'; class not-found--shop; path not shown;
   *   inline svg aria-hidden; no <img>.
   */
  it('renders the e-shop 404', () => {
    const fixture = create('shop', '/shop/nothing');
    const el = fixture.nativeElement as HTMLElement;
    expect(ctx.localization.setModule).toHaveBeenCalledWith('shop');
    expect(el.querySelector('a.home-btn-404')!.getAttribute('href')).toBe('/shop');
    expect(el.querySelector('.main-content')!.classList).toContain('not-found--shop');
    expect(el.textContent).not.toContain('/shop/nothing');
    expect(el.querySelector('.svg-placeholder svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('img')).toBeNull();
  });

  /**
   * @description Missing / unknown / inherited-object area falls back to the web; no texts yet =
   *   nothing but the illustration.
   * @input area undefined; 'admin'; 'toString'; translations without not_found.
   * @output area 'web' each time; no h1 while texts are missing.
   */
  it('falls back to the web area', () => {
    expect(create(undefined).componentInstance.area).toBe('web');
    expect(create('admin').componentInstance.area).toBe('web');
    expect(create('toString').componentInstance.area).toBe('web');

    ctx.setTranslations({ other: {} });
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')).toBeNull();

  });

  /**
   * @description Leaving the page restores the robots tag of the site (removed when there was none).
   * @input robots 'index,follow' before; destroy. No robots before; destroy.
   * @output 'index,follow' again; no robots tag.
   */
  it('restores the robots tag', () => {
    meta.addTag({ name: 'robots', content: 'index,follow' });
    const withTag = create('web');
    expect(meta.getTag('name="robots"')!.content).toBe('noindex');
    withTag.destroy();
    expect(meta.getTag('name="robots"')!.content).toBe('index,follow');

    meta.removeTag('name="robots"');
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    fixture.destroy();
    expect(meta.getTag('name="robots"')).toBeNull();
  });

  /**
   * @description The route helper builds the catch-all route of an area and lazy-loads this page.
   * @input publicNotFoundRoute('shop', {canActivate: [guard]}).
   * @output path '**', title 'shop.not-found', data {publicNotFoundArea: 'shop'}, the guard;
   *   loadComponent resolves NotFoundComponent.
   */
  it('builds the catch-all route', async () => {
    const guard = () => true;
    const route = publicNotFoundRoute('shop', { canActivate: [guard] });
    expect(route.path).toBe('**');
    expect(route.title).toBe('shop.not-found');
    expect(route.data).toEqual({ publicNotFoundArea: 'shop' });
    expect(route.canActivate).toEqual([guard]);
    expect(await (route.loadComponent as () => Promise<unknown>)()).toBe(NotFoundComponent);
    expect(publicNotFoundRoute('web').canActivate).toBeUndefined();
  });
});
