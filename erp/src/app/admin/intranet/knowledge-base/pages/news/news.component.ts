/**
 * @file news.component.ts
 * @path src/app/admin/pages/news/news.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page component for displaying a scrollable list of news articles with infinite-scroll functionality.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for paginated API requests.
 * - LoadingService: Manages application-wide loading states to prevent redundant network calls.
 * - GenericTableService: Handles pagination logic and response processing.
 */

import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GenericTableService, PaginatedResponse } from '../../../../../core/services/generic-table.service';
import { BaseDataComponent } from '../../../../components/base-data/base-data.component';
import { DataHandler } from '../../../../../core/services/data-handler.service';
import { finalize } from 'rxjs/operators';

/**
 * @description Manages the display and incremental loading of news content.
 * @usage Used to render news streams that support infinite scrolling in the user interface.
 * @note Extends BaseDataComponent to leverage paginated fetch logic while maintaining a local buffer (accumulatedNews) for seamless list expansion.
 */
@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news.component.html',
  styleUrl: './news.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsComponent extends BaseDataComponent<any> implements OnInit {

  override apiEndpoint: string = 'web/news';
  protected override translationSection: string = 'kb-news';

  public override t(key: string): string {
    return this.i18n.getValue(`kb-news.${key}`);
  }

  /** @description BCP-47 locale for the `DatePipe` in the template. */
  get dateLocale(): string {
    return this.i18n.getDateLocale();
  }

  /** * @description Buffer storing all loaded news items for the infinite scroll list. */
  accumulatedNews: any[] = [];
  /** A page request is running (guards against double "load more"). */
  private loadingMore = false;

  constructor(
    protected override dataHandler: DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: GenericTableService 
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadMore();
  }

  /**
   * @description Fetches the next page of news articles and appends them to the existing collection.
   * @note Prevents execution if a load is already in progress or if all pages have been exhausted.
   */

  loadMore(): void {
    // 1. Stop when already loading or at the end
    if (this.loadingMore || (this.currentPage > this.totalPages && this.totalPages !== 0)) {
      return;
    }
    this.loadingMore = true;

    // 2. Call fetchPaginatedData through the delegated 'list' service
    this.list.fetchPaginatedData(
      false, 
      this.currentPage, 
      this.itemsPerPage, 
      { sort_by: 'created_at', sort_direction: 'desc' }
    ).pipe(finalize(() => { this.loadingMore = false; })).subscribe({
      next: (response: PaginatedResponse<any>) => {
        if (response && response.data) {
          // 3. Accumulate the data
          this.accumulatedNews = [...this.accumulatedNews, ...response.data];
          // 4. Increment the page (note: PaginatedListStore may already handle this internally)
          this.currentPage++;
        }
        this.cd.markForCheck();
      },
      error: (err: any) => {
        console.error('Error loading news articles:', err);
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Determines if additional content is available for loading.
   * @returns {boolean} True if there are more pages or if the total page count hasn't been determined yet.
   */
  get hasMore(): boolean {
    return this.totalPages === 0 || this.currentPage <= this.totalPages;
  }
}