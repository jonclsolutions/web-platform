/**
 * @file footer-language-switcher.component.ts
 * @path src/app/shared/components/footer-language-switcher/footer-language-switcher.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Language switcher in the footer of the public areas (web, e-shop): a pill with the
 *   flag (a globe without one) and the name of the current language; its menu (flag, name in its own language, check of
 *   the active one - the look of the former header dropdown) opens upwards. Shown only when the
 *   area has more than one language. A choice switches the language and is remembered
 *   (LocalizationService.setLanguage).
 * @usage `<app-footer-language-switcher [label]="t.language_label" />` in a footer; colours via
 *   CSS custom properties on an ancestor: trigger `--fls-color`, `--fls-color-hover`,
 *   `--fls-bg`, `--fls-bg-hover`, `--fls-border`, `--fls-border-hover`, `--fls-radius`; menu
 *   `--fls-menu-bg`, `--fls-menu-border`, `--fls-menu-radius`, `--fls-option-color`,
 *   `--fls-option-color-active`, `--fls-option-bg-hover`, `--fls-option-bg-active`,
 *   `--fls-check`, `--fls-focus` (fallbacks = dark web footer).
 * @dependencies LocalizationService (languages and active language of the current module).
 * @note Accessible listbox: the button names the current language (aria-expanded); in the menu
 *   ArrowUp / ArrowDown / Home / End move, Enter / Space choose, Escape closes and returns focus
 *   to the button; a click outside or Tab closes it. Each name carries its `lang` (screen readers
 *   say "Čeština" in Czech on an English page).
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, Input,
  OnInit, QueryList, ViewChild, ViewChildren, inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LangMeta, LocalizationService } from '../../services/localization.service';
import { languageCodeOfBrowserTag } from '../../utils/language-preference';

/** Placeholder flag path LocalizationService uses for a language without an icon (no such file). */
const GENERIC_FLAG = 'assets/images/icons/default.png';
/** Counter for unique ids of the menus (aria-controls). */
let nextMenuId = 0;

@Component({
  selector: 'app-footer-language-switcher',
  standalone: true,
  templateUrl: './footer-language-switcher.component.html',
  styleUrl: './footer-language-switcher.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterLanguageSwitcherComponent implements OnInit {
  /** Accessible name of the button and the menu (translated by the footer, "Jazyk" / "Language"). */
  @Input() label = '';

  /** Active languages of the current public area. */
  languages: LangMeta[] = [];
  /** Code of the active language. */
  current = '';
  /** The menu is open. */
  isOpen = false;
  /** Codes of the languages whose flag image failed to load. */
  private readonly failedFlags = new Set<string>();
  /** Id of the menu (aria-controls of the button). */
  readonly menuId = `fls-menu-${nextMenuId++}`;

  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChildren('option') private options?: QueryList<ElementRef<HTMLElement>>;

  private readonly localization = inject(LocalizationService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** @description Loads the languages of the area and follows the active language. */
  ngOnInit(): void {
    this.localization.fetchLanguages()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.languages = res.languages;
        this.cd.markForCheck();
      });
    this.localization.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(code => {
        this.current = code;
        this.cd.markForCheck();
      });
  }

  /**
   * @description Whether a language has a usable flag image (set in the admin, not the generic
   *   placeholder path of LocalizationService and not failed to load).
   * @param lang Language.
   * @returns true = show the flag; false = show the globe.
   */
  hasFlag(lang: LangMeta): boolean {
    return !!lang.flag && !lang.flag.endsWith(GENERIC_FLAG) && !this.failedFlags.has(lang.code);
  }

  /**
   * @description Remembers a flag that did not load (the globe is shown instead).
   * @param code Language code.
   */
  flagFailed(code: string): void {
    this.failedFlags.add(code);
    this.cd.markForCheck();
  }

  /** @description The active language (shown on the button). */
  get currentLanguage(): LangMeta | undefined {
    return this.languages.find(l => l.code === this.current);
  }

  /** @description Opens / closes the menu; an opened menu focuses the active language. */
  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.focusOption(Math.max(0, this.languages.findIndex(l => l.code === this.current)));
    }
  }

  /**
   * @description Chooses a language (switches and remembers it when it changed), closes the menu
   *   and returns the focus to the button.
   * @param code Language code.
   */
  select(code: string): void {
    if (code !== this.current) {
      this.localization.setLanguage(code);
    }
    this.close(true);
  }

  /**
   * @description Keyboard of the open menu: arrows / Home / End move between the languages,
   *   Escape closes (focus back to the button), Tab closes and lets the focus go on.
   * @param event Keydown inside the switcher.
   */
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      return;
    }
    const items = this.options?.toArray() ?? [];
    const index = items.findIndex(item => item.nativeElement === this.host.nativeElement.ownerDocument.activeElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusOption(index < 0 ? 0 : (index + 1) % items.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusOption(index <= 0 ? items.length - 1 : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        this.focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusOption(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        this.close(true);
        break;
      case 'Tab':
        this.close(false);
        break;
    }
  }

  /**
   * @description Closes the menu on a click anywhere outside of the switcher.
   * @param event Click of the document.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  /**
   * @description BCP 47 tag of a language code for the `lang` attribute.
   * @param code Translation code (`cz`, `en`, …).
   * @returns `cs` for Czech, otherwise the code itself.
   */
  htmlLang(code: string): string {
    return code.toLowerCase() === 'cz' ? 'cs' : languageCodeOfBrowserTag(code);
  }

  /**
   * @description Closes the menu.
   * @param refocus Return the focus to the button (keyboard / choice), not on an outside click.
   */
  private close(refocus: boolean): void {
    this.isOpen = false;
    this.cd.markForCheck();
    if (refocus) {
      this.trigger?.nativeElement.focus();
    }
  }

  /**
   * @description Focuses one language of the menu (after the menu is rendered).
   * @param index Index in `languages`.
   */
  private focusOption(index: number): void {
    this.cd.detectChanges();
    this.options?.get(index)?.nativeElement.focus();
  }
}
