/**
 * @file maintenance-shell.component.spec.ts
 * @path src/app/shared/components/maintenance-shell/maintenance-shell.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of MaintenanceShellComponent (the one look of the maintenance pages):
 *   the notice, the action as a link or a button, the language switcher, the contacts and the
 *   admin link - each part only when it has something to show.
 * @dependencies provideRouter([]) for the links.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MaintenanceShellComponent } from './maintenance-shell.component';

describe('MaintenanceShellComponent', () => {
  let fixture: ComponentFixture<MaintenanceShellComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const set = (inputs: Record<string, unknown>) => {
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MaintenanceShellComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(MaintenanceShellComponent);
  });

  /**
   * @description Only the heading: no text, note, action, switcher, contacts or admin link.
   * @input heading 'Údržba'.
   * @output h1 'Údržba'; the optional parts missing.
   */
  it('renders only what it gets', () => {
    set({ heading: 'Údržba' });
    expect(el().querySelector('h1.mnt-heading')!.textContent).toBe('Údržba');
    for (const selector of ['.mnt-text', '.mnt-note', '.mnt-action', '.mnt-lang', '.mnt-contacts', '.mnt-admin']) {
      expect(el().querySelector(selector)).withContext(selector).toBeNull();
    }
    expect(el().querySelector('.mnt-logo')).not.toBeNull();
  });

  /**
   * @description Every part: text, note, the action as a button (emits) or a link, the switcher
   *   (emits the chosen language), contacts with phone link and social icons, the admin link.
   * @input all inputs; click the button; choose en; then actionLink '/home'.
   * @output texts; the menu opens to the right (top-left corner); action emitted; 'en' emitted; mailto / tel:+420777; social icon; admin title;
   *   a.mnt-action href '/home'.
   */
  it('renders every part and emits the actions', () => {
    const actions: string[] = [];
    fixture.componentInstance.action.subscribe(() => actions.push('action'));
    fixture.componentInstance.languageSelected.subscribe(code => actions.push(code));
    set({
      heading: 'H', text: 'T', note: 'N', actionLabel: 'Znovu',
      languages: [{ code: 'cz', name: 'Čeština', icon: 'cz.png' }, { code: 'en', name: 'English', icon: 'en.png' }],
      currentLanguage: 'cz', languageLabel: 'Jazyk',
      email: 'a@b.cz', phone: '+420 777', socialLinks: [{ name: 'FB', url: 'https://fb', icon: 'fb.svg' }],
      adminLoginLabel: 'Admin',
    });
    expect([el().querySelector('.mnt-text')!.textContent, el().querySelector('.mnt-note')!.textContent]).toEqual(['T', 'N']);
    (el().querySelector('button.mnt-action') as HTMLButtonElement).click();
    (el().querySelector('.lang-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('.lang-menu')!.classList).toContain('lang-menu--start');
    (el().querySelectorAll('.lang-option')[1] as HTMLElement).click();
    expect(actions).toEqual(['action', 'en']);

    expect(el().querySelector('a[href="mailto:a@b.cz"]')).not.toBeNull();
    expect(el().querySelector('a[href="tel:+420777"]')).not.toBeNull();
    expect(el().querySelector('.mnt-social-link')!.getAttribute('href')).toBe('https://fb');
    expect(el().querySelector('.mnt-admin')!.getAttribute('title')).toBe('Admin');

    set({ actionLink: '/home' });
    expect(el().querySelector('a.mnt-action')!.getAttribute('href')).toBe('/home');
  });
});
