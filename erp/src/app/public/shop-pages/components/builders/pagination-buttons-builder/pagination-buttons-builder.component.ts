/**
 * @file pagination-buttons-builder.component.ts
 * @path src/app/public/shop-pages/components/builders/pagination-buttons-builder/pagination-buttons-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Provides a reusable pagination UI component that calculates visible page ranges and emits navigation events.
 * @dependencies
 * - Angular Core: For component, input, output, and change detection management.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

/**
 * @description Component for rendering pagination navigation controls.
 * @usage Used in catalog-like views to allow users to jump between data pages.
 * @note Uses ChangeDetectionStrategy.OnPush for optimal performance in large lists.
 */
@Component({
  selector: 'app-pagination-buttons-builder',
  standalone: true,
  imports: [],
  templateUrl: './pagination-buttons-builder.component.html',
  styleUrl: './pagination-buttons-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginationButtonsBuilderComponent {
  /** The currently active page index (1-based) */
  @Input() currentPage: number = 1;
  
  /** The total number of pages available */
  @Input() totalPages: number = 1;
  
  /** Event emitted when a user selects a new page */
  @Output() pageChange = new EventEmitter<number>();

  /**
   * @description Calculates a sliding window of visible page numbers based on the current page.
   * @returns An array of integers representing the page numbers to display.
   * @note Limits the visible range to a maximum of 5 pages for better UI scalability.
   */
  get pagesArray(): number[] {
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  /**
   * @description Validates and triggers a page change event.
   * @param page The target page index.
   */
  onPageClick(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }
}