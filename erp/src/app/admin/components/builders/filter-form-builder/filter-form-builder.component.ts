/**
 * @file filter-form-builder.component.ts
 * @path src/app/admin/components/builders/filter-form-builder/filter-form-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description A dynamic form builder for generating filter interfaces based on column definitions.
 * @dependencies
 * - FormsModule: Angular template-driven form support.
 * - FilterColumns: Interface defining the structure and metadata of filterable columns.
 */

import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterColumns } from '../../../../shared/interfaces/filter-columns';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
/**
 * @description Key under which the global full-text filter is sent in the emitted filter
 * object (`{ search: '...', sort_by: ..., sort_direction: ... }`). A shared constant, so the
 * same literal is not repeated in three places of this class.
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
  /** Emitted by a click on the close cross in the corner of the filter. */
  @Output() closed = new EventEmitter<void>();
  public readonly i18n = inject(AdminLocalizationService);

  /**
   * @description Merged `shared` + `filter-form` i18n section.
   * @note Type `any` on purpose - see `AdminLocalizationService.getMergedSection()`.
   */
  public get strings(): any {
    return this.i18n.getMergedSection('filter-form');
  }
  public filterForm: any = {};
  public sortBy: string = '';
  public sortDirection: 'asc' | 'desc' = 'asc';

  /** Exposed to the template for `[(ngModel)]="filterForm[globalSearchKey]"`, so the
   *  literal `'search'` is not repeated in the .html file. */
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

    // Global search - same logic as the column filters above (do not overwrite the value
    // the user is typing), but outside the `filterColumns` loop, because it does not depend
    // on the page configuration at all.
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

    // An empty global search is not sent at all, like empty column filters - the backend
    // does not have to tell "not filled in" from "filled in with an empty string".
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
   * @description Emits `closed` - a click on the close cross in the corner of the filter. The
   * component does not control its own visibility (the parent page holds it in
   * `isFilterVisible`), it only asks to be closed.
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