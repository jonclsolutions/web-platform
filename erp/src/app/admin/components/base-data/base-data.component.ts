/**
 * @file base-data.component.ts
 * @path src/app/admin/components/base-data/base-data.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Abstract base class providing standardized CRUD operations, pagination, and caching logic for administrative data components.
 * @dependencies
 * - DataHandler: Facilitates HTTP communication.
 * - GenericTableService: Manages complex pagination and caching states.
 * - LoadingService, AlertDialogService, AuthService, PermissionService: Core infrastructure services for UI state and access control.
 */

import { Directive, inject } from '@angular/core'; 
import * as Core from '../../../shared/imports/core-providers';

/**
 * @description Serves as a base controller for all resource management components in the admin panel.
 * @usage Extended by specific feature components (e.g., UserComponent, ProductComponent) to eliminate boilerplate code for data fetching and manipulation.
 * @note Implements automatic caching and state synchronization between main and trash tables.
 */
@Directive()
export abstract class BaseDataComponent<T extends { id?: number; deleted_at?: string | null }> implements Core.OnInit, Core.OnDestroy, Core.OnChanges {
  data: T[] = [];
  trashData: T[] = [];
  errorMessage: string | null = null;
  protected destroy$ = new Core.Subject<void>();
  abstract apiEndpoint: string;
  
  isTableFullWidth = true;
  isFilterVisible = false;
  showTrashTable = false;
  showCreateForm = false;
  showDetails = false;

  currentPage = 1;
  itemsPerPage = 15;
  totalItems = 0;
  totalPages = 0;

  trashCurrentPage = 1;
  trashItemsPerPage = 15;
  trashTotalItems = 0;
  trashTotalPages = 0;

  protected activeCache = new Map<number, T[]>();
  protected trashCache = new Map<number, T[]>();
  protected currentActiveFilters: Core.FilterParams = {};
  protected currentTrashFilters: Core.FilterParams = {};
  
