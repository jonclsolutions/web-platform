/**
 * @file login.component.ts
 * @path src/app/admin/auth/login/login.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Authentication component: přihlašovací formulář, captcha a 2FA OTP krok.
 * @refactor-note (2026-09) Lokalizace přes BasePublicComponent — stejný pattern jako
 *     contact.component, services.component. translationKey = 'login', přístup přes
 *     this.t?.key v šabloně i v .ts.
 */

import { Component, ChangeDetectorRef, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, LoginError, TwoFactorError } from '../../../core/auth/auth.service';
import { TurnstileService } from '../../../core/services/turnstile.service';
import { BasePublicComponent } from '../../../public/base-public.component';
import { CommonModule } from '@angular/common';
type LoginStep = 'credentials' | 'otp';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent extends BasePublicComponent implements OnDestroy {

  protected readonly translationKey = 'login';

  @ViewChild('captchaContainer') captchaContainer?: ElementRef<HTMLDivElement>;

  step: LoginStep = 'credentials';

  email = '';
  password = '';
  errorMessage = '';
  showPassword = false;
  isSubmitting = false;

  captchaRequired = false;
  private captchaToken: string | null = null;
  private captchaWidgetId: string | null = null;

  private loginToken: string | null = null;
  otpCode = '';
  otpExpiresAt: number | null = null;
  resendAvailableAt = 0;
  private countdownIntervalId: any = null;
  countdownDisplay = '';
  resendCountdownDisplay = '';

  showForgotModal = false;
  resetEmail = '';
  resetSent = false;
  resetSubmitting = false;
  resetErrorMessage = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private turnstile: TurnstileService,
  ) {
    super();
  }

  override ngOnDestroy(): void {
    this.clearCountdown();
    if (this.captchaWidgetId) {
      this.turnstile.remove(this.captchaWidgetId);
    }
    this.password = '';
    this.otpCode = '';
    this.loginToken = null;
    super.ngOnDestroy();
  }

  onLogin(): void {
    if (this.isSubmitting) return;
    this.errorMessage = '';

    if (this.captchaRequired && !this.captchaToken) {
      this.errorMessage = this.t?.errors?.captcha_required;
      return;
    }

    this.isSubmitting = true;

    this.authService.login({
      email: this.email,
      password: this.password,
      captcha_token: this.captchaToken ?? undefined,
    }).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        if (response?.requires_2fa) {
          this.enterOtpStep(response.login_token, response.expires_in);
          this.cdr.detectChanges();
          return;
        }
        this.setInitialAdminModule();
        this.router.navigate(['/admin/core/welcome-page']);
      },
      error: (error: LoginError) => {
        this.isSubmitting = false;
        this.errorMessage = error.message;
        this.password = '';

        if (error.captchaRequired) {
          this.captchaToken = null;
          if (this.captchaWidgetId) {
            this.turnstile.reset(this.captchaWidgetId);
            this.captchaRequired = true;
          } else {
            this.activateCaptcha();
          }
        }
        this.cdr.detectChanges();
      }
    });
  }

  private activateCaptcha(): void {
    this.captchaRequired = true;
    setTimeout(async () => {
      if (!this.captchaContainer) return;
      try {
        this.captchaWidgetId = await this.turnstile.render(
          this.captchaContainer.nativeElement,
          (token) => { this.captchaToken = token; },
          () => { this.captchaToken = null; }
        );
      } catch {
        this.errorMessage = this.t?.errors?.captcha_load;
        this.cdr.detectChanges();
      }
    }, 0);
  }

  private enterOtpStep(loginToken: string, expiresInSeconds: number): void {
    this.step = 'otp';
    this.loginToken = loginToken;
    this.otpCode = '';
    this.otpExpiresAt = Date.now() + expiresInSeconds * 1000;
    this.resendAvailableAt = Date.now() + 60_000;
    this.startCountdown();
  }

  onVerifyOtp(): void {
    if (this.isSubmitting || !this.loginToken || this.otpCode.length !== 6) return;
    this.isSubmitting = true;
    this.errorMessage = '';

    this.authService.verifyTwoFactor(this.loginToken, this.otpCode).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.loginToken = null;
        this.otpCode = '';
        this.setInitialAdminModule();
        this.router.navigate(['/admin/core/welcome-page']);
      },
      error: (error: TwoFactorError) => {
        this.isSubmitting = false;
        this.otpCode = '';
        this.errorMessage = error.message;
        this.cdr.detectChanges();
      }
    });
  }

  onResendOtp(): void {
    if (!this.loginToken || Date.now() < this.resendAvailableAt) return;
    this.errorMessage = '';

    this.authService.resendTwoFactor(this.loginToken).subscribe({
      next: (response) => {
        this.otpExpiresAt = Date.now() + response.expires_in * 1000;
        this.resendAvailableAt = Date.now() + 60_000;
        this.cdr.detectChanges();
      },
      error: (error: TwoFactorError) => {
        this.errorMessage = error.message;
        if (error.retryAfter) {
          this.resendAvailableAt = Date.now() + error.retryAfter * 1000;
        }
        this.cdr.detectChanges();
      }
    });
  }

  backToCredentials(): void {
    this.step = 'credentials';
    this.loginToken = null;
    this.otpCode = '';
    this.password = '';
    this.clearCountdown();
  }

  onOtpInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.otpCode = input.value.replace(/[^0-9]/g, '').slice(0, 6);
  }

  get isOtpExpired(): boolean {
    return !!this.otpExpiresAt && Date.now() >= this.otpExpiresAt;
  }

  get canResend(): boolean {
    return Date.now() >= this.resendAvailableAt;
  }

  private startCountdown(): void {
    this.clearCountdown();
    this.countdownIntervalId = setInterval(() => {
      this.updateCountdownDisplay();
      this.cdr.detectChanges();
    }, 1000);
    this.updateCountdownDisplay();
  }

  private clearCountdown(): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  }

  private updateCountdownDisplay(): void {
    if (this.otpExpiresAt) {
      const remaining = Math.max(0, Math.floor((this.otpExpiresAt - Date.now()) / 1000));
      this.countdownDisplay = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
    }
    const resendRemaining = Math.max(0, Math.ceil((this.resendAvailableAt - Date.now()) / 1000));
    this.resendCountdownDisplay = resendRemaining > 0 ? `(${resendRemaining}s)` : '';
  }

  private setInitialAdminModule(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_current_module', 'core');
    }
  }

  openForgotModal(): void {
    this.resetEmail = '';
    this.resetSent = false;
    this.resetErrorMessage = '';
    this.showForgotModal = true;
    this.cdr.detectChanges();
  }

  closeForgotModal(): void {
    this.showForgotModal = false;
    this.cdr.detectChanges();
  }

  onResetPassword(): void {
    if (!this.resetEmail.trim() || this.resetSubmitting) return;
    this.resetSubmitting = true;
    this.resetErrorMessage = '';

    this.authService.requestPasswordReset(this.resetEmail.trim()).subscribe({
      next: () => {
        this.resetSubmitting = false;
        this.resetSent = true;
        this.cdr.detectChanges();
        setTimeout(() => this.closeForgotModal(), 3000);
      },
      error: (error) => {
        this.resetSubmitting = false;
        this.resetErrorMessage = error?.message;
        this.cdr.detectChanges();
      }
    });
  }
}