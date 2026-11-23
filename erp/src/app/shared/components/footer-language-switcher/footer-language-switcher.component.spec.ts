/**
 * @file footer-language-switcher.component.spec.ts
 * @path src/app/shared/components/footer-language-switcher/footer-language-switcher.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of FooterLanguageSwitcherComponent: the button with the active language,
 *   the menu (names in their own `lang`, the active one selected and checked), switching on a
 *   click (not on the same language), the keyboard (arrows, Enter, Escape back to the button),
 *   closing on an outside click, a globe for a missing / broken flag, following a language change from elsewhere and hiding the
 *   switcher with a single language.
 * @dependencies createPublicPageContext (LocalizationService stub with cz / en).
 */

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FooterLanguageSwitcherComponent } from './footer-language-switcher.component';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('FooterLanguageSwitcherComponent', () => {
  /** Creates the switcher (attached to the document - focus checks need it). */
  function create(ctx = createPublicPageContext({ lang: 'en' }), label = 'Language') {
    TestBed.configureTestingModule({ imports: [FooterLanguageSwitcherComponent], providers: ctx.providers });
    const fixture = TestBed.createComponent(FooterLanguageSwitcherComponent);
    fixture.componentInstance.label = label;
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = () => root.querySelector('.fls-trigger') as HTMLButtonElement;
    const options = () => Array.from(root.querySelectorAll('.fls-option')) as HTMLElement[];
    return { fixture, ctx, root, button, options };
  }

  /**
   * @description Closed: the button names the active language and the switcher; open: the menu
   *   lists the languages by name with their `lang`, the active one selected + checked and focused.
   * @input languages cz / en; active en; label 'Language'; click on the button.
   * @output button 'English', aria-label 'Language', aria-expanded false → true; options
   *   'Čeština' (cs) / 'English' (en); aria-selected only on English, one check; focus on English.
   */
  it('shows the active language and opens the menu of languages', () => {
    const { fixture, button, options } = create();
    expect(button().textContent!.trim()).toBe('English');
    expect(button().getAttribute('aria-label')).toBe('Language');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(options().length).toBe(0);

    button().click();
    fixture.detectChanges();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(options().map(o => o.textContent!.trim())).toEqual(['Čeština', 'English']);
    expect(options().map(o => o.lang)).toEqual(['cs', 'en']);
    expect(options().map(o => o.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(options()[1].querySelector('.fls-option-check')).not.toBeNull();
    expect(document.activeElement).toBe(options()[1]);
  });

  /**
   * @description A click on a language switches (and remembers) it and closes the menu; the
   *   active language does not switch again; a change from elsewhere updates the button.
   * @input open, click 'Čeština'; open, click 'Čeština' again; currentLanguage$ → 'en'.
   * @output setLanguage('cz') once; menu closed; button 'English' after the outside change.
   */
  it('switches the language on a click and follows outside changes', () => {
    const { fixture, ctx, button, options } = create();
    button().click();
    fixture.detectChanges();
    options()[0].click();
    fixture.detectChanges();
    expect(ctx.localization.setLanguage).toHaveBeenCalledOnceWith('cz');
    expect(options().length).toBe(0);

    button().click();
    fixture.detectChanges();
    options()[0].click();
    expect(ctx.localization.setLanguage).toHaveBeenCalledTimes(1);

    ctx.localization.currentLanguage$.next('en');
    fixture.detectChanges();
    expect(button().textContent!.trim()).toBe('English');
  });

  /**
   * @description Keyboard: ArrowDown / ArrowUp move (wrapping), Enter chooses, Escape closes and
   *   returns the focus to the button.
   * @input open (focus English); ArrowDown; ArrowUp; ArrowUp; Enter; open again; Escape.
   * @output focus Čeština (wrapped); English; Čeština; setLanguage('cz'), menu closed, focus on
   *   the button; after Escape menu closed, focus on the button.
   */
  it('works with the keyboard', () => {
    const { fixture, ctx, button, options } = create();
    const key = (k: string) => {
      (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      fixture.detectChanges();
    };
    button().click();
    fixture.detectChanges();
    key('ArrowDown');
    expect(document.activeElement).toBe(options()[0]);
    key('ArrowUp');
    expect(document.activeElement).toBe(options()[1]);
    key('ArrowUp');
    expect(document.activeElement).toBe(options()[0]);
    key('Enter');
    expect(ctx.localization.setLanguage).toHaveBeenCalledOnceWith('cz');
    expect(options().length).toBe(0);
    expect(document.activeElement).toBe(button());

    button().click();
    fixture.detectChanges();
    key('Escape');
    expect(options().length).toBe(0);
    expect(document.activeElement).toBe(button());
  });

  /**
   * @description A click outside the switcher closes the menu; a click inside keeps it open.
   * @input open; click inside on the menu; click on document.body.
   * @output menu open; then closed.
   */
  it('closes on a click outside', () => {
    const { fixture, root, button, options } = create();
    button().click();
    fixture.detectChanges();
    (root.querySelector('.fls-menu') as HTMLElement).click();
    fixture.detectChanges();
    expect(options().length).toBe(2);
    document.body.click();
    fixture.detectChanges();
    expect(options().length).toBe(0);
  });

  /**
   * @description A language without its own flag (generic placeholder path) or with a flag that
   *   fails to load shows a globe instead of a broken image.
   * @input stub flags cz.png / en.png; English flag fails (error event); placeholder path.
   * @output English: no img, a globe; Čeština keeps its img; placeholder → hasFlag false.
   */
  it('shows a globe instead of a missing or broken flag', () => {
    const { fixture, button, options } = create();
    (button().querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(button().querySelector('img')).toBeNull();
    expect(button().querySelector('.fls-globe')).not.toBeNull();
    button().click();
    fixture.detectChanges();
    expect(options()[0].querySelector('img')).not.toBeNull();
    expect(options()[1].querySelector('.fls-globe')).not.toBeNull();
    expect(fixture.componentInstance.hasFlag({ code: 'de', label: 'Deutsch', flag: 'assets/images/icons/default.png', active: true })).toBeFalse();
  });

  /**
   * @description With one language there is nothing to switch: the switcher is not rendered.
   * @input fetchLanguages → [cz].
   * @output no button.
   */
  it('hides itself with a single language', () => {
    const ctx = createPublicPageContext();
    ctx.localization.fetchLanguages.and.returnValue(of({ languages: [{ code: 'cz', label: 'Čeština', flag: '', active: true }] }));
    const { button } = create(ctx);
    expect(button()).toBeNull();
  });
});
