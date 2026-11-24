/**
 * @file web-maintenance.component.spec.ts
 * @path src/app/apps/web/public/web-maintenance/web-maintenance.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of WebMaintenanceComponent (shared BaseMaintenanceComponent page) and
 *   webMaintenanceGuard: the maintenance page sends the visitor home as soon as the web is active
 *   again (status error only logged), shows the translated texts, the contacts and the language
 *   dropdown (choice stored through LocalizationService.setLanguage); the guard redirects to the maintenance page while the web is off, lets everything
 *   through on errors and never blocks the maintenance page itself.
 * @dependencies
 * - createPublicPageContext (status endpoint spies), Router spied.
 */

import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { WebMaintenanceComponent } from './web-maintenance.component';
import { webMaintenanceGuard } from '../components/guards/web-maintenance.guard';
import { PublicPageContext, createPublicPageContext, STUB_LANGUAGES } from '../../../../../testing/public-test-helpers';

describe('WebMaintenanceComponent', () => {
  let ctx: PublicPageContext;
  let router: Router;

  beforeEach(() => {
    ctx = createPublicPageContext({ translations: { web_maintenance: { heading: 'Údržba', language: 'Jazyk', admin_login: 'Admin' } }, settings: { settings: { contact_email: 'help@x.cz', contact_phone: '777' }, social_links: [{ url: 'https://fb', icon_path: 'fb.svg', name: 'FB' }] } });
    TestBed.configureTestingModule({ imports: [WebMaintenanceComponent], providers: ctx.providers });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  /**
   * @description Active web → redirect home; inactive → stays and shows contacts; error → logged.
   * @input is_web_active true; false; error.
   * @output navigate(['/home']); no navigation + 'help@x.cz' rendered; console.error.
   */
  it('redirects home once the web is active again', () => {
    TestBed.createComponent(WebMaintenanceComponent).detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);

    (router.navigate as jasmine.Spy).calls.reset();
    ctx.publicData.getFresh.and.returnValue(of({ is_web_active: false }));
    const fixture = TestBed.createComponent(WebMaintenanceComponent);
    fixture.detectChanges();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('help@x.cz');

    spyOn(console, 'error');
    ctx.publicData.getFresh.and.returnValue(throwError(() => new Error('down')));
    fixture.componentInstance.checkStatusAndRedirect();
    expect(console.error).toHaveBeenCalled();
  });

  /**
   * @description Translated page in the one maintenance look: heading, the language switcher of
   *   the main pages (current language, choice calls setLanguage - stored in the browser), no
   *   action button, the contacts with the social links, the translated admin link; one language
   *   → switcher still shown (as in the header), none → hidden.
   * @input is_web_active false; open the switcher, choose 'en'; languages [cz]; languages [].
   * @output 'Údržba'; label 'Jazyk', 'CZ', 2 options; setLanguage('en'); no .mnt-action;
   *   e-mail, phone, FB icon URL; admin title 'Admin'; switcher with one language; no .mnt-lang.
   */
  it('shows the translated page in the one maintenance look', () => {
    ctx.publicData.getFresh.and.returnValue(of({ is_web_active: false }));
    const fixture = TestBed.createComponent(WebMaintenanceComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1.mnt-heading')?.textContent).toContain('Údržba');
    expect(el.querySelector('.mnt-lang .lang-trigger')?.getAttribute('aria-label')).toBe('Jazyk');
    expect(el.querySelector('.mnt-lang .lang-trigger-code')?.textContent).toContain('CZ');

    (el.querySelector('.mnt-lang .lang-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const options = el.querySelectorAll('.mnt-lang .lang-option');
    expect(options.length).toBe(2);
    (options[1] as HTMLElement).click();
    expect(ctx.localization.setLanguage).toHaveBeenCalledWith('en');

    expect(el.querySelector('.mnt-action')).toBeNull();

    expect(el.querySelector('.mnt-contacts')?.textContent).toContain('help@x.cz');
    expect(el.querySelector('.mnt-contacts')?.textContent).toContain('777');
    expect(el.querySelector('.mnt-social-link img')?.getAttribute('src')).toContain('fb.svg');
    expect(el.querySelector('.mnt-admin')?.getAttribute('title')).toBe('Admin');

    ctx.localization.fetchLanguages.and.returnValue(of({ languages: [STUB_LANGUAGES[0]] }));
    const single = TestBed.createComponent(WebMaintenanceComponent);
    single.detectChanges();
    expect(single.nativeElement.querySelector('.mnt-lang')).not.toBeNull();
    ctx.localization.fetchLanguages.and.returnValue(of({ languages: [] }));
    const none = TestBed.createComponent(WebMaintenanceComponent);
    none.detectChanges();
    expect(none.nativeElement.querySelector('.mnt-lang')).toBeNull();
  });

  /**
   * @description Guard: maintenance URL passes immediately; web off → UrlTree '/maintenance';
   *   web on → true; status error → true (a broken status endpoint must not lock the site).
   * @input router.url '/maintenance' and '/en/maintenance?x=1'; '/' with off / on / error.
   * @output true twice (no request); UrlTree; true; true.
   */
  it('guards the web by its maintenance status', () => {
    const run = () => TestBed.runInInjectionContext(() => webMaintenanceGuard());
    const value = (result: any) => { let v: any; (result as Observable<any>).subscribe(r => (v = r)); return v; };
    const url = spyOnProperty(router, 'url', 'get').and.returnValue('/maintenance');
    expect(run()).toBeTrue();
    url.and.returnValue('/en/maintenance?x=1'); // the URL carries the language
    expect(run()).toBeTrue();
    expect(ctx.publicData.getFresh).not.toHaveBeenCalled();

    url.and.returnValue('/');
    ctx.publicData.getFresh.and.returnValue(of({ is_web_active: false }));
    const tree = value(run());
    expect(tree instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(tree)).toBe('/maintenance');

    ctx.publicData.getFresh.and.returnValue(of({ is_web_active: true }));
    expect(value(run())).toBeTrue();
    ctx.publicData.getFresh.and.returnValue(throwError(() => new Error('x')));
    expect(value(run())).toBeTrue();
  });
});
