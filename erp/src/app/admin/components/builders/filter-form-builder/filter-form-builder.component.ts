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
    if (changes['initialFilters'] && changes['initialFilters'].currentValue) {
      // Sloučíme stávající hodnoty formuláře s novými vstupy, aby se nesmazalo to, co uživatel naklikal
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

  private setFilterFormValues(): void {
    this.filterColumns.forEach(column => {
      // 🟢 ZMĚNA: Pokud už ve formuláři hodnota je (uživatel ji vybral), nesaháme na ni.
      // Pokud tam není, zkusíme ji vzít z initialFilters. Pokud ani tam není, dáme prázdný string.
      if (this.filterForm[column.key] !== undefined && this.filterForm[column.key] !== '') {
        // Ponechat stávající hodnotu zadanou uživatelem
        return;
      } else if (this.initialFilters && this.initialFilters[column.key] !== undefined) {
        this.filterForm[column.key] = this.initialFilters[column.key];
      } else {
        this.filterForm[column.key] = '';
      }
    });
    
    this.sortBy = this.sortBy || this.initialSortBy || '';
    this.sortDirection = this.sortDirection || this.initialSortDirection || 'asc';
  }

  applyFilters(): void {
    const rawFilters = { ...this.filterForm };

    // Projdeme filtry a do eventu vymažeme ty, které uživatel nevybral (mají prázdný string '')
    this.filterColumns.forEach(column => {
      if (rawFilters[column.key] === '') {
        delete rawFilters[column.key];
      }
    });

    const filters = {
      ...rawFilters,
      sort_by: this.sortBy,
      sort_direction: this.sortDirection
    };

    this.filtersApplied.emit(filters);
  }

  clearFilters(): void {
    // Kompletní vyčištění vnitřního stavu formuláře
    this.filterForm = {};
    
    this.filterColumns.forEach(column => {
      this.filterForm[column.key] = '';
    });
    this.sortBy = '';
    this.sortDirection = 'asc';
    this.filtersCleared.emit();
  }
}