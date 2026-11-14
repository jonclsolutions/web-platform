/**
 * @file portal-language-switcher.component.spec.ts
 * @path src/app/apps/project-portal/public/language-switcher/portal-language-switcher.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalLanguageSwitcherComponent: the flag of the current language,
 *   opening / closing the menu and switching the language of the portal texts.
 * @dependencies ProjectPortalLocalizationService stub (current language, setLanguage spy).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortalLanguageSwitcherComponent } from './portal-language-switcher.component';
import { ProjectPortalLocalizationService, PROJECT_PORTAL_AVAILABLE_LANGUAGES } from '../project-portal-localization.service';

describe('PortalLanguageSwitcherComponent', () => {
  let fixture: ComponentFixture<PortalLanguageSwitcherComponent>;
  let component: PortalLanguageSwitcherComponent;
  let i18n: { availableLanguages: typeof PROJECT_PORTAL_AVAILABLE_LANGUAGES; getCurrentLanguage: jasmine.Spy; setLanguage: jasmine.Spy };
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    i18n = {
      availableLanguages: PROJECT_PORTAL_AVAILABLE_LANGUAGES,
      getCurrentLanguage: jasmine.createSpy('getCurrentLanguage').and.returnValue('en'),
      setLanguage: jasmine.createSpy('setLanguage'),
    };
    await TestBed.configureTestingModule({
      imports: [PortalLanguageSwitcherComponent],
      providers: [{ provide: ProjectPortalLocalizationService, useValue: i18n }],
    }).compileComponents();
    fixture = TestBed.createComponent(PortalLanguageSwitcherComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Language');
    fixture.detectChanges();
  });

  /**
   * @description The button shows the flag of the current language and carries the label.
   * @input  current language 'en'; label 'Language'
   * @output img alt 'en'; title / aria-label 'Language'; aria-expanded false; no menu
   */
  it('shows the current language', () => {
    const btn = el().querySelector('.pp-lang-btn') as HTMLButtonElement;
    expect(btn.querySelector('img')!.getAttribute('alt')).toBe('en');
    expect([btn.title, btn.getAttribute('aria-label'), btn.getAttribute('aria-expanded')]).toEqual(['Language', 'Language', 'false']);
    expect(el().querySelector('.pp-lang-menu')).toBeNull();
    expect(component.current?.code).toBe('en');
  });

  /**
   * @description The button opens the menu with every language (current one marked); the
   *   backdrop closes it; picking a language switches the texts and closes the menu.
   * @input  click button; click backdrop; click button, pick the first language
   * @output menu items = languages, active 'en'; closed; setLanguage(first code), closed
   */
  it('opens the menu and switches the language', () => {
    (el().querySelector('.pp-lang-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = el().querySelectorAll('.pp-lang-menu-item');
    expect(items.length).toBe(PROJECT_PORTAL_AVAILABLE_LANGUAGES.length);
    expect(el().querySelector('.pp-lang-menu-item-active')!.textContent).toContain('English');

    (el().querySelector('.pp-lang-menu-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    expect(component.isOpen).toBeFalse();

    (el().querySelector('.pp-lang-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el().querySelectorAll('.pp-lang-menu-item')[0] as HTMLButtonElement).click();
    expect(i18n.setLanguage).toHaveBeenCalledWith(PROJECT_PORTAL_AVAILABLE_LANGUAGES[0].code);
    expect(component.isOpen).toBeFalse();
  });
});
