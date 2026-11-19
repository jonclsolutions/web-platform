/**
 * @file auth-shell.component.spec.ts
 * @path src/app/shared/components/auth-shell/auth-shell.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AuthShellComponent: logo and tagline on the left, the content of the
 *   page in the card and the language switcher in its own slot.
 * @dependencies none (a host component projects the content).
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AUTH_SHELL_LOGO, AuthShellComponent } from './auth-shell.component';

@Component({
  standalone: true,
  imports: [AuthShellComponent],
  template: `
    <app-auth-shell [tagline]="tagline">
      <span authLang class="lang">CZ</span>
      <form class="content">Form</form>
    </app-auth-shell>`,
})
class HostComponent {
  tagline = 'Engineering better tomorrows.';
}

describe('AuthShellComponent', () => {
  /**
   * @description Content in the card, switcher in the corner, logo + tagline; no tagline = none.
   * @input Host with a tagline, then an empty one.
   * @output .auth-card > form.content; .auth-lang > .lang; img src = AUTH_SHELL_LOGO; tagline text;
   *   no .auth-hero-title when empty.
   */
  it('renders the layout with the projected content', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.auth-card > form.content')).not.toBeNull();
    expect(el.querySelector('.auth-lang > .lang')).not.toBeNull();
    expect(el.querySelector('.auth-hero-visual')!.getAttribute('src')).toBe(AUTH_SHELL_LOGO);
    expect(el.querySelector('.auth-hero-title')!.textContent).toBe('Engineering better tomorrows.');

    fixture.componentInstance.tagline = '';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(el.querySelector('.auth-hero-title')).toBeNull();
  });
});
