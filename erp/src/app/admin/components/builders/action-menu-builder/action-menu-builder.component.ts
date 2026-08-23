/**
 * @file action-menu-builder.component.ts
 * @path src/app/admin/components/builders/action-menu-builder/action-menu-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Reusable dropdown ("Akce") nahrazující řadu jednotlivých pill tlačítek na
 * listových stránkách jedním spouštěčem + vysouvacím seznamem. Bere STEJNÝ `Button[]`
 * config jako `ButtonBuilderComponent` - žádná nová konfigurační vrstva, žádná migrace
 * existujících *.config.ts souborů (kromě volitelného přidání položky pro Import, viz
 * refactor-note níže).
 *
 * @refactor-note (2026-08-24) KONSOLIDACE TOOLBAR TLAČÍTEK (backlog "moc tlačítek,
 * uživatel je zmatený proč je toho tolik"): stránkové toolbary dřív vykreslovaly
 * Filtry/Přidat/Export/Koš (a případně vlastní akce jako "Potvrzovací e-mail") jako
 * řadu tlačítek vedle sebe (`ButtonBuilderComponent`). Nahrazeno JEDNÍM tlačítkem
 * "Akce" - po rozkliknutí se pod ním zobrazí stejné položky jako svislý seznam,
 * vizuálně stejný vzor jako `.bulk-actions-bar` nad tabulkou (TableBuilderComponent).
 *
 * Import (dřív výhradně interní tlačítko uvnitř `TableBuilderComponent`, mimo
 * stránkový config) je teď SOUČÁSTÍ stejného pole `toolbarButtons` - stránka na něj
 * deleguje přes `ViewChild` na `activeTable.importData()`, stejně jako už dřív dělala
 * pro export (`activeTable.exportToCSV()`). Tabulky, které import ještě nemají hotový
 * na backendu, prostě dostanou chybovou hlášku z popupu (404) - stejné chování jako
 * dřív, jen tlačítko teď žije ve stránkovém configu, ne v `TableBuilderComponent`.
 *
 * `ButtonBuilderComponent` zůstává BEZE ZMĚNY a dál se používá tam, kde má smysl mít
 * tlačítka viditelná rovnou (uvnitř modalů/formulářů, ne na listových stránkách).
 *
 * @refactor-note (2026-08-24v2) MENU PŘETÉKALO MIMO OBRAZOVKU (backlog "dlouhé názvy
 * přesahují mimo, uživatel je nevidí"): `.action-menu-list` byl pozicovaný čistě CSS
 * (`position: absolute; left: 0` vůči `.action-menu`) - u tlačítek blízko pravého nebo
 * spodního okraje obrazovky (typicky "Akce" tlačítko úplně vpravo v toolbaru) tak menu
 * přeteklo mimo viewport a delší popisky (např. "Potvrzovací e-mail") nešly vůbec
 * vidět/kliknout.
 *
 * ŘEŠENÍ: `.action-menu-list` je teď `position: fixed` a jeho `top`/`left` se počítají
 * v JS (`positionMenu()`) podle SKUTEČNÉ pozice tlačítka (`getBoundingClientRect()`)
 * a SKUTEČNÝCH rozměrů menu PO vykreslení (menu se musí nejdřív vykreslit, aby šlo
 * změřit jeho šířku/výšku - proto `requestAnimationFrame` mezi `isOpen = true` a
 * měřením). Dokud není spočítaná pozice (`menuPosition === null`), menu je vykreslené
 * ale `visibility: hidden` - zabraňuje to viditelnému "cuknutí" z výchozí pozice do
 * správné. Souřadnice se navíc clampují na `viewport - 8px margin` z obou stran, takže
 * menu nikdy nepřesahuje mimo obrazovku, ani kdyby bylo tlačítko doslova v rohu.
 *
 * Zavírání menu při scrollu (`window:scroll`) je NUTNÉ přidat společně s `fixed`
 * pozicováním - na rozdíl od `absolute` (které by "jelo" se stránkou samo) by fixed
 * menu při scrollu zůstalo viset na starých, už špatných souřadnicích vůči tlačítku.
 * Zavření je jednodušší a bezpečnější než přepočítávat pozici na každý scroll event.
 * `window:resize` naopak menu nezavírá, jen přepočítá pozici (change orientace
 * mobilu apod. by jinak menu nechalo otevřené na nesmyslném místě).
 *
 * @dependencies
 * - Button: sdílené rozhraní se `ButtonBuilderComponent` - žádná duplicitní definice.
 */
import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, ElementRef, ViewChild, inject
} from '@angular/core';
import { Button } from '../../../../shared/interfaces/button';

/** Vypočítaná pozice menu vůči viewportu (px) - `null` = ještě nezměřeno/skryté. */
interface MenuPosition {
  top: number;
  left: number;
}

