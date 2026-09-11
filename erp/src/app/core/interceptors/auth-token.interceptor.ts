/**
 * @file auth-token.interceptor.ts
 * @path src/app/core/interceptors/auth-token.interceptor.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Interceptor that automatically attaches JWT tokens to outgoing requests and handles token refreshing upon 401 Unauthorized responses.
 * @dependencies
 * - AuthService: Provides token retrieval, refresh logic, and authentication state management.
 * - Router: Handles navigation to the login page when authentication sessions expire.
 */

import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

/**
 * @description Manages secure API communication by injecting access tokens and orchestrating the token refresh flow.
 * @usage Registered in the application configuration to globally secure HTTP traffic.
 * @note Implements a 'refresh lock' using BehaviorSubject to prevent multiple simultaneous refresh requests when multiple components trigger 401 errors at once.
 */
@Injectable()
export class AuthTokenInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(private authService: AuthService, private router: Router) {}

  /**
   * @description Intercepts requests to add Authorization headers and catches 401 errors for token refresh.
   * @param request The outgoing HTTP request.
   * @param next The next handler in the chain.
   * @returns {Observable<HttpEvent<unknown>>} The request stream.
   */
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (request.url.includes('/projects/public/')) {
      return next.handle(request);
    }
    const accessToken = this.authService.getAccessToken();
    if (accessToken) {
      request = this.addToken(request, accessToken);
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !request.url.includes('/login') && !request.url.includes('/refresh')) {
          return this.handle401Error(request, next);
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * @description Creates a cloned request with the Authorization header.
   * @param request The original request.
   * @param token The JWT access token.
   * @returns {HttpRequest<unknown>} A new request instance.
   */
  private addToken(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
    return request.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  /**
   * @description Orchestrates the token refresh flow when a 401 error occurs.
   * @param request The failed request.
   * @param next The next handler in the chain.
   * @returns {Observable<HttpEvent<unknown>>} The retried request stream.
   * @note If a refresh is already in progress, it queues subsequent requests until the new token is available.
   */
  private handle401Error(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshAccessToken().pipe(
        switchMap((response: any) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(response.token);
          return next.handle(this.addToken(request, response.token));
        }),
        catchError((err: any) => {
          this.isRefreshing = false;
          this.authService.clearAuthData();
          this.router.navigate(['/auth/login']);
          return throwError(() => err);
        })
      );
    } else {
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(token => next.handle(this.addToken(request, token)))
      );
    }
  }
}