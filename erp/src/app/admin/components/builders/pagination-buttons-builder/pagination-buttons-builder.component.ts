/**
 * @file pagination-buttons-builder.component.ts
 * @path src/app/admin/components/builders/pagination-buttons-builder/pagination-buttons-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A dynamic pagination controller that provides page navigation and items-per-page selection.
 * @dependencies
 * - FormsModule: Enables template-driven bindings for the select element.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms'; 

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
  @Input() dataLength: number = 0;

  @Output() pageChange = new EventEmitter<number>();
  @Output() itemsPerPageChange = new EventEmitter<number>();

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