/**
 * @description Vykresluje jedno spouštěcí tlačítko a po kliknutí vysouvací seznam akcí,
 * vždy plně viditelný uvnitř viewportu.
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
  /** Stejný config formát jako `ButtonBuilderComponent.configs` - permission filtrování
   *  a přelabelování (Filtry/Skrýt, Aktivní/Koš) dál řeší stránka ve svém
   *  `toolbarButtons` getteru, beze změny. */
  @Input() configs: Button[] = [];

  /** Label hlavního spouštěcího tlačítka. */
  @Input() triggerLabel = 'Akce';

  /** Volitelná ikona spouštěcího tlačítka (default tři tečky). */
  @Input() triggerIcon = '⋯';

  @Output() actionTriggered = new EventEmitter<string>();

  isOpen = false;

  /** `null` dokud `positionMenu()` nezmění na skutečné souřadnice - viz refactor-note výše. */
  menuPosition: MenuPosition | null = null;

  @ViewChild('trigger', { static: false }) private triggerRef?: ElementRef<HTMLElement>;
  @ViewChild('menu', { static: false }) private menuRef?: ElementRef<HTMLElement>;

  /** Okrajová rezerva (px) od hrany viewportu - menu se nikdy nedotkne úplného okraje. */
  private static readonly VIEWPORT_MARGIN_PX = 8;
  /** Mezera (px) mezi tlačítkem a menu, stejná pro rozevření dolů i nahoru. */
  private static readonly TRIGGER_GAP_PX = 6;

  private host = inject(ElementRef<HTMLElement>);
  private cd = inject(ChangeDetectorRef);

  toggleMenu(): void {
    if (this.isOpen) {
      this.closeMenu();
      return;
    }
    this.isOpen = true;
    this.menuPosition = null;
    this.cd.markForCheck();

    // Menu musí být napřed v DOM (aby šlo změřit jeho reálnou šířku/výšku dle obsahu
    // - viz dlouhé popisky typu "Potvrzovací e-mail"), proto měření až v dalším
    // animačním framu, ne synchronně v tomto kliknutí.
    requestAnimationFrame(() => this.positionMenu());
  }

  onSelect(action: string): void {
    this.closeMenu();
    this.actionTriggered.emit(action);
  }

  private closeMenu(): void {
    this.isOpen = false;
    this.menuPosition = null;
    this.cd.markForCheck();
  }

  /**
   * @description Spočítá `top`/`left` menu ve fixed souřadnicích viewportu tak, aby se
   * vešlo celé na obrazovku:
   * - horizontálně se drží zarovnané na levý okraj tlačítka, ale posune se doleva,
   *   pokud by přetékalo přes pravý okraj (a nikdy nejde za levý okraj ani `margin`);
   * - vertikálně se primárně rozevírá POD tlačítko; pokud by se dole nevešlo, rozevře
   *   se NAD tlačítko místo toho.
   */
  private positionMenu(): void {
    const triggerEl = this.triggerRef?.nativeElement;
    const menuEl = this.menuRef?.nativeElement;
    if (!triggerEl || !menuEl) return;

    const margin = ActionMenuBuilderComponent.VIEWPORT_MARGIN_PX;
    const gap = ActionMenuBuilderComponent.TRIGGER_GAP_PX;

    const triggerRect = triggerEl.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();

    // Horizontálně: zarovnat na tlačítko, ale clampnout mezi [margin, viewport - šířka - margin].
    const maxLeft = window.innerWidth - menuRect.width - margin;
    let left = Math.min(triggerRect.left, maxLeft);
    left = Math.max(left, margin);

    // Vertikálně: preferovat dole, přepnout nahoru jen pokud se dole nevejde.
    const topBelow = triggerRect.bottom + gap;
    const fitsBelow = topBelow + menuRect.height <= window.innerHeight - margin;

    let top: number;
    if (fitsBelow) {
      top = topBelow;
    } else {
      const topAbove = triggerRect.top - menuRect.height - gap;
      top = topAbove >= margin ? topAbove : margin;
    }

    this.menuPosition = { top, left };
    this.cd.markForCheck();
  }

  /**
   * @description Zavře menu při kliknutí kamkoliv mimo komponentu - stejný vzor jako
   * `onDocumentClick()` v `TableBuilderComponent` pro `.bulk-actions-menu`. Funguje
   * i teď, kdy je `.action-menu-list` `position: fixed` mimo běžný DOM tok pod
   * `.action-menu` - `menuRef` je pořád potomek hostitele téhle komponenty v Angular
   * template stromu, takže `host.nativeElement.contains(...)` ho stále zachytí.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  /**
   * @description Zavře menu při scrollu stránky. NUTNÉ u `position: fixed` menu -
   * na rozdíl od dřívějšího `position: absolute` (které by se scrollem "vezlo" spolu
   * se stránkou samo) by fixed menu zůstalo viset na starých souřadnicích vypočítaných
   * vůči tlačítku PŘED scrollem. Zavření je jednodušší a méně křehké než menu při
   * každém scroll eventu přepočítávat.
   */
  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.isOpen) this.closeMenu();
  }

  /**
   * @description Přepočítá (nezavírá) pozici menu při resize okna - typicky otočení
   * mobilu s menu otevřeným. Na rozdíl od scrollu tu není důvod menu zavírat, stačí
   * ho přemístit na nové platné místo.
   */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isOpen) this.positionMenu();
  }
}