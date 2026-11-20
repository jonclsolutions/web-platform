/**
 * @file auth-language-switcher.component.ts
 * @path src/app/shared/components/auth-language-switcher/auth-language-switcher.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Language switcher of the sign-in pages (top-right corner of AuthShellComponent):
 *   a pill with the flag and the code of the current language, the menu lists the languages
 *   with flag and name. Presentational - the page passes its languages (admin or project portal)
 *   and switches the language on `selected`. Closes on a click outside and on Escape.
 * @usage `<app-auth-language-switcher authLang [languages]="languages" [current]="code"
 *          [label]="t.language.label" (selected)="selectLanguage($event)" />`
 *   In a left corner add `menuAlign="start"`.
 * @dependencies none
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';

/** One language of the switcher. */
export interface AuthLanguage {
  code: string;
  name: string;
  /** Flag image. */
  icon: string;
}

@Component({
  selector: 'app-auth-language-switcher',
  standalone: true,
  templateUrl: './auth-language-switcher.component.html',
  styleUrl: './auth-language-switcher.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLanguageSwitcherComponent {
  /** Languages offered. */
  @Input() languages: readonly AuthLanguage[] = [];
  /** Code of the current language. */
  @Input() current = '';
  /** Accessible name of the button and of the menu (translated by the page). */
  @Input() label = '';
  /** Side the menu opens to: `end` = aligned to the right edge (switcher in a right corner),
   *  `start` = aligned to the left edge (switcher in a left corner) - the menu stays in the window. */
  @Input() menuAlign: 'start' | 'end' = 'end';

  /** Code of the chosen language. */
  @Output() selected = new EventEmitter<string>();

  /** The menu is open. */
  isOpen = false;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cd = inject(ChangeDetectorRef);

  /** @description The current language (flag of the button). */
  get currentLanguage(): AuthLanguage | undefined {
    return this.languages.find(l => l.code === this.current);
  }

  /** @description Opens / closes the menu. */
  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  /**
   * @description Chooses a language and closes the menu.
   * @param code Language code.
   */
  select(code: string): void {
    this.isOpen = false;
    if (code !== this.current) this.selected.emit(code);
  }

  /** @description Closes the menu on a click anywhere outside of the switcher. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
      this.cd.markForCheck();
    }
  }

  /** @description Closes the menu with Escape. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.cd.markForCheck();
    }
  }
}
