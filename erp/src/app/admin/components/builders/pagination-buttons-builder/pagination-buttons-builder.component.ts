import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms'; 

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

  onPageClick(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }

  onItemsPerPageSelect(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.itemsPerPageChange.emit(value);
  }
}