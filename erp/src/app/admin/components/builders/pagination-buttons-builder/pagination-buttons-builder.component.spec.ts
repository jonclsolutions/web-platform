/**
 * @file pagination-buttons-builder.component.spec.ts
 * @path src/app/admin/components/builders/pagination-buttons-builder/pagination-buttons-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PaginationButtonsBuilderComponent – range text, 5-page window,
 *   page / page-size events of the admin tables.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationButtonsBuilderComponent } from './pagination-buttons-builder.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('PaginationButtonsBuilderComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<PaginationButtonsBuilderComponent>;
  let component: PaginationButtonsBuilderComponent;

  const set = (inputs: Record<string, number>) => {
    Object.entries(inputs).forEach(([k, v]) => fixture.componentRef.setInput(k, v));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    ctx.i18n.getMergedSection.and.returnValue({
      showing_range: 'Showing {start}–{end} of {total}', no_records: 'No records',
      items_per_page_label: 'Rows', nav_aria: 'Pages'
    });
    await TestBed.configureTestingModule({ imports: [PaginationButtonsBuilderComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(PaginationButtonsBuilderComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description The info line shows the row range of the current page.
   * @input  currentPage 2, itemsPerPage 15, totalItems 40
   * @output rangeStart 16, rangeEnd 30, text 'Showing 16–30 of 40'
   */
  it('shows the row range of the current page', () => {
    set({ currentPage: 2, itemsPerPage: 15, totalItems: 40, totalPages: 3 });
    expect(component.rangeStart).toBe(16);
    expect(component.rangeEnd).toBe(30);
    expect(fixture.nativeElement.querySelector('.pagination-info').textContent.trim()).toBe('Showing 16–30 of 40');
  });

  /**
   * @description The last page ends at the total number of rows.
   * @input  currentPage 3, itemsPerPage 15, totalItems 40
   * @output rangeEnd 40
   */
  it('caps the range at the total on the last page', () => {
    set({ currentPage: 3, itemsPerPage: 15, totalItems: 40, totalPages: 3 });
    expect(component.rangeEnd).toBe(40);
  });

  /**
   * @description With no rows the range is 0–0 and the "no records" text is shown.
   * @input  totalItems 0
   * @output rangeStart 0, rangeEnd 0, info text 'No records'
   */
  it('shows "no records" for an empty table', () => {
    set({ totalItems: 0, totalPages: 1 });
    expect(component.rangeStart).toBe(0);
    expect(component.rangeEnd).toBe(0);
    expect(fixture.nativeElement.querySelector('.pagination-info').textContent.trim()).toBe('No records');
  });

  /**
   * @description At most 5 page buttons, centred on the current page when possible.
   * @input  totalPages 10 with currentPage 1, 5 and 10
   * @output [1..5], [3..7], [6..10]
   */
  it('shows a window of at most 5 pages', () => {
    set({ totalPages: 10, currentPage: 1 });
    expect(component.pagesArray).toEqual([1, 2, 3, 4, 5]);
    set({ currentPage: 5 });
    expect(component.pagesArray).toEqual([3, 4, 5, 6, 7]);
    set({ currentPage: 10 });
    expect(component.pagesArray).toEqual([6, 7, 8, 9, 10]);
  });

  /**
   * @description With fewer than 5 pages all of them are shown.
   * @input  totalPages 2
   * @output [1, 2]
   */
  it('shows every page when there are fewer than 5', () => {
    set({ totalPages: 2, currentPage: 1 });
    expect(component.pagesArray).toEqual([1, 2]);
  });

  /**
   * @description Clicking a valid other page emits it; invalid pages and the current page do not.
   * @input  totalPages 3, currentPage 2; onPageClick(3), (2), (0), (4)
   * @output pageChange emits only 3
   */
  it('emits pageChange only for valid other pages', () => {
    set({ totalPages: 3, currentPage: 2 });
    const pages: number[] = [];
    component.pageChange.subscribe(p => pages.push(p));
    [3, 2, 0, 4].forEach(p => component.onPageClick(p));
    expect(pages).toEqual([3]);
  });

  /**
   * @description Previous / next arrows are disabled on the first / last page.
   * @input  totalPages 3, currentPage 1, then 3
   * @output first: prev disabled, next enabled; last: next disabled
   */
  it('disables the arrows at the edges', () => {
    set({ totalPages: 3, currentPage: 1 });
    let arrows = fixture.nativeElement.querySelectorAll('.nav-arrow');
    expect(arrows[0].disabled).toBeTrue();
    expect(arrows[1].disabled).toBeFalse();
    set({ currentPage: 3 });
    arrows = fixture.nativeElement.querySelectorAll('.nav-arrow');
    expect(arrows[1].disabled).toBeTrue();
  });

  /**
   * @description Choosing a page size emits it as a number.
   * @input  select change to '50'
   * @output itemsPerPageChange emits 50 (number)
   */
  it('emits the chosen page size as a number', () => {
    set({ totalPages: 1 });
    const sizes: number[] = [];
    component.itemsPerPageChange.subscribe(v => sizes.push(v));
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(sizes).toEqual([50]);
  });
});
