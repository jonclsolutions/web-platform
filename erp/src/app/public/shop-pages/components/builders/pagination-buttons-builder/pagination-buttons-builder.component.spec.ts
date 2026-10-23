/**
 * @file pagination-buttons-builder.component.spec.ts
 * @path src/app/public/shop-pages/components/builders/pagination-buttons-builder/pagination-buttons-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the shop PaginationButtonsBuilderComponent: window of max. 5 page numbers
 *   around the current page and page-change events only for valid, different pages.
 * @dependencies
 * - Real component.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaginationButtonsBuilderComponent } from './pagination-buttons-builder.component';

describe('PaginationButtonsBuilderComponent (shop)', () => {
  let fixture: ComponentFixture<PaginationButtonsBuilderComponent>;
  let pager: PaginationButtonsBuilderComponent;
  let emitted: number[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PaginationButtonsBuilderComponent] });
    fixture = TestBed.createComponent(PaginationButtonsBuilderComponent);
    pager = fixture.componentInstance;
    emitted = [];
    pager.pageChange.subscribe(p => emitted.push(p));
  });

  /**
   * @description Page window: start / middle / end of 10 pages; fewer pages than 5.
   * @input (1, 10); (5, 10); (10, 10); (2, 3).
   * @output [1..5]; [3..7]; [6..10]; [1, 2, 3].
   */
  it('shows a window of up to five pages', () => {
    const window = (current: number, total: number) => { pager.currentPage = current; pager.totalPages = total; return pager.pagesArray; };
    expect(window(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(window(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(window(10, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(window(2, 3)).toEqual([1, 2, 3]);
  });

  /**
   * @description Clicks emit only valid other pages; buttons are rendered.
   * @input current 2 of 3: click 0, 2, 4, 3 and the rendered buttons.
   * @output emitted [3, …] only for valid pages.
   */
  it('emits valid page changes', () => {
    fixture.componentRef.setInput('currentPage', 2);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();
    pager.onPageClick(0);
    pager.onPageClick(2);
    pager.onPageClick(4);
    pager.onPageClick(3);
    expect(emitted).toEqual([3]);
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).forEach(b => b.click());
    expect(emitted.every(p => p === 1 || p === 3)).toBeTrue();
    expect(emitted.length).toBeGreaterThan(1);
  });
});
