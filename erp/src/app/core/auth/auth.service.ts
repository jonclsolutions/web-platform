/**
 * @file auth.service.ts
 * @path src/app/core/auth/auth.service.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2025
 * @description Core authentication service managing login, session persistence, token lifecycle, and user authorization state.
 * @dependencies
 * - HttpClient: Facilitates API communication for authentication endpoints.
 * - PermissionService: Synchronizes user permissions within the application.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, timer, Subject } from 'rxjs';
import { tap, catchError, switchMap, takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PermissionService } from './services/permission.service';

/**
 * @description Handles user authentication, including JWT storage, automated token refreshing, and session cleanup.
 * @usage Injected into components and interceptors to verify session state and secure API communication.
 * @note Implements an automatic background refresh timer to maintain user sessions for the duration of activity.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = environment.base_api_url;

  private _isLoggedIn = new BehaviorSubject<boolean>(!!sessionStorage.getItem('accessToken'));
  public isLoggedIn$ = this._isLoggedIn.asObservable();
  
  private _userEmailSubject = new BehaviorSubject<string | null>(sessionStorage.getItem('userEmail'));
  public userEmail$ = this._userEmailSubject.asObservable();

  private stopTokenRefresh$ = new Subject<void>();
  private readonly REFRESH_INTERVAL = 20 * 60 * 1000;

  constructor(
    private http: HttpClient,
    private permissionService: PermissionService
  ) {
    if (this.getAccessToken()) {
      this.startTokenRefreshTimer();
      this.syncPermissions();
    }
  }

  /**
   * @description Authenticates the user and initializes the session state.
   * @param credentials Login object containing email and password.
   * @returns {Observable<any>} The authentication response from the API.
   * @note Persists tokens and permission metadata into sessionStorage upon successful login.
   */
  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/login`, credentials).pipe(
      tap((response: any) => {
        const userId = (response.user.id || response.user.user_login_id).toString();
        
        sessionStorage.setItem('accessToken', response.token);
        sessionStorage.setItem('refreshToken', response.refreshToken);
        sessionStorage.setItem('userEmail', response.user.user_email);
        sessionStorage.setItem('userId', userId);
        
        if (response.user_roles?.length > 0) {
          sessionStorage.setItem('userRole', response.user_roles[0]); 
        }

        if (response.user_permissions) {
          sessionStorage.setItem('userPermissions', JSON.stringify(response.user_permissions));
          this.permissionService.setPermissions(response.user_permissions);
        }

        this._userEmailSubject.next(response.user.user_email);
        this._isLoggedIn.next(true);
        this.startTokenRefreshTimer();
      }),
      catchError(this.handleError)
    );
  }

  /**
   * @description Verifies the existence of a valid access token.
   * @returns {Observable<boolean>} True if authorized, false otherwise.
   */
  checkAuth(): Observable<boolean> {
    const token = this.getAccessToken();
    if (!token) {
      this._isLoggedIn.next(false);
      return of(false);
    }
    
    this._isLoggedIn.next(true);
    return of(true);
  }

  /**
   * @description Requests a new access token using the stored refresh token.
   * @returns {Observable<any>} The new token payload.
   * @note If refresh fails (e.g., token expired), it clears local session data.
   */
  refreshAccessToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearAuthData();
      return throwError(() => new Error('Refresh token missing'));
    }

    return this.http.post<any>(`${this.baseUrl}/refresh`, { refreshToken }).pipe(
      tap(res => {
        sessionStorage.setItem('accessToken', res.token);
        sessionStorage.setItem('refreshToken', res.refreshToken);
        this._isLoggedIn.next(true);
      }),
      catchError(err => {
        this.clearAuthData();
        return throwError(() => err);
      })
    );
  }

  /**
   * @description Wipes all session storage and resets authentication state.
   */
  public clearAuthData(): void {
    sessionStorage.clear();
    this.permissionService.clearPermissions();
    this._isLoggedIn.next(false);
    this._userEmailSubject.next(null);
    this.stopTokenRefreshTimer();
  }

  public getUserId(): string | null { return sessionStorage.getItem('userId'); }
  public getUserEmail(): string | null { return sessionStorage.getItem('userEmail'); }
  public setUserEmail(email: string): void {
    sessionStorage.setItem('userEmail', email);
    this._userEmailSubject.next(email);
  }
  public getUserRole(): string | null { return sessionStorage.getItem('userRole'); }
  public getAccessToken(): string | null { return sessionStorage.getItem('accessToken'); }
  public getRefreshToken(): string | null { return sessionStorage.getItem('refreshToken'); }

  /**
   * @description Retrieves and deserializes user permissions from storage.
   * @returns {string[]} An array of permission strings.
   * @note Fallback to empty array if no permissions found.
   */
  public getUserPermissions(): string[] {
    const perms = sessionStorage.getItem('userPermissions');
    return perms ? JSON.parse(perms) : [];
  }

  /**
   * @description Logs out the user and invalidates the session on the backend.
   */
  logout(): Observable<any> {
    const body = { refreshToken: this.getRefreshToken() };
    return this.http.post<any>(`${this.baseUrl}/logout`, body).pipe(
      tap(() => this.clearAuthData()),
      catchError(() => {
        this.clearAuthData();
        return of(null);
      })
    );
  }

  /**
   * @description Initializes a periodic refresh timer for the access token.
   * @note Uses takeUntil to ensure clean termination when the user logs out.
   */
  private startTokenRefreshTimer(): void {
    this.stopTokenRefreshTimer();
    timer(this.REFRESH_INTERVAL, this.REFRESH_INTERVAL).pipe(
      switchMap(() => this.refreshAccessToken()),
      takeUntil(this.stopTokenRefresh$)
    ).subscribe();
  }

  private stopTokenRefreshTimer(): void { 
    this.stopTokenRefresh$.next(); 
  }

  private syncPermissions(): void {
    const perms = this.getUserPermissions();
    this.permissionService.setPermissions(perms);
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Login failed.';
    if (error.status === 401) errorMessage = 'Invalid credentials.';
    return throwError(() => new Error(errorMessage));
  }
}