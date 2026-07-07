/**
 * @file loading.interceptor.ts
 * @path src/app/core/interceptors/loading.interceptor.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Interceptor that tracks global HTTP activity to manage the application's loading state.
 * @dependencies
 * - LoadingService: Used to toggle the global loading visibility.
 */

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

/**
 * @description Monitors all outgoing HTTP requests and controls a loading indicator.
 * @usage Registered in the application configuration to automatically handle UI loading states.
 * @note Implements a 500ms delay before showing the indicator to prevent flickering on fast requests.
 */
@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private activeRequests = 0;

  constructor(private loadingService: LoadingService) { }

  /**
   * @description Intercepts HTTP requests, tracks active counts, and manages the loading indicator.
   * @param request The outgoing HTTP request.
   * @param next The next handler in the interceptor chain.
   * @returns {Observable<HttpEvent<any>>} The request stream.
   * @note If multiple requests are fired, the loading state persists until all are finalized.
   */
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.activeRequests++;

    /**
     * @description Delayed trigger to show the loading indicator.
     * @note Only triggers if the request takes longer than 500ms, enhancing user experience by avoiding micro-flickers.
     */
    const timer = setTimeout(() => {
      if (this.activeRequests > 0) {
        this.loadingService.show();
      }
    }, 500);

    return next.handle(request).pipe(
      finalize(() => {
        clearTimeout(timer);
        this.activeRequests--;
        if (this.activeRequests === 0) {
          this.loadingService.hide();
        }
      })
    );
  }
}