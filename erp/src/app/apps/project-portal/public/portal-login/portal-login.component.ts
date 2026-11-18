/**
 * @file portal-login.component.ts
 * @path src/app/apps/project-portal/public/login/portal-login.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sign-in of the client project portal, extracted from ProjectPortalComponent: login
 *   name + password, or a one-time code e-mailed to the account (two steps: request, enter).
 *   Behaviour is unchanged - the component only owns the form state and the three requests
 *   (`login`, `login/code-request`, `login/code`); the session itself stays in the HttpOnly
 *   cookie set by the API.
 * @usage `<app-portal-login [token]="token" [initialMode]="…" [initialError]="…" (signedIn)="enterPortal($event)">`
 *   The parent shows it while `state === 'login'` and receives the project of the signed-in
 *   account through `signedIn`. A fresh instance (e.g. after a logout) starts from a clean form.
 * @note Every request goes through `leaveOnMaintenance()` (a 503 opens the maintenance page), same
 *   as in the parent.
 */

import { Component, ChangeDetectionStrategy, ChangeDetectorRef, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subject, takeUntil, finalize } from 'rxjs';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { SKIP_ADMIN_AUTH_CONTEXT } from '../../../../core/interceptors/skip-admin-auth';
import { ProjectPortalLocalizationService } from '../project-portal-localization.service';
import { PortalLanguageSwitcherComponent } from '../language-switcher/portal-language-switcher.component';
import { leaveOnMaintenance } from '../maintenance/portal-maintenance';
import type { PublicProject } from '../project-portal.component';

/** How the login screen signs in: password, or a code e-mailed to the account. */
export type PortalLoginMode = 'password' | 'code';

@Component({
  selector: 'app-portal-login',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalLanguageSwitcherComponent],
  templateUrl: './portal-login.component.html',
  styleUrls: ['../../../../admin/shared-styles/theme.css', './portal-login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortalLoginComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private publicDataService = inject(PublicDataService);
  private destroy$ = new Subject<void>();

  public readonly portalI18n = inject(ProjectPortalLocalizationService);

  /** Access token of the project (from the portal address). */
  @Input({ required: true }) token!: string;
  /** Mode the screen starts in (a spent e-mail link opens the code mode). */
  @Input() initialMode: PortalLoginMode = 'password';
  /** Error key shown when the screen opens (e.g. `error_link_invalid`). */
  @Input() initialError: string | null = null;
  /** The account signed in - the project of the API (with the account). */
  @Output() signedIn = new EventEmitter<PublicProject>();

  public t(key: string): string {
    return this.portalI18n.getValue(key);
  }

  loginUsername = '';
  loginPassword = '';
  /** Password, or a code e-mailed to the account. */
  loginMode: PortalLoginMode = 'password';
  /** Code mode: the code was requested (second step - enter it). */
  codeRequested = false;
  loginCode = '';
  /** Neutral confirmation after a code request (never says whether the account exists). */
  loginInfo: string | null = null;
  loginError: string | null = null;
  loginLoading = false;

  ngOnInit(): void {
    this.loginMode = this.initialMode;
    this.loginError = this.initialError;
    this.portalI18n.translations$.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** POST to a portal endpoint (the browser sends the session cookie). */
  private portalPost<T>(path: string, body: any): Observable<T> {
    return this.publicDataService.post<T>(path, body, undefined, SKIP_ADMIN_AUTH_CONTEXT).pipe(leaveOnMaintenance(this.router));
  }

  /**
   * @description Switches the login screen between password and e-mailed code.
   * @param mode Login mode.
   */
  setLoginMode(mode: PortalLoginMode): void {
    this.loginMode = mode;
    this.loginError = null;
    this.loginInfo = null;
    this.codeRequested = false;
    this.loginCode = '';
    this.cdr.markForCheck();
  }

  /**
   * @description Asks for a sign-in code to the e-mail of the login name / e-mail. The answer is
   *   the same whether the account exists or not.
   */
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

  /** @description Signs in with the code from the e-mail. */
  loginWithCode(): void {
    const code = this.loginCode.replace(/\s/g, '');
    if (!this.loginUsername.trim() || code.length < 6 || this.loginLoading) return;
    this.loginLoading = true;
    this.loginError = null;
    this.cdr.markForCheck();
    this.portalPost<{ project: PublicProject }>(`projects/public/${this.token}/login/code`, { identifier: this.loginUsername.trim(), code })
      .pipe(finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.loginInfo = null; this.signedIn.emit(res.project); },
        error: (err: any) => { this.loginError = err?.status === 429 ? 'error_too_many_attempts' : 'error_code_invalid'; },
      });
  }

  /** @description Signs in with the login name and password. */
  login(): void {
    if (!this.loginUsername.trim() || !this.loginPassword.trim() || this.loginLoading) return;

    this.loginLoading = true;
    this.loginError = null;
    this.cdr.markForCheck();

    this.portalPost<{ project: PublicProject }>(
      `projects/public/${this.token}/login`,
      { username: this.loginUsername.trim(), password: this.loginPassword }
    ).pipe(
      finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => this.signedIn.emit(res.project),
      error: (err: any) => {
        this.loginError = err?.status === 404
          ? 'error_project_not_found'
          : err?.status === 429 ? 'error_too_many_attempts' : 'error_invalid_login';
      }
    });
  }
}