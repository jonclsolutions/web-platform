/**
 * @file filter-form-builder.component.ts
 * @path src/app/admin/components/filter-form-builder/filter-form-builder.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2025
 * @description A dynamic form builder for generating filter interfaces based on column definitions.
 * @dependencies
 * - FormsModule: Angular template-driven form support.
 * - FilterColumns: Interface defining the structure and metadata of filterable columns.
 */

import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterColumns } from '../../../../shared/interfaces/filter-columns';

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

  public filterForm: any = {};
  public sortBy: string = '';
  public sortDirection: 'asc' | 'desc' = 'asc';

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

    const filters = {
      ...rawFilters,
      sort_by: this.sortBy,
      sort_direction: this.sortDirection
    };

    this.filtersApplied.emit(filters);
  }

  /**
   * @description Resets the internal form state to initial/empty values and notifies the parent.
   */
  clearFilters(): void {
    this.filterForm = {};
    
    this.filterColumns.forEach(column => {
      this.filterForm[column.key] = '';
    });
    this.sortBy = '';
    this.sortDirection = 'asc';
    this.filtersCleared.emit();
  }
}