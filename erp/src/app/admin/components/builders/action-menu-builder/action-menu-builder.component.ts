/**
 * @file action-menu-builder.component.ts
 * @path src/app/admin/components/builders/action-menu-builder/action-menu-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Reusable dropdown ("Akce") nahrazující řadu jednotlivých pill tlačítek na
 * listových stránkách jedním spouštěčem + vysouvacím seznamem. Bere STEJNÝ `Button[]`
 * config jako `ButtonBuilderComponent` - žádná nová konfigurační vrstva.
 *
 * @refactor-note (2026-08-24) KONSOLIDACE TOOLBAR TLAČÍTEK - viz předchozí verze
 * hlavičky souboru pro plný kontext (Filtry/Přidat/Export/Import/Koš sjednoceny do
 * jednoho tlačítka "Akce").
 *
 * @refactor-note (2026-08-24v2) BACKLOG "dropdown se zařezává do okraje obrazovky /
 * je schovaný pod jinými prvky": menu už není pozicované relativně uvnitř
 * `.action-menu` (běžný `position:absolute` v layoutu), ale FIXNĚ vůči viewportu,
 * spočítané ručně z `getBoundingClientRect()` spouštěcího tlačítka - řeší to
 * zařezávání do pravého okraje na užších obrazovkách a schovávání pod `overflow:hidden`
 * kontejnery (např. `.table-responsive` v table-style.css), kterými `position:absolute`
 * menu dřív procházet nemohlo.
 * - `menuPosition` je `null` mezi otevřením menu a prvním změřením (`positionMenu()`
 *   běží až PO vykreslení `@if (isOpen)` bloku, protože potřebuje `#menu` v DOM kvůli
 *   vlastní šířce/výšce) - `.html` proto menu vykreslí, ale `[style.visibility]:hidden`,
 *   dokud `menuPosition` není spočítané, ať není vidět "cuknutí" ze špatné pozice.
 * - Přepočet probíhá i na `window:resize`/`window:scroll` (capture, ať zachytí i scroll
 *   uvnitř vnořených scrollovatelných kontejnerů, ne jen scroll celé stránky), dokud je
 *   menu otevřené - jinak by zůstalo "přilepené" na staré pozici po scrollu/resize.
 */
import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, ElementRef, ViewChild, inject
} from '@angular/core';
import { Button } from '../../../../shared/interfaces/button';

export interface ActionMenuPosition {
  top: number;
  left: number;
}

/**
 * @description Vykresluje jedno spouštěcí tlačítko a po kliknutí vysouvací seznam akcí,
 * fixně pozicovaný vůči viewportu (viz refactor-note 2026-08-24v2).
 * @usage Drop-in náhrada za `<app-button-builder>` na listových stránkách admin sekce -
 * stačí vyměnit tag v šabloně, `[configs]` binding zůstává stejný.
 */
@Component({
  selector: 'app-action-menu-builder',
  standalone: true,
  imports: [],
  templateUrl: './action-menu-builder.component.html',
  styleUrl: './action-menu-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionMenuBuilderComponent {
  @Input() configs: Button[] = [];
  @Input() triggerLabel = 'Akce';
  @Input() triggerIcon = '⋯';

  @Output() actionTriggered = new EventEmitter<string>();

  isOpen = false;

  /** Spočítaná fixed pozice menu vůči viewportu - null = ještě nezměřeno (viz refactor-note výše). */
  menuPosition: ActionMenuPosition | null = null;

  @ViewChild('trigger') private triggerRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('menu') private menuRef?: ElementRef<HTMLDivElement>;

  private host = inject(ElementRef<HTMLElement>);
  private cd = inject(ChangeDetectorRef);

  /** Malá mezera (px) mezi spouštěcím tlačítkem a menu, a od okrajů viewportu. */
  private static readonly GAP = 6;
  private static readonly VIEWPORT_MARGIN = 8;

  toggleMenu(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      this.menuPosition = null;
      // Menu musí být nejdřív v DOM (za `@if (isOpen)`), než ho jde změřit -
      // `setTimeout(0)` počká na nejbližší mikro-tick po vykreslení šablony.
      setTimeout(() => this.positionMenu());
    } else {
      this.menuPosition = null;
    }
  }

  onSelect(action: string): void {
    this.isOpen = false;
    this.menuPosition = null;
    this.actionTriggered.emit(action);
  }

  /**
   * @description Spočítá fixed `top`/`left` menu podle polohy spouštěcího tlačítka a
   * skutečných rozměrů menu, s ořezáním o okraje viewportu (nikdy nevykreslí menu
   * částečně mimo obrazovku).
   */
  private positionMenu(): void {
    const triggerEl = this.triggerRef?.nativeElement;
    const menuEl = this.menuRef?.nativeElement;
    if (!triggerEl || !menuEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();

    let top = triggerRect.bottom + ActionMenuBuilderComponent.GAP;
    let left = triggerRect.right - menuRect.width;

    const maxLeft = window.innerWidth - menuRect.width - ActionMenuBuilderComponent.VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - menuRect.height - ActionMenuBuilderComponent.VIEWPORT_MARGIN;

    left = Math.min(Math.max(left, ActionMenuBuilderComponent.VIEWPORT_MARGIN), maxLeft);
    top = Math.min(top, maxTop);

    this.menuPosition = { top, left };
    this.cd.markForCheck();
  }

  /**
   * @description Zavře menu při kliknutí kamkoliv mimo komponentu - stejný vzor jako
   * `onDocumentClick()` v `TableBuilderComponent` pro `.bulk-actions-menu`. Menu je teď
   * fixed-pozicované MIMO `.action-menu` host element (vizuálně), ale je pořád jeho
   * potomek v DOM (`.html` ho vnořuje uvnitř `<div class="action-menu">`), takže
   * `contains()` kontrola funguje beze změny.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
      this.menuPosition = null;
      this.cd.markForCheck();
    }
  }

  /** @description Přepočítá pozici při scrollu (capture - zachytí i scroll uvnitř vnořených kontejnerů) a resize okna, dokud je menu otevřené. */
  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.isOpen) this.positionMenu();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isOpen) this.positionMenu();
  }
}