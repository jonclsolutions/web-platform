/**
 * @file activate-account.component.ts
 * @path src/app/admin/auth/activate-account/activate-account.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public page for setting the password and activating an account created by an
 * admin. Opened from the link in the e-mail (AccountActivationMail). Same pattern as
 * ResetPasswordComponent - a public route outside AdminLayoutComponent and AuthGuard.
 * @note After a successful activation the user is NOT logged in automatically - redirected to
 * `/auth/login`.
 * @dependencies
 * - HttpClient: HTTP calls to the public `account-activation/{token}` endpoints.
 * - environment: Base URL of the API.
 * - SetPasswordFormComponent: the password form shared with ResetPasswordComponent.
 */

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { map } from 'rxjs';
import { ApiEnvelope } from '../../../shared/interfaces/api-envelope';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { SetPasswordFormComponent, SetPasswordValue } from '../set-password-form/set-password-form.component';

/** Controls which block of the template is rendered - link check, form, error, done. */
type ViewState = 'loading' | 'form' | 'invalid' | 'success';

/** Response of GET account-activation/{token} (AccountActivationController::show()). */
interface ActivationCheckResponse {
  email: string;
  full_name: string;
}

@Component({
  selector: 'app-activate-account',
  standalone: true,
  imports: [CommonModule, RouterLink, SetPasswordFormComponent],
  templateUrl: './activate-account.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../shared-styles/auth.css', '../shared-styles/auth-card.css', './activate-account.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivateAccountComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private i18n = inject(AdminLocalizationService);

  /** JSON-only headers; the endpoints are public, so no Authorization header is needed. */
  private readonly headers = new HttpHeaders({ 'Accept': 'application/json' });

  state: ViewState = 'loading';
  /** Translation key (section `activate-account`) of the invalid-link reason. */
  errorKey = '';
  email = '';
  submitting = false;
  /** Translation key of the error under the form, '' = none. */
  fieldErrorKey = '';

  /** Seconds until the automatic redirect after success - shown in the UI. */
  redirectCountdown = 4;

  private token = '';
  /** Countdown of the automatic redirect - stopped when the page is left earlier (the "go to
   * login" link), otherwise it would later pull the user out of wherever they went. */
  private redirectInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // OnPush: re-render once the admin translations are (re)loaded.
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => this.cd.markForCheck());
  }

  /**
   * @description Text of the page in the admin language (finding #39 - was English-only).
   * @param key Key inside the `activate-account` section.
   * @returns Translated text.
   */
  t(key: string): string {
    return this.i18n.getValue(`activate-account.${key}`);
  }

  ngOnDestroy(): void {
    if (this.redirectInterval) clearInterval(this.redirectInterval);
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';

    if (!this.token) {
      this.state = 'invalid';
      this.errorKey = 'error_token_missing';
      return;
    }

    this.http.get<ApiEnvelope<ActivationCheckResponse>>(this.activationUrl(), { headers: this.headers }).pipe(map(r => r.data)).subscribe({
      next: (res) => {
        this.email = res.email;
        this.state = 'form';
        this.cd.markForCheck();
      },
      error: (err) => {
        this.state = 'invalid';
        this.errorKey = 'error_invalid_link';
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Sets the password of the account (the form checked the policy already).
   * @param value Password and its confirmation from SetPasswordFormComponent.
   */
  onSubmit(value: SetPasswordValue): void {
    this.fieldErrorKey = '';
    if (this.submitting) {
      return;
    }

    this.submitting = true;

    this.http.post(this.activationUrl(), value, { headers: this.headers }).subscribe({
      next: () => {
        this.submitting = false;
        this.state = 'success';
        this.cd.markForCheck();
        this.startRedirectCountdown();
      },
      error: (err) => {
        this.submitting = false;
        // The link expired or was used while the form was open: same view as on entry.
        if ([403, 404, 410].includes(err?.status)) {
          this.state = 'invalid';
          this.errorKey = 'error_invalid_link';
        } else {
          this.fieldErrorKey = this.submitErrorKey(err);
        }
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Absolute URL of the public activation endpoint for the current token.
   * @returns `{api}/account-activation/{token}`; the token is URL-encoded.
   */
  private activationUrl(): string {
    return `${environment.base_api_url}/account-activation/${encodeURIComponent(this.token)}`;
  }

  /**
   * @description Message shown under the form when setting the password fails for a reason
   * other than an invalid link. Never lists the password rules - the checklist above already
   * shows them, and the button is disabled until they are met.
   * @param err The HttpErrorResponse of the failed request.
   * @returns Translation key of the message.
   */
  private submitErrorKey(err: any): string {
    if (err?.status === 0) {
      return 'error_network';
    }
    if (err?.status === 422) {
      // Only reachable if the server's rules differ from the checklist (e.g. a stale app version).
      return 'error_password_rejected';
    }
    return 'error_generic';
  }

  /**
   * @description UI countdown ("Redirecting in N s…") before the automatic redirect to the
   * login - purely cosmetic, the redirect works without it, but the user sees that something
   * is happening.
   */
  private startRedirectCountdown(): void {
    this.redirectInterval = setInterval(() => {
      this.redirectCountdown -= 1;
      this.cd.markForCheck();
      if (this.redirectCountdown <= 0) {
        clearInterval(this.redirectInterval!);
        this.redirectInterval = null;
        this.router.navigate(['/auth/login']);
      }
    }, 1000);
  }
}