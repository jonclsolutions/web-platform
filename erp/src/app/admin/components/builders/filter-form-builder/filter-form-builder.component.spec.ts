/**
 * @file filter-form-builder.component.spec.ts
 * @path src/app/admin/components/builders/filter-form-builder/filter-form-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of FilterFormBuilderComponent – the filter panel of the admin tables
 *   (initial values, global search, sorting, which filters are sent, clearing).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { FilterFormBuilderComponent } from './filter-form-builder.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('FilterFormBuilderComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<FilterFormBuilderComponent>;
  let component: FilterFormBuilderComponent;

  const columns = [
    { key: 'name', header: 'Name', type: 'text', canSort: true },
    { key: 'status', header: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }], canSort: false },
    { key: 'secret', header: 'Secret', type: 'hidden' }
  ] as any[];

  /** Applies inputs the way Angular does (setting fields + ngOnChanges). */
  const init = (inputs: { initialFilters?: any; initialSortBy?: string; initialSortDirection?: 'asc' | 'desc' }) => {
    component.filterColumns = columns;
    const changes: any = {};
    Object.entries(inputs).forEach(([k, v]) => { (component as any)[k] = v; changes[k] = new SimpleChange(undefined, v, true); });
    component.ngOnChanges(changes);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [FilterFormBuilderComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(FilterFormBuilderComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description Initial filters and sorting from the page are copied into the form.
   * @input  initialFilters { name: 'Al', search: 'x' }, initialSortBy 'name', initialSortDirection 'desc'
   * @output filterForm { name: 'Al', status: '', secret: '', search: 'x' }; sortBy 'name'; sortDirection 'desc'
   */
  it('prefills the form from the initial filters', () => {
    init({ initialFilters: { name: 'Al', search: 'x' }, initialSortBy: 'name', initialSortDirection: 'desc' });
    expect(component.filterForm).toEqual({ name: 'Al', status: '', secret: '', search: 'x' });
    expect(component.sortBy).toBe('name');
    expect(component.sortDirection).toBe('desc');
  });

  /**
   * @description Applying sends only non-empty filters plus the sorting.
   * @input  name 'Al', status '', search ''; sortBy 'name' asc; applyFilters()
   * @output filtersApplied { name: 'Al', secret?: removed, sort_by: 'name', sort_direction: 'asc' }
   */
  it('applyFilters() sends non-empty filters with the sorting', () => {
    init({ initialFilters: { name: 'Al' }, initialSortBy: 'name', initialSortDirection: 'asc' });
    let sent: any;
    component.filtersApplied.subscribe(f => (sent = f));
    component.applyFilters();
    expect(sent).toEqual({ name: 'Al', sort_by: 'name', sort_direction: 'asc' });
  });

  /**
   * @description The global search is sent as 'search' when filled.
   * @input  filterForm.search = 'invoice'; applyFilters()
   * @output emitted filters contain search 'invoice'
   */
  it('sends the global search when filled', () => {
    init({ initialFilters: {} });
    component.filterForm.search = 'invoice';
    let sent: any;
    component.filtersApplied.subscribe(f => (sent = f));
    component.applyFilters();
    expect(sent.search).toBe('invoice');
  });

  /**
   * @description Clearing empties every field, resets sorting and tells the page.
   * @input  form with values; clearFilters()
   * @output filterForm { name: '', status: '', secret: '', search: '' }; sortBy ''; sortDirection 'asc'; filtersCleared emitted
   */
  it('clearFilters() empties the form and emits filtersCleared', () => {
    init({ initialFilters: { name: 'Al', search: 'x' }, initialSortBy: 'name', initialSortDirection: 'desc' });
    let cleared = 0;
    component.filtersCleared.subscribe(() => cleared++);
    component.clearFilters();
    expect(component.filterForm).toEqual({ name: '', status: '', secret: '', search: '' });
    expect(component.sortBy).toBe('');
    expect(component.sortDirection).toBe('asc');
    expect(cleared).toBe(1);
  });

  /**
   * @description Hidden columns are not rendered; only sortable columns are offered for sorting.
   * @input  columns name (text, sortable), status (select), secret (hidden)
   * @output 2 field labels ('Name', 'Status'); sort options '' + 'Name'
   */
  it('renders visible fields and sortable columns only', () => {
    init({ initialFilters: {} });
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.filter-grid label')).map((l: any) => l.textContent.trim());
    expect(labels).toContain('Name');
    expect(labels).toContain('Status');
    expect(labels).not.toContain('Secret');
    const sortOptions = Array.from(fixture.nativeElement.querySelectorAll('#filterSortBy option')).map((o: any) => o.value);
    expect(sortOptions).toEqual(['', 'name']);
  });

  /**
   * @description Values the user already typed are kept when the inputs change again.
   * @input  user types name 'Bob'; ngOnChanges with initialSortBy only
   * @output filterForm.name stays 'Bob'
   */
  it('keeps typed values when inputs change', () => {
    init({ initialFilters: {} });
    component.filterForm.name = 'Bob';
    init({ initialSortBy: 'name' });
    expect(component.filterForm.name).toBe('Bob');
  });

  /**
   * @description The close button emits closed.
   * @input  click .filter-form-close-btn
   * @output closed emitted once
   */
  it('close button emits closed', () => {
    init({ initialFilters: {} });
    let closed = 0;
    component.closed.subscribe(() => closed++);
    fixture.nativeElement.querySelector('.filter-form-close-btn').click();
    expect(closed).toBe(1);
  });
});
