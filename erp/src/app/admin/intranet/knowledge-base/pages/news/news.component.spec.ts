/**
 * @file news.component.spec.ts
 * @path src/app/admin/intranet/knowledge-base/pages/news/news.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the intranet NewsComponent: first page on start (newest first), "load more"
 *   appends the next page, stops after the last page, ignores a second click while a page is
 *   loading (bugfix 2026-10-23) and logs load errors; the list and the empty state render.
 * @dependencies
 * - createAdminTestContext (GenericTableService spy answering per page).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { NewsComponent } from './news.component';
import { AdminTestContext, createAdminTestContext, paginated } from '../../../../../../testing/admin-test-helpers';

describe('NewsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<NewsComponent>;
  let news: NewsComponent;
  const item = (id: number) => ({ id, title: `News ${id}`, content: 'Text', bullet_1: 'B1', created_at: '2026-01-01' });

  /** Creates the page; `answer(page)` gives the response for a page. */
  function create(answer: (page: number) => any): void {
    ctx = createAdminTestContext();
    (ctx.genericTable as any).getPaginatedData.and.callFake((_e: string, page: number) => answer(page));
    TestBed.configureTestingModule({ imports: [NewsComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(NewsComponent);
    news = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description Page 1 on start sorted by date desc; load more appends page 2; after the last
   *   page no more requests; rendered titles.
   * @input 2 pages of 1 item; loadMore() ×2.
   * @output request web/news page 1 {sort_by created_at desc}; [1, 2]; hasMore false; 2 requests.
   */
  it('loads the news page by page', () => {
    create(page => of(paginated([item(page)], page, 2)));
    const call = (ctx.genericTable as any).getPaginatedData.calls.first().args;
    expect([call[0], call[1], call[3]]).toEqual(['web/news', 1, { sort_by: 'created_at', sort_direction: 'desc' }]);
    expect(news.hasMore).toBeTrue();
    news.loadMore();
    news.loadMore();
    expect(news.accumulatedNews.map(n => n.id)).toEqual([1, 2]);
    expect(news.hasMore).toBeFalse();
    expect((ctx.genericTable as any).getPaginatedData).toHaveBeenCalledTimes(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('News 2');
    expect(news.dateLocale).toBe('cs-CZ');
    expect(news.t('title')).toBe('kb-news.title');
  });

  /**
   * @description A second "load more" while a page is loading is ignored (no duplicate news).
   * @input page 2 pending; loadMore() twice; then the response.
   * @output one request for page 2; news [1, 2] (not [1, 2, 2]).
   */
  it('ignores load more while a page is loading', () => {
    const pending = new Subject<any>();
    create(page => (page === 1 ? of(paginated([item(1)], 1, 3)) : pending));
    news.loadMore();
    news.loadMore();
    expect((ctx.genericTable as any).getPaginatedData).toHaveBeenCalledTimes(2);
    pending.next(paginated([item(2)], 2, 3));
    pending.complete();
    expect(news.accumulatedNews.map(n => n.id)).toEqual([1, 2]);
  });

  /**
   * @description Errors are logged (after the store's one retry); an empty answer keeps the page;
   *   no news renders the empty state.
   * @input page 1 failing; then empty data.
   * @output console.error, accumulatedNews []; empty text rendered.
   */
  it('handles errors and empty results', () => {
    spyOn(console, 'error');
    create(() => throwError(() => new Error('x')));
    expect(console.error).toHaveBeenCalled();
    expect(news.accumulatedNews).toEqual([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('kb-news.');

    (ctx.genericTable as any).getPaginatedData.and.returnValue(of({ data: null, last_page: 0, current_page: 1, total: 0 }));
    news.loadMore();
    expect(news.accumulatedNews).toEqual([]);
  });
});
