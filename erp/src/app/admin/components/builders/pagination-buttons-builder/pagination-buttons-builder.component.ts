/**
 * @file pagination-buttons-builder.component.ts
 * @path src/app/admin/components/builders/pagination-buttons-builder/pagination-buttons-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A dynamic pagination controller that provides page navigation and items-per-page selection.
 * @dependencies
 * - FormsModule: Enables template-driven bindings for the select element.
 *
 * @bugfix-note (2026-08-31) BACKLOG "špatný rozsah v 'Zobrazuji X-Y z Z záznamů'":
 * Výpočet rozsahu ("Zobrazuji X-Y") byl dřív odvozen z `dataLength` (`data.length`
 * předané rodičem, typicky `data.length` nebo `trashData.length`). Tahle hodnota se
 * ale u některých komponent rozcházela s reálným počtem záznamů na stránce
 * (např. AdministratorsComponent hlásilo 2 záznamy v `totalItems`, ale `dataLength`
 * bylo 0 - lokální `data` pole šlo mimo synchronizaci s paginačními meta daty), což
 * způsobovalo nesmyslné rozsahy typu "1-0 z 2 záznamů" nebo "1-0 z 0 záznamů".
 * ŘEŠENÍ: `rangeStart`/`rangeEnd` gettery teď počítají VÝHRADNĚ z `currentPage`,
 * `itemsPerPage` a `totalItems` - to jsou hodnoty přímo z paginačních meta dat API
 * (`current_page`/`per_page`/`total` z Laravel `paginate()`), takže jsou vždy
 * konzistentní bez ohledu na to, jak si který z ~20 resource kontrolerů/komponent
 * spravuje svoje lokální `data` pole. `dataLength` @Input zůstává zachováno (zpětná
 * kompatibilita s existujícími bindingy `[dataLength]="data.length"` napříč
 * stránkami), ale už se nepoužívá pro výpočet rozsahu - žádná úprava rodičovských
 * šablon není potřeba.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
/**
 * @description Manages pagination state, rendering a sliding window of page buttons and page-size selection.
 * @usage Included in admin list views to enable efficient navigation through large datasets.
 * @note Implements an OnPush strategy for performance and dynamic calculation of the visible page window.
 */
@Component({
  selector: 'app-pagination-buttons-builder',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './pagination-buttons-builder.component.html',
  styleUrl: './pagination-buttons-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginationButtonsBuilderComponent {
  @Input() currentPage: number = 1;
  @Input() totalPages: number = 1;
  @Input() totalItems: number = 0;
  @Input() itemsPerPage: number = 15;

  /**
   * @deprecated (2026-08-31) Už se nepoužívá pro výpočet zobrazovaného rozsahu
   * (viz `rangeStart`/`rangeEnd` níže a bugfix-note v hlavičce souboru) - `data.length`
   * se u některých komponent rozcházel s `totalItems`. @Input je zachováno jen kvůli
   * zpětné kompatibilitě se stávajícími bindingy v ~20 rodičovských šablonách; nová
   * logika je na jeho hodnotě nezávislá.
   */
  @Input() dataLength: number = 0;

  @Output() pageChange = new EventEmitter<number>();
  @Output() itemsPerPageChange = new EventEmitter<number>();
  public readonly i18n = inject(AdminLocalizationService);

  /**
   * @description Merged `shared` + `pagination` i18n section - viz refactor-note
   * v hlavičce souboru.
   * @note Typ `any` záměrně - viz `AdminLocalizationService.getMergedSection()`.
   */
  public get strings(): any {
    return this.i18n.getMergedSection('pagination');
  }

  /**
   * @description Sestavená věta "Zobrazuji X - Y z celkem Z záznamů." se třemi
   * interpolovanými hodnotami - viz refactor-note v hlavičce souboru. Šablona pro
   * `totalItems === 0` případ (žádné záznamy) používá `strings.no_records` přímo,
   * tenhle getter se pro ten stav nevolá.
   */
  get rangeText(): string {
    return this.strings.showing_range
      .replace('{start}', String(this.rangeStart))
      .replace('{end}', String(this.rangeEnd))
      .replace('{total}', String(this.totalItems));
  }
  /**
   * @description Počáteční číslo rozsahu ("Zobrazuji X - ..."). `0` u prázdné tabulky -
   * šablona v tom případě zobrazí speciální hlášku místo rozsahu (viz .html).
   * `Math.max(1, currentPage)` je obranná pojistka proti stavu `currentPage === 0`
   * (např. krátce po resetu filtrů, než store dokončí `loadInitial()`).
   */
  get rangeStart(): number {
    if (this.totalItems === 0) return 0;
    const page = Math.max(1, this.currentPage);
    return (page - 1) * this.itemsPerPage + 1;
  }

  /**
   * @description Koncové číslo rozsahu ("... - Y z Z záznamů"). Odvozeno čistě z
   * `currentPage`/`itemsPerPage`, oříznuté na `totalItems` - takže na poslední (i
   * jediné) stránce správně skončí přesně na skutečném počtu záznamů, ne na
   * teoretické kapacitě stránky.
   */
  get rangeEnd(): number {
    if (this.totalItems === 0) return 0;
    const page = Math.max(1, this.currentPage);
    return Math.min(page * this.itemsPerPage, this.totalItems);
  }

  /**
   * @description Calculates a rolling window of up to 5 page numbers centered around the current page.
   * @returns {number[]} Array of page numbers to render in the UI.
   * @note Ensures the visible window stays within [1, totalPages] bounds.
   */
  get pagesArray(): number[] {
    const max = 5;
    let start = Math.max(1, this.currentPage - Math.floor(max / 2));
    let end = Math.min(this.totalPages, start + max - 1);
    
    if (end - start + 1 < max) {
      start = Math.max(1, end - max + 1);
    }
    
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  /**
   * @description Emits a change event if the requested page is valid and different from the current one.
   * @param page The target page index.
   */
  onPageClick(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }

  /**
   * @description Handles changes to the items-per-page selection.
   * @param event The native change event from the select element.
   */
  onItemsPerPageSelect(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.itemsPerPageChange.emit(value);
  }
}