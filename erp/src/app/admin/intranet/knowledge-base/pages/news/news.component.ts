/**
 * @file news.component.ts
 * @path src/app/admin/pages/news/news.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Page component for displaying a scrollable list of news articles with infinite-scroll functionality.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for paginated API requests.
 * - LoadingService: Manages application-wide loading states to prevent redundant network calls.
 * - GenericTableService: Handles pagination logic and response processing.
 */

import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GenericTableService, PaginatedResponse } from '../../../../../core/services/generic-table.service';
import { BaseDataComponent } from '../../../../components/base-data/base-data.component';
import { DataHandler } from '../../../../../core/services/data-handler.service';
import { LoadingService } from '../../../../../core/services/loading.service';

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
  /** * @description Injection of global loading state service to prevent concurrent requests. */
  public override loadingService = inject(LoadingService);

  override apiEndpoint: string = 'web/news';
  
  /** * @description Buffer storing all loaded news items for the infinite scroll list. */
  accumulatedNews: any[] = [];

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
    // 1. Zkontroluj, zda už nenačítáme nebo nejsme na konci
    const isCurrentlyLoading = (this.loadingService.isLoading$ as any).value;
    if (isCurrentlyLoading || (this.currentPage > this.totalPages && this.totalPages !== 0)) {
      return;
    }

    // 2. Voláme fetchPaginatedData přes delegovanou službu 'list'
    this.list.fetchPaginatedData(
      false, 
      this.currentPage, 
      this.itemsPerPage, 
      { sort_by: 'created_at', sort_direction: 'desc' }
    ).subscribe({
      next: (response: PaginatedResponse<any>) => {
        if (response && response.data) {
          // 3. Akumulujeme data
          this.accumulatedNews = [...this.accumulatedNews, ...response.data];
          // 4. Inkrementujeme stránku (Pozor: toto už může interně řešit PaginatedListStore)
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