  protected defaultFilters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };

  public loadingService = inject(Core.LoadingService);
  public alertDialogService = inject(Core.AlertDialogService);
  public authService = inject(Core.AuthService);
  public permissionService = inject(Core.PermissionService);

  constructor(
    protected dataHandler: Core.DataHandler, 
    protected cd: Core.ChangeDetectorRef,
    protected genericTableService: Core.GenericTableService 
  ) {}

  public refreshData(): void {}
  
  ngOnInit(): void {}
  ngOnChanges(changes: Core.SimpleChanges): void {}
  
  /**
   * @description Cleans up resources by completing the destroy subject to unsubscribe from all active streams.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Initializes component state with authentication guard logic.
   * @param router The application router used for redirection.
   */
  protected initWithAuthCheck(router: Core.Router): void {
    this.authService.isLoggedIn$
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        if (loggedIn) this.refreshData();
        else router.navigate(['/auth/login']);
      });
  }

  /**
   * @description Fetches paginated data from the API and updates local caches.
   * @param isTrash Flag to determine if requesting active or deleted items.
   * @param page Target page number.
   * @param perPage Number of items per page.
   * @param filters Active filter configuration.
   * @returns {Core.Observable<Core.PaginatedResponse<T>>} Observable of the paginated result.
   */
  protected fetchPaginatedData(
    isTrash: boolean, 
    page: number, 
    perPage: number, 
    filters: Core.FilterParams
  ): Core.Observable<Core.PaginatedResponse<T>> {
    const cache = isTrash ? this.trashCache : this.activeCache;
    const currentStoredFilters = isTrash ? this.currentTrashFilters : this.currentActiveFilters;

    if (JSON.stringify(filters) !== JSON.stringify(currentStoredFilters)) {
      cache.clear();
      if (isTrash) {
        this.trashCurrentPage = 1;
        this.currentTrashFilters = { ...filters };
      } else {
        this.currentPage = 1;
        this.currentActiveFilters = { ...filters };
      }
    }

    if (cache.has(page)) {
      const cachedData = cache.get(page)!;
      if (isTrash) this.trashData = cachedData; else this.data = cachedData;
      this.cd.markForCheck();
      return Core.of({ 
        data: cachedData, 
        current_page: page, 
        last_page: isTrash ? this.trashTotalPages : this.totalPages, 
        total: isTrash ? this.trashTotalItems : this.totalItems 
      } as Core.PaginatedResponse<T>);
    }

    const params: Core.FilterParams = { ...filters };
    if (isTrash) params['only_trashed'] = 'true';

    return this.genericTableService.getPaginatedData<T>(this.apiEndpoint, page, perPage, params).pipe(
      Core.takeUntil(this.destroy$),
      Core.retry(1),
      Core.tap(response => {
        if (isTrash) {
          this.trashData = response.data;
          this.trashTotalItems = response.total;
          this.trashTotalPages = response.last_page;
          this.trashCurrentPage = response.current_page;
        } else {
          this.data = response.data;
          this.totalItems = response.total;
          this.totalPages = response.last_page;
          this.currentPage = response.current_page;
        }
        cache.set(page, response.data);
        this.cd.markForCheck();
      })
    );
  }

  /**
   * @description Clears all caches and refreshes both active and trash tables to synchronize state.
   */
  public forceFullRefresh(currentFilters: Core.FilterParams = this.defaultFilters): void {
    this.activeCache.clear();
    this.trashCache.clear();
    this.cd.markForCheck();

    Core.forkJoin([
      this.fetchPaginatedData(false, this.currentPage, this.itemsPerPage, currentFilters),
      this.fetchPaginatedData(true, this.trashCurrentPage, this.trashItemsPerPage, currentFilters)
    ]).pipe(
      Core.finalize(() => {
        this.cd.markForCheck();
      })
    ).subscribe();
  }

  /**
   * @description Handles pagination event for either main or trash table.
   * @param page The requested page number.
   * @param filters The currently applied filters.
   */
  onHandlePageChange(page: number, filters: Core.FilterParams = this.currentActiveFilters): void {
    if (this.showTrashTable) {
      if (page >= 1 && page <= this.trashTotalPages && page !== this.trashCurrentPage) {
        this.trashCurrentPage = page;
        this.fetchPaginatedData(true, page, this.trashItemsPerPage, filters).subscribe();
      }
    } else {
      if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
        this.currentPage = page;
        this.fetchPaginatedData(false, page, this.itemsPerPage, filters).subscribe();
      }
    }
  }

  /**
   * @description Updates items-per-page setting and resets pagination to the first page.
   */
  onHandleItemsPerPageChange(value: number, filters: Core.FilterParams = this.currentActiveFilters): void {
    if (this.showTrashTable) {
      this.trashItemsPerPage = value;
      this.trashCurrentPage = 1;
      this.trashCache.clear();
      this.fetchPaginatedData(true, 1, value, filters).subscribe();
    } else {
      this.itemsPerPage = value;
      this.currentPage = 1;
      this.activeCache.clear();
      this.fetchPaginatedData(false, 1, value, filters).subscribe();
    }
  }

  toggleTable(): void {
    this.showTrashTable = !this.showTrashTable;
    this.forceFullRefresh(this.showTrashTable ? this.currentTrashFilters : this.currentActiveFilters);
  }

  toggleFilters(): void {
    this.isFilterVisible = !this.isFilterVisible;
  }

  loadData(): void {
    if (!this.apiEndpoint) {
      this.errorMessage = 'Error: API endpoint undefined.';
      return;
    }
    this.dataHandler.getCollection<T>(this.apiEndpoint)
      .pipe(
        Core.takeUntil(this.destroy$),
        Core.finalize(() => { this.cd.markForCheck(); })
      )
      .subscribe(responseData => this.data = responseData);
  }

  getItemDetails(id: number | undefined): Core.Observable<T> {
    if (!id) return Core.throwError(() => new Error('ID undefined.'));
    const url = `${this.apiEndpoint}/${id}`;
    return this.dataHandler.get<T>(url).pipe(
      Core.takeUntil(this.destroy$),
      Core.finalize(() => { this.cd.markForCheck(); })
    );
  }

  postData(data: T): Core.Observable<T> {
    return this.dataHandler.post<T>(this.apiEndpoint, data).pipe(
      Core.takeUntil(this.destroy$),
      Core.finalize(() => { this.cd.markForCheck(); })
    );
  }
  
  updateData(id: number | undefined, data: T): Core.Observable<T> {
    if (!id) return Core.throwError(() => new Error('ID undefined.'));
    return this.dataHandler.put<T>(`${this.apiEndpoint}/${id}`, data).pipe(
      Core.takeUntil(this.destroy$),
      Core.finalize(() => { this.cd.markForCheck(); })
    );
  }
  
  deleteData(id: number | undefined, forceDelete?: boolean | undefined, params?: any): Core.Observable<void> {
    if (!id) return Core.throwError(() => new Error('ID undefined.'));
    let url = `${this.apiEndpoint}/${id}`;
    
    if (params && params.force_delete === 'true') {
      url += '?force_delete=true';
    } else if (forceDelete === true) {
      url += '?force_delete=true';
    }
    
    return this.dataHandler.delete(url).pipe(
      Core.takeUntil(this.destroy$),
      Core.finalize(() => { this.cd.markForCheck(); })
    );
  }

  restoreDataFromApi(id: number): Core.Observable<T> {
    return this.dataHandler.post<T>(`${this.apiEndpoint}/${id}/restore`, {} as T).pipe(
      Core.takeUntil(this.destroy$),
      Core.finalize(() => { this.cd.markForCheck(); })
    );
  }
  
  uploadData<U>(formData: FormData, targetUrl?: string): Core.Observable<U> {
    return this.dataHandler.upload<U>(targetUrl || this.apiEndpoint, formData).pipe(
      Core.takeUntil(this.destroy$),
      Core.finalize(() => { this.cd.markForCheck(); })
    );
  }

  public updatePassword(id: number, data: any): Core.Observable<any> {
    if (!id) return Core.throwError(() => new Error('User ID undefined.'));
    
    this.errorMessage = null;
    const url = `${this.apiEndpoint}/${id}/change-password`;

    return this.dataHandler.put<any>(url, data).pipe(
      Core.takeUntil(this.destroy$),
      Core.finalize(() => {
        this.cd.markForCheck();
      }),
      Core.catchError((err: Core.HttpErrorResponse) => {
        this.errorMessage = err.message || 'Error changing password.';
        this.cd.markForCheck();
        return Core.throwError(() => err);
      })
    );
  }

  loadAllData(filters?: Core.FilterParams): Core.Observable<T[]> {
    if (!this.apiEndpoint) {
      return Core.throwError(() => new Error('API endpoint undefined.'));
    }
    const params = new URLSearchParams();
    params.set('no_pagination', 'true');

    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof Core.FilterParams];
        if (value !== '' && value !== null && value !== undefined) {
          params.set(key, value.toString());
        }
      });
    }

    const url = `${this.apiEndpoint}?${params.toString()}`;
    return this.dataHandler.getCollection<T>(url).pipe(
      Core.takeUntil(this.destroy$),
      Core.catchError((err: Error) => {
        return Core.throwError(() => err);
      })
    );
  }

  public hardDeleteAllTrashedDataFromApi(): Core.Observable<void> {
    if (!this.apiEndpoint) {
      return Core.throwError(() => new Error('API endpoint undefined.'));
    }

    const deleteUrl = `${this.apiEndpoint}/force-delete-all`;
    this.errorMessage = null;

    return this.dataHandler.delete(deleteUrl).pipe(
      Core.takeUntil(this.destroy$),
      Core.finalize(() => {
        this.cd.markForCheck();
      }),
      Core.catchError((err: Core.HttpErrorResponse) => {
        this.errorMessage = err.message || 'Mass delete error.';
        this.cd.markForCheck();
        return Core.throwError(() => err);
      })
    );
  }
}