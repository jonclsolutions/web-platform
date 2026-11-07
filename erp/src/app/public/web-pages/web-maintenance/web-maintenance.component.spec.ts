/**
 * @file web-maintenance.component.spec.ts
 * @path src/app/public/web-pages/web-maintenance/web-maintenance.component.spec.ts
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
import { PublicPageContext, createPublicPageContext, STUB_LANGUAGES } from '../../../../testing/public-test-helpers';

describe('WebMaintenanceComponent', () => {
  let ctx: PublicPageContext;
  let router: Router;

  beforeEach(() => {
    ctx = createPublicPageContext({ translations: { web_maintenance: { heading: 'Údržba', language: 'Jazyk', admin_login: 'Admin', retry: 'Znovu' } }, settings: { settings: { contact_email: 'help@x.cz', contact_phone: '777' }, social_links: [{ url: 'https://fb', icon_path: 'fb.svg', name: 'FB' }] } });
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
    ctx.publicData.getWebStatus.and.returnValue(of({ is_web_active: false }));
    const fixture = TestBed.createComponent(WebMaintenanceComponent);
    fixture.detectChanges();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('help@x.cz');

    spyOn(console, 'error');
    ctx.publicData.getWebStatus.and.returnValue(throwError(() => new Error('down')));
    fixture.componentInstance.checkStatusAndRedirect();
    expect(console.error).toHaveBeenCalled();
  });

  /**
   * @description Translated page with the language dropdown of the main pages: the current
   *   language on the button, the menu toggles, a choice calls setLanguage (stored in the
   *   browser) and closes the menu, a click outside closes it, a click inside keeps it; the web
   *   has a "try again" button instead of the back link (checks the status again), the admin link
   *   is translated; one language → dropdown still shown (as in the header), none → hidden.
   * @input is_web_active false; retry with the web active; toggle; click body; toggle + click
   *   inside; option 'en'; languages [cz]; languages [].
   * @output 'Údržba', 'CZ'; retry → navigate(['/home']); menu with 2 options; closed; open;
   *   setLanguage('en') + 'EN'; dropdown with one language; no .maintenance-lang.
   */
  it('shows the translated page with the language dropdown', () => {
    ctx.publicData.getWebStatus.and.returnValue(of({ is_web_active: false }));
    const fixture = TestBed.createComponent(WebMaintenanceComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const page = fixture.componentInstance;
    expect(el.querySelector('h1')?.textContent).toContain('Údržba');
    expect(el.querySelector('.maintenance-lang-trigger')?.getAttribute('aria-label')).toBe('Jazyk');
    expect(el.querySelector('.maintenance-lang-code')?.textContent).toContain('CZ');
    expect(page.activeLang).toEqual(STUB_LANGUAGES[0]);
    const retry = el.querySelector('button.btn-home') as HTMLButtonElement;
    expect(retry.textContent).toContain('Znovu');
    ctx.publicData.getWebStatus.and.returnValue(of({ is_web_active: true }));
    retry.click();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(el.querySelector('.maintenance-admin-link')?.getAttribute('title')).toBe('Admin');

    (el.querySelector('.maintenance-lang-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.maintenance-lang-option').length).toBe(2);
    document.body.click();
    expect(page.isLangOpen).toBeFalse();

    page.toggleLang();
    page.onDocumentClick({ target: el.querySelector('.maintenance-lang-trigger') } as any);
    expect(page.isLangOpen).toBeTrue();
    page.onDocumentClick({ target: null } as any);
    expect(page.isLangOpen).toBeFalse();
    page.toggleLang();
    fixture.detectChanges();
    (el.querySelectorAll('.maintenance-lang-option')[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(ctx.localization.setLanguage).toHaveBeenCalledWith('en');
    expect(page.isLangOpen).toBeFalse();
    expect(el.querySelector('.maintenance-lang-code')?.textContent).toContain('EN');

    ctx.localization.fetchLanguages.and.returnValue(of({ languages: [STUB_LANGUAGES[0]] }));
    const single = TestBed.createComponent(WebMaintenanceComponent);
    single.detectChanges();
    expect(single.nativeElement.querySelector('.maintenance-lang')).not.toBeNull();
    ctx.localization.fetchLanguages.and.returnValue(of({ languages: [] }));
    const none = TestBed.createComponent(WebMaintenanceComponent);
    none.detectChanges();
    expect(none.nativeElement.querySelector('.maintenance-lang')).toBeNull();
  });

  /**
   * @description Guard: maintenance URL passes immediately; web off → UrlTree '/web-maintenance';
   *   web on → true; status error → true (a broken status endpoint must not lock the site).
   * @input router.url '/web-maintenance'; '/' with off / on / error.
   * @output true (no request); UrlTree; true; true.
   */
  it('guards the web by its maintenance status', () => {
    const run = () => TestBed.runInInjectionContext(() => webMaintenanceGuard());
    const value = (result: any) => { let v: any; (result as Observable<any>).subscribe(r => (v = r)); return v; };
    const url = spyOnProperty(router, 'url', 'get').and.returnValue('/web-maintenance');
    expect(run()).toBeTrue();
    expect(ctx.publicData.getWebStatus).not.toHaveBeenCalled();

    url.and.returnValue('/');
    ctx.publicData.getWebStatus.and.returnValue(of({ is_web_active: false }));
    const tree = value(run());
    expect(tree instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(tree)).toBe('/web-maintenance');

    ctx.publicData.getWebStatus.and.returnValue(of({ is_web_active: true }));
    expect(value(run())).toBeTrue();
    ctx.publicData.getWebStatus.and.returnValue(throwError(() => new Error('x')));
    expect(value(run())).toBeTrue();
  });
});
