import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { FilterColumns } from '../../../../shared/interfaces/filter-columns';

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
  @Input() filterFormTitle: string = 'Filtrovat data';

  @Input() initialFilters: any = {};
  @Input() initialSortBy: string = '';
  @Input() initialSortDirection: 'asc' | 'desc' = 'asc';

  @Output() filtersApplied = new EventEmitter<any>();
  @Output() filtersCleared = new EventEmitter<void>();

  public filterForm: any = {};
  public sortBy: string = '';
  public sortDirection: 'asc' | 'desc' = 'asc';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialFilters']) {
      this.filterForm = { ...this.initialFilters };
    }
    if (changes['initialSortBy']) {
      this.sortBy = this.initialSortBy;
    }
    if (changes['initialSortDirection']) {
      this.sortDirection = this.initialSortDirection;
    }
    this.setFilterFormValues();
  }

  private setFilterFormValues(): void {
    this.filterColumns.forEach(column => {
      this.filterForm[column.key] = this.initialFilters[column.key] || '';
    });
    this.sortBy = this.initialSortBy || '';
    this.sortDirection = this.initialSortDirection || 'asc';
  }

  applyFilters(): void {
    const filters = {
      ...this.filterForm,
      sort_by: this.sortBy,
      sort_direction: this.sortDirection
    };
    this.filtersApplied.emit(filters);
  }

  clearFilters(): void {
    this.filterColumns.forEach(column => {
      this.filterForm[column.key] = '';
    });
    this.sortBy = '';
    this.sortDirection = 'asc';
    this.filtersCleared.emit();
  }
}
