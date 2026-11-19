/**
 * @file admin-auth-shell.component.spec.ts
 * @path src/app/admin/auth/admin-auth-shell/admin-auth-shell.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AdminAuthShellComponent: the shared sign-in layout with the admin
 *   tagline, the admin languages in the switcher (choosing one switches the admin language) and
 *   the projected content in the card.
 * @dependencies src/testing/admin-test-helpers.ts (i18n stub returning the key).
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AdminAuthShellComponent } from './admin-auth-shell.component';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { createI18nStub } from '../../../../testing/admin-test-helpers';

@Component({
  standalone: true,
  imports: [AdminAuthShellComponent],
  template: `<app-admin-auth-shell><p class="content">Card</p></app-admin-auth-shell>`,
})
class HostComponent {}

describe('AdminAuthShellComponent', () => {
  /**
   * @description Tagline login.hero.title, the switcher with the admin languages and the current
   *   one, the content in the card; choosing a language calls setLanguage.
   * @input Render with the stub (cz); choose en.
   * @output tagline 'login.hero.title'; code CZ; label 'login.language.label'; .auth-card > p.content;
   *   setLanguage('en').
   */
  it('renders the admin sign-in layout', () => {
    const i18n = createI18nStub('cz');
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: AdminLocalizationService, useValue: i18n }] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.auth-hero-title')!.textContent).toBe('login.hero.title');
    expect(el.querySelector('.lang-trigger-code')!.textContent).toBe('CZ');
    expect(el.querySelector('.lang-trigger')!.getAttribute('aria-label')).toBe('login.language.label');
    expect(el.querySelector('.auth-card > p.content')).not.toBeNull();

    const shell = fixture.debugElement.children[0].componentInstance as AdminAuthShellComponent;
    shell.selectLanguage('en');
    expect(i18n.setLanguage).toHaveBeenCalledWith('en');
  });
});
