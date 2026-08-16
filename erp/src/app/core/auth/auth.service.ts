/**
 * @file auth.service.ts
 * @path src/app/core/auth/auth.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Core authentication service managing login, session persistence, token lifecycle, and user authorization state.
 * @dependencies
 * - HttpClient: Facilitates API communication for authentication endpoints.
 * - PermissionService: Synchronizes user permissions within the application.
 * - GenericTableService: Zneplatnění tabulkové cache při změně přihlášeného uživatele
 *   (viz bugfix-note 2026-08-17 níže) - žádná cyklická závislost, GenericTableService
 *   sám na AuthService nijak nezávisí.
 * @refactor-note (2026-08-16) BACKLOG "captcha + 2FA na mail": login() už nemusí vždy
 * vydat tokeny rovnou - pokud backend vrátí requires_2fa, tokeny NEJSOU uloženy do
 * sessionStorage, dokud neproběhne verifyTwoFactor(). Persistence session logiky
 * refaktorována do sdílené persistSession(), aby ji sdílel login() i verifyTwoFactor().
 * Captcha token se posílá jako volitelný `captcha_token` - backend ho vyžaduje jen od
 * 3. neúspěšného pokusu (viz handleLoginError - `captchaRequired` flag na chybě).
 * @bugfix-note (2026-08-17) KRITICKÝ BEZPEČNOSTNÍ BUG - CROSS-USER CACHE LEAK:
 * `GenericTableService.pageCache` je JEDNA sdílená mapa pro celou SPA session
 * (`providedIn: 'root'`), jejíž cache klíč (`endpoint-page-perPage-filters`) NIKDY
 * neobsahoval identitu uživatele. Scénář: uživatel A otevře tabulku (např. koš
 * externích odkazů), cache se naplní JEHO daty. Uživatel A se odhlásí a uživatel B se
 * přihlásí BEZ reloadu stránky (běžný SPA flow) - `AuthService.clearAuthData()` sice
 * mazal `sessionStorage` a permissions, ale tabulkovou cache nechával netknutou. Když
 * uživatel B otevřel stejnou tabulku do `CACHE_TTL_MS` (3 min) od posledního fetch
 * uživatele A, `GenericTableService` vrátil starou `shareReplay` odpověď BEZ jakéhokoliv
 * nového HTTP requestu - tedy bez ohledu na to, že backend (`CoreExternalLinkController`
 * atd.) má vlastnictví správně scopované na `user_id`. Uživatel B tak v prohlížeči
 * reálně VIDĚL data uživatele A (a naopak). Oprava: `persistSession()` (dokončení
 * loginu/2FA) i `clearAuthData()` (logout, expirovaný refresh token) teď volají
 * `genericTableService.invalidateAll()` - stejný mechanismus jako globální "Aktualizovat
 * vše" tlačítko v headeru (viz TableRefreshBusService), jen automaticky při KAŽDÉ změně
 * identity přihlášeného uživatele, ne jen na ruční klik. Samo o sobě nevyvolá žádný
 * síťový dotaz - jen zajistí, že první další čtení bude vždy reálný fetch pod SPRÁVNÝM
 * uživatelem, ne zbytek po předchozím.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, timer, Subject } from 'rxjs';
import { tap, catchError, switchMap, takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PermissionService } from './services/permission.service';
import { GenericTableService } from '../services/generic-table.service';

/** Chyba loginu obohacená o informaci, zda je od teď nutná captcha. */
export interface LoginError extends Error {
  captchaRequired?: boolean;
}

/** Chyba 2FA endpointů obohacená o dobu, po které lze zkusit resend znovu (sekundy). */
export interface TwoFactorError extends Error {
  retryAfter?: number;
}

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
    private permissionService: PermissionService,
    private genericTableService: GenericTableService
  ) {
    if (this.getAccessToken()) {
      this.startTokenRefreshTimer();
      this.syncPermissions();
    }
  }

  /**
   * @description Krok 1 loginu: ověří heslo (+ captcha, pokud si ji backend vyžádal).
   * @param credentials Email, heslo a volitelný captcha_token.
   * @returns {Observable<any>} Buď plná session (token/refreshToken/user), nebo
   * `LoginTwoFactorChallenge` ({ requires_2fa: true, login_token, ... }) - v TOM případě
   * se NIC neukládá do sessionStorage, session vznikne až po verifyTwoFactor().
   */
  login(credentials: { email: string; password: string; captcha_token?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/login`, credentials).pipe(
      tap((response: any) => {
        if (response?.requires_2fa) {
          // Pending-2FA stav - záměrně se NEPERSISTUJE nikam (viz hlavička souboru).
          return;
        }
        this.persistSession(response);
      }),
      catchError(this.handleLoginError)
    );
  }

  /**
   * @description Krok 2 loginu (jen pokud login() vrátil requires_2fa): ověří OTP kód
   * a teprve po úspěchu založí skutečnou session (stejně jako dřív dělal login()).
   * @param loginToken Opaque token z kroku 1 - drží se JEN v paměti volající komponenty,
   * nikdy v sessionStorage (viz login.component.ts).
   * @param code 6místný číselný kód z e-mailu.
   */
  verifyTwoFactor(loginToken: string, code: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/login/verify-2fa`, { login_token: loginToken, code }).pipe(
      tap((response: any) => this.persistSession(response)),
      catchError(this.handleTwoFactorError)
    );
  }

  /**
   * @description Vyžádá nový OTP kód pro probíhající pending-2FA session. Backend má
   * vlastní cooldown (60s) i strop počtu resendů - 429 odpověď obsahuje `retry_after`.
   */
  resendTwoFactor(loginToken: string): Observable<{ message: string; expires_in: number }> {
    return this.http.post<any>(`${this.baseUrl}/login/resend-2fa`, { login_token: loginToken }).pipe(
      catchError(this.handleTwoFactorError)
    );
  }

  /**
   * @description Requests a password reset link for the given email (step 1 of the recovery flow).
   */
  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/forgot-password`, { email }).pipe(
      catchError(this.handlePasswordResetError)
    );
  }

  resetPassword(
    token: string,
    password: string,
    passwordConfirmation: string
  ): Observable<{ message: string; email?: string }> {
    return this.http.post<{ message: string; email?: string }>(`${this.baseUrl}/reset-password`, {
      token,
      password,
      password_confirmation: passwordConfirmation
    }).pipe(
      catchError(this.handlePasswordResetError)
    );
  }

  checkAuth(): Observable<boolean> {
    const token = this.getAccessToken();
    if (!token) {
      this._isLoggedIn.next(false);
      return of(false);
    }
    this._isLoggedIn.next(true);
    return of(true);
  }

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
   * @bugfix-note (2026-08-17) Přidáno `genericTableService.invalidateAll()` - viz
   * hlavička souboru. Volá se při KAŽDÉM ukončení session (explicitní logout přes
   * logout(), i implicitní vypršení refresh tokenu přes refreshAccessToken()), aby
   * příští uživatel na stejném zařízení/prohlížeči nikdy nedostal cache hit s daty
   * po předchozím uživateli.
   */
  public clearAuthData(): void {
    sessionStorage.clear();
    this.permissionService.clearPermissions();
    this.genericTableService.invalidateAll();
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

  public getUserPermissions(): string[] {
    const perms = sessionStorage.getItem('userPermissions');
    return perms ? JSON.parse(perms) : [];
  }

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
   * @description Uloží plnou session (access/refresh token, uživatel, role, oprávnění)
   * do sessionStorage. Sdíleno mezi přímým loginem (bez 2FA) a dokončením
   * verifyTwoFactor() - stejná logika, jen jiný vstupní endpoint.
   * @bugfix-note (2026-08-17) Přidáno `genericTableService.invalidateAll()` - viz
   * hlavička souboru. I když v mezičase proběhl `clearAuthData()` (logout), pro
   * jistotu se cache zneplatňuje i tady - pokrývá i případ, kdy by session vznikla
   * bez předchozího explicitního logoutu (např. přihlášení do jiného účtu po
   * vypršení tokenu bez viditelného "odhlášení").
   */
  private persistSession(response: any): void {
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

    this.genericTableService.invalidateAll();

    this._userEmailSubject.next(response.user.user_email);
    this._isLoggedIn.next(true);
    this.startTokenRefreshTimer();
  }

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

  /**
   * @description Mapuje chyby /login na uživatelskou zprávu a propaguje
   * `captcha_required` flag z backendu, ať komponenta ví, kdy zobrazit widget.
   */
  private handleLoginError = (error: HttpErrorResponse) => {
    const err: LoginError = new Error(
      error.error?.message ||
      (error.status === 429 ? 'Příliš mnoho pokusů. Zkuste to prosím za chvíli znovu.' : 'Přihlášení se nezdařilo.')
    );
    err.captchaRequired = !!error.error?.captcha_required;
    return throwError(() => err);
  };

  /**
   * @description Mapuje chyby /login/verify-2fa a /login/resend-2fa, propaguje
   * `retry_after` (sekundy) z 429 odpovědi pro zobrazení countdownu na resend tlačítku.
   */
  private handleTwoFactorError = (error: HttpErrorResponse) => {
    const err: TwoFactorError = new Error(
      error.error?.message || 'Ověření se nezdařilo. Zkuste to prosím znovu.'
    );
    if (error.status === 429 && error.error?.retry_after) {
      err.retryAfter = Number(error.error.retry_after);
    }
    return throwError(() => err);
  };

  private handlePasswordResetError(error: HttpErrorResponse) {
    if (error.status === 429) {
      return throwError(() => new Error('Příliš mnoho pokusů. Zkuste to prosím za chvíli znovu.'));
    }
    const backendMessage = error.error?.message;
    return throwError(() => new Error(backendMessage || 'Požadavek se nepodařilo odeslat. Zkuste to prosím znovu.'));
  }
}