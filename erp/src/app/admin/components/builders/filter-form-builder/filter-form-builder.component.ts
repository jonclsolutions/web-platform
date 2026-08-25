/**
 * @file filter-form-builder.component.ts
 * @path src/app/admin/components/builders/filter-form-builder/filter-form-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A dynamic form builder for generating filter interfaces based on column definitions.
 * @dependencies
 * - FormsModule: Angular template-driven form support.
 * - FilterColumns: Interface defining the structure and metadata of filterable columns.
 *
 * @refactor-note (2026-08-25) BACKLOG "hledat napříč vším": přidán globální fulltextový
 * input NEZÁVISLÝ na `filterColumns` - vždy zobrazený nahoře formuláře (na rozdíl od
 * jednotlivých sloupcových filtrů, které se řídí konfigurací dané stránky), odesílaný
 * pod rezervovaným klíčem `search` (`GLOBAL_SEARCH_KEY`). Backend (jednotlivé
 * kontrolery) si sám rozhodne, přes které textové sloupce `search` OR-matchuje - viz
 * `WebSalesLeadController::index()` jako existující vzor (`search` param tam už
 * fungoval, jen ne z UI). Klíč `search` je záměrně VYŇATÝ z `filterColumns` iterace ve
 * `setFilterFormValues()`/`applyFilters()`/`clearFilters()` - stará se o něj zvlášť
 * pár řádků navíc, ať zůstává nezávislý na tom, jaké sloupcové filtry daná stránka má
 * nebo nemá nakonfigurované.
 *
 * @refactor-note (2026-08-25v2) Přidán `@Output() closed` - křížek přímo v rohu
 * filtru pro jeho rychlé zavření, NEZÁVISLE na stávajícím přepínání přes "Akce"
 * dropdown v mateřské komponentě (ten zůstává, obě cesty fungují souběžně). Komponenta
 * sama NEZNÁ `isFilterVisible` stav rodiče (ten drží `BaseDataComponent`/stránka), jen
 * emituje `closed` - rodičovská stránka na to naváže stejně, jako už dnes váže
 * `toggleFilters()` na "Akce" dropdown (typicky `(closed)="toggleFilters()"`, protože
 * filtr je viditelný jen když `isFilterVisible` je `true`, takže druhé zavolání
 * `toggleFilters()` ho spolehlivě přepne zpět na `false`).
 */

import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterColumns } from '../../../../shared/interfaces/filter-columns';

/**
 * @description Klíč, pod kterým se globální fulltextový filtr posílá v emitovaném
 * filtrů objektu (`{ search: '...', sort_by: ..., sort_direction: ... }`). Sdílený
 * konstantou, ať se stejný literál neopisuje na třech místech v týhle třídě zvlášť.
 */
const GLOBAL_SEARCH_KEY = 'search';

/**
 * @description Automatically generates form controls for filtering and sorting data lists.
 * @usage Used in admin list modules to provide advanced search and sorting capabilities.
 * @note Implements a smart state management logic in `ngOnChanges` to preserve user-inputted filter values across component updates.
 */
@Component({
  selector: 'app-filter-form-builder',
  standalone: true,
  imports: [
    FormsModule
  ],
  templateUrl: './filter-form-builder.component.html',
  styleUrl: './filter-form-builder.component.css'
})
export class FilterFormBuilderComponent implements OnChanges {

  @Input() filterColumns: FilterColumns[] = [];
  @Input() filterFormTitle: string = 'Filter Data';

  @Input() initialFilters: any = {};
  @Input() initialSortBy: string = '';
  @Input() initialSortDirection: 'asc' | 'desc' = 'asc';

  @Output() filtersApplied = new EventEmitter<any>();
  @Output() filtersCleared = new EventEmitter<void>();
  /** Emitováno kliknutím na křížek v rohu filtru - viz refactor-note (2026-08-25v2). */
  @Output() closed = new EventEmitter<void>();

  public filterForm: any = {};
  public sortBy: string = '';
  public sortDirection: 'asc' | 'desc' = 'asc';

  /** Zpřístupněno šabloně pro `[(ngModel)]="filterForm[globalSearchKey]"` bez nutnosti
   *  literál `'search'` opisovat i v .html souboru. */
  public readonly globalSearchKey = GLOBAL_SEARCH_KEY;

  /**
   * @description Synchronizes input properties with the internal form state when external data changes.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialFilters'] && changes['initialFilters'].currentValue) {
      this.filterForm = { ...this.filterForm, ...changes['initialFilters'].currentValue };
    }
    if (changes['initialSortBy']) {
      this.sortBy = this.initialSortBy;
    }
    if (changes['initialSortDirection']) {
      this.sortDirection = this.initialSortDirection;
    }
    this.setFilterFormValues();
  }

  /**
   * @description Populates the filter form fields.
   * @note Prioritizes existing user-entered values in `filterForm` to maintain UX continuity, falling back to `initialFilters`.
   */
  private setFilterFormValues(): void {
    this.filterColumns.forEach(column => {
      if (this.filterForm[column.key] !== undefined && this.filterForm[column.key] !== '') {
        return;
      } else if (this.initialFilters && this.initialFilters[column.key] !== undefined) {
        this.filterForm[column.key] = this.initialFilters[column.key];
      } else {
        this.filterForm[column.key] = '';
      }
    });

    // Globální search - stejná logika jako u sloupcových filtrů výše (nepřepisovat
    // rozepsanou hodnotu uživatele), ale mimo `filterColumns` smyčku, protože na
    // konfiguraci stránky vůbec nezávisí.
    if (this.filterForm[GLOBAL_SEARCH_KEY] === undefined || this.filterForm[GLOBAL_SEARCH_KEY] === '') {
      this.filterForm[GLOBAL_SEARCH_KEY] = this.initialFilters?.[GLOBAL_SEARCH_KEY] ?? '';
    }

    this.sortBy = this.sortBy || this.initialSortBy || '';
    this.sortDirection = this.sortDirection || this.initialSortDirection || 'asc';
  }

  /**
   * @description Processes current form state, removes empty values, and emits the final filter object.
   */
  applyFilters(): void {
    const rawFilters = { ...this.filterForm };

    this.filterColumns.forEach(column => {
      if (rawFilters[column.key] === '') {
        delete rawFilters[column.key];
      }
    });

    // Prázdný globální search se stejně jako prázdné sloupcové filtry vůbec neposílá -
    // backend tak nemusí řešit rozdíl mezi "nevyplněno" a "vyplněno prázdným řetězcem".
    if (rawFilters[GLOBAL_SEARCH_KEY] === '') {
      delete rawFilters[GLOBAL_SEARCH_KEY];
    }

    const filters = {
      ...rawFilters,
      sort_by: this.sortBy,
      sort_direction: this.sortDirection
    };

    this.filtersApplied.emit(filters);
  }

  /**
   * @description Emituje `closed` - kliknutí na křížek v rohu filtru. Komponenta sama
   * neřídí svoji viditelnost (tu drží rodičovská stránka přes `isFilterVisible`), jen
   * o zavření požádá.
   */
  onClose(): void {
    this.closed.emit();
  }

  /**
   * @description Resets the internal form state to initial/empty values and notifies the parent.
   */
  clearFilters(): void {
    this.filterForm = {};

    this.filterColumns.forEach(column => {
      this.filterForm[column.key] = '';
    });
    this.filterForm[GLOBAL_SEARCH_KEY] = '';
    this.sortBy = '';
    this.sortDirection = 'asc';
    this.filtersCleared.emit();
  }
}