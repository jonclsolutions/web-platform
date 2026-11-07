/**
 * @file pagination-buttons-builder.component.ts
 * @path src/app/admin/components/builders/pagination-buttons-builder/pagination-buttons-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description A dynamic pagination controller that provides page navigation and items-per-page selection.
 * @dependencies
 * - FormsModule: Enables template-driven bindings for the select element.
 * - AdminLocalizationService: texts of the section `pagination`; a language switch re-renders
 *   the component (OnPush).
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

  @Output() pageChange = new EventEmitter<number>();
  @Output() itemsPerPageChange = new EventEmitter<number>();
  public readonly i18n = inject(AdminLocalizationService);
  private readonly cd = inject(ChangeDetectorRef);

  constructor() {
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => this.cd.markForCheck());
  }

  /**
   * @description Merged `shared` + `pagination` i18n section.
   * @note Type `any` on purpose - see `AdminLocalizationService.getMergedSection()`.
   */
  public get strings(): any {
    return this.i18n.getMergedSection('pagination');
  }

  /**
   * @description The built sentence "Showing X - Y of Z records." with three interpolated
   * values. For `totalItems === 0` (no records) the template uses `strings.no_records`
   * directly, this getter is not called in that state.
   */
  get rangeText(): string {
    return this.strings.showing_range
      .replace('{start}', String(this.rangeStart))
      .replace('{end}', String(this.rangeEnd))
      .replace('{total}', String(this.totalItems));
  }
  /**
   * @description Start number of the range ("Showing X - ..."). `0` for an empty table - the
   * template then shows a special message instead of the range (see .html).
   * `Math.max(1, currentPage)` guards against `currentPage === 0` (e.g. shortly after a filter
   * reset, before the store finishes `loadInitial()`).
   */
  get rangeStart(): number {
    if (this.totalItems === 0) return 0;
    const page = Math.max(1, this.currentPage);
    return (page - 1) * this.itemsPerPage + 1;
  }

  /**
   * @description End number of the range ("... - Y of Z records"). Derived only from
   * `currentPage` / `itemsPerPage`, clamped to `totalItems` - so on the last (or only) page it
   * ends exactly at the real record count, not at the theoretical page capacity.
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