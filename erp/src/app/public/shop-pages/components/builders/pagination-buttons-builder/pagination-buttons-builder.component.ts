import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'app-pagination-buttons-builder',
  standalone: true,
  imports: [],
  templateUrl: './pagination-buttons-builder.component.html',
  styleUrl: './pagination-buttons-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginationButtonsBuilderComponent {
  @Input() currentPage: number = 1;
  @Input() totalPages: number = 1;
  
  @Output() pageChange = new EventEmitter<number>();

  // Výpočet pole čísel stránek
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

  onPageClick(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }
}