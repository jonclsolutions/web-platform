/**
 * @file portal-login.component.ts
 * @path src/app/apps/project-portal/public/portal-login/portal-login.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Routed sign-in page of the client project portal (/projects/login/:token): login
 *   name + password, or a one-time code e-mailed to the account; also signs in with the
 *   one-time link of an e-mail (`?access=`). After a successful sign-in it opens the portal
 *   (/projects/:token, with `?section=` when the e-mail asked for one). Rendered in the shared
 *   sign-in layout (AuthShellComponent) with the language switcher of the portal texts.
 * @dependencies PublicDataService, ProjectPortalLocalizationService (texts, languages),
 *   AuthShellComponent, AuthLanguageSwitcherComponent, leaveOnMaintenance.
 */

import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, takeUntil, finalize } from 'rxjs';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { SKIP_ADMIN_AUTH_CONTEXT } from '../../../../core/interceptors/skip-admin-auth';
import { ProjectPortalLocalizationService } from '../project-portal-localization.service';
import { AuthShellComponent } from '../../../../shared/components/auth-shell/auth-shell.component';
import { AuthLanguageSwitcherComponent } from '../../../../shared/components/auth-language-switcher/auth-language-switcher.component';
import { leaveOnMaintenance } from '../maintenance/portal-maintenance';

/** How the login screen signs in: password, or a code e-mailed to the account. */
export type PortalLoginMode = 'password' | 'code';

@Component({
  selector: 'app-portal-login',
  standalone: true,
  imports: [FormsModule, AuthShellComponent, AuthLanguageSwitcherComponent],
  templateUrl: './portal-login.component.html',
  styleUrls: ['../../../../shared/styles/base.css', '../../../../shared/styles/auth-form.css', './portal-login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortalLoginComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private publicDataService = inject(PublicDataService);
  private destroy$ = new Subject<void>();

  public readonly portalI18n = inject(ProjectPortalLocalizationService);

  public t(key: string): string {
    return this.portalI18n.getValue(key);
  }

  /** Languages of the portal texts (switcher in the top-right corner). */
  readonly languages = this.portalI18n.availableLanguages;

  /** @description Code of the current language of the portal texts. */
  get currentLanguage(): string {
    return this.portalI18n.getCurrentLanguage();
  }

  /**
   * @description Switches the language of the portal texts (remembered in the browser).
   * @param code Language code.
   */
  selectLanguage(code: string): void {
    this.portalI18n.setLanguage(code);
  }

  /** Access token of the project (route parameter). */
  token = '';
  /** Section asked for by the address (`?section=` of an e-mail) - opened after the sign-in. */
  private section: string | null = null;

  loginUsername = '';
  loginPassword = '';
  loginMode: PortalLoginMode = 'password';
  /** Code mode: the code was requested (second step - enter it). */
  codeRequested = false;
  loginCode = '';
  /** Neutral confirmation after a code request (never says whether the account exists). */
  loginInfo: string | null = null;
  loginError: string | null = null;
  loginLoading = false;

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    const query = this.route.snapshot.queryParamMap;
    this.section = query.get('section');

    this.portalI18n.translations$.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());

    const link = query.get('access');
    if (link) this.loginWithLink(link);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private portalGet<T>(path: string): Observable<T> {
    return this.publicDataService.get<T>(path, undefined, undefined, SKIP_ADMIN_AUTH_CONTEXT).pipe(leaveOnMaintenance(this.router));
  }

  private portalPost<T>(path: string, body: any): Observable<T> {
    return this.publicDataService.post<T>(path, body, undefined, SKIP_ADMIN_AUTH_CONTEXT).pipe(leaveOnMaintenance(this.router));
  }

  /** @description Signed in: opens the portal (the resolver of that route loads the project). */
  private enterPortal(): void {
    this.router.navigate(['/projects', this.token], {
      queryParams: this.section ? { section: this.section } : {},
      replaceUrl: true,   // Back must not return to the login
    });
  }

  setLoginMode(mode: PortalLoginMode): void {
    this.loginMode = mode;
    this.loginError = null;
    this.loginInfo = null;
    this.codeRequested = false;
    this.loginCode = '';
    this.cdr.markForCheck();
  }

  requestCode(): void {
    if (!this.loginUsername.trim() || this.loginLoading) return;
    this.loginLoading = true;
    this.loginError = null;
    this.cdr.markForCheck();
    this.portalPost(`projects/public/${this.token}/login/code-request`, { identifier: this.loginUsername.trim() })
      .pipe(finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.codeRequested = true; this.loginInfo = 'login_code_sent'; },
        error: (err: any) => {
          this.loginError = err?.status === 404 ? 'error_project_not_found' : err?.status === 429 ? 'error_too_many_attempts' : 'error_code_request_failed';
        },
      });
  }

  loginWithCode(): void {
    const code = this.loginCode.replace(/\s/g, '');
    if (!this.loginUsername.trim() || code.length < 6 || this.loginLoading) return;
    this.loginLoading = true;
    this.loginError = null;
    this.cdr.markForCheck();
    this.portalPost(`projects/public/${this.token}/login/code`, { identifier: this.loginUsername.trim(), code })
      .pipe(finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.loginInfo = null; this.enterPortal(); },
        error: (err: any) => { this.loginError = err?.status === 429 ? 'error_too_many_attempts' : 'error_code_invalid'; },
      });
  }

  login(): void {
    if (!this.loginUsername.trim() || !this.loginPassword.trim() || this.loginLoading) return;
    this.loginLoading = true;
    this.loginError = null;
    this.cdr.markForCheck();
    this.portalPost(`projects/public/${this.token}/login`, { username: this.loginUsername.trim(), password: this.loginPassword })
      .pipe(finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: () => this.enterPortal(),
        error: (err: any) => {
          this.loginError = err?.status === 404
            ? 'error_project_not_found'
            : err?.status === 429 ? 'error_too_many_attempts' : 'error_invalid_login';
        }
      });
  }

  /**
   * @description Signs in with the one-time link of an e-mail and removes it from the address
   *   (it works once; a reload must not try it again). A spent / expired link: an existing
   *   session still opens the portal, otherwise the code mode with the reason.
   */
  private loginWithLink(link: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { access: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.loginLoading = true;
    this.cdr.markForCheck();
    this.portalPost(`projects/public/${this.token}/login/link`, { link })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.enterPortal(),
        error: (err: any) => {
          if (err?.status === 404) {
            this.loginLoading = false;
            this.loginError = 'error_project_not_found';
            this.cdr.markForCheck();
            return;
          }
          this.portalGet(`projects/public/${this.token}`).pipe(takeUntil(this.destroy$)).subscribe({
            next: () => this.enterPortal(),
            error: () => {
              this.loginLoading = false;
              this.loginMode = 'code';
              this.loginError = 'error_link_invalid';
              this.cdr.markForCheck();
            },
          });
        },
      });
  }
}