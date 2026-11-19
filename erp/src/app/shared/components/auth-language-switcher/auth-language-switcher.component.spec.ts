/**
 * @file auth-language-switcher.component.spec.ts
 * @path src/app/shared/components/auth-language-switcher/auth-language-switcher.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AuthLanguageSwitcherComponent: the current language on the button,
 *   the menu, choosing a language, closing on a click outside and on Escape.
 * @dependencies none
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthLanguageSwitcherComponent } from './auth-language-switcher.component';

describe('AuthLanguageSwitcherComponent', () => {
  let fixture: ComponentFixture<AuthLanguageSwitcherComponent>;
  let component: AuthLanguageSwitcherComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const languages = [{ code: 'cz', name: 'Čeština', icon: 'cz.png' }, { code: 'en', name: 'English', icon: 'en.png' }];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AuthLanguageSwitcherComponent] });
    fixture = TestBed.createComponent(AuthLanguageSwitcherComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('languages', languages);
    fixture.componentRef.setInput('current', 'cz');
    fixture.componentRef.setInput('label', 'Language');
    fixture.detectChanges();
  });

  /**
   * @description The button shows the current language; a click opens the menu with every
   *   language (the current one marked); choosing another emits it and closes the menu; the
   *   current one emits nothing.
   * @input current cz; open; choose en; open; choose cz.
   * @output flag cz.png, code CZ, aria-label; 2 options, active Čeština; emitted ['en']; closed.
   */
  it('shows the languages and emits the chosen one', () => {
    const emitted: string[] = [];
    component.selected.subscribe(code => emitted.push(code));
    const trigger = el().querySelector('.lang-trigger') as HTMLButtonElement;
    expect(el().querySelector('.lang-trigger-flag')!.getAttribute('src')).toBe('cz.png');
    expect(el().querySelector('.lang-trigger-code')!.textContent).toBe('CZ');
    expect(trigger.getAttribute('aria-label')).toBe('Language');

    trigger.click();
    fixture.detectChanges();
    const options = Array.from(el().querySelectorAll('.lang-option')) as HTMLElement[];
    expect(options.map(o => o.querySelector('.lang-option-label')!.textContent)).toEqual(['Čeština', 'English']);
    expect(options[0].classList).toContain('lang-option--active');

    options[1].click();
    fixture.detectChanges();
    expect(emitted).toEqual(['en']);
    expect(el().querySelector('.lang-menu')).toBeNull();

    trigger.click();
    fixture.detectChanges();
    (el().querySelector('.lang-option') as HTMLElement).click();
    expect(emitted).toEqual(['en']);
  });

  /**
   * @description A click outside and Escape close the menu; a click inside keeps it open.
   * @input open; click inside; click on the body; open; Escape.
   * @output open, open, closed, closed.
   */
  it('closes on a click outside and on Escape', () => {
    component.toggle();
    component.onDocumentClick({ target: el().querySelector('.lang-trigger') } as unknown as MouseEvent);
    expect(component.isOpen).toBeTrue();
    component.onDocumentClick({ target: document.body } as unknown as MouseEvent);
    expect(component.isOpen).toBeFalse();
    component.toggle();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.isOpen).toBeFalse();
  });
});
