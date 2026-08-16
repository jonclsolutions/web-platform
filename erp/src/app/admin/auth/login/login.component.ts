/**
 * @file login.component.ts
 * @path src/app/admin/auth/login/login.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Authentication component: přihlašovací formulář, captcha (od 3.
 * neúspěšného pokusu) a navazující 2FA OTP krok.
 * @refactor-note (2026-08-16) BACKLOG "captcha + 2FA na mail". Dvoukrokový flow:
 * (1) 'credentials' - email/heslo, captcha widget se vyrenderuje AŽ po chybě s
 * captchaRequired=true; (2) 'otp' - zadání 6místného kódu. `loginToken` (pending-2FA
 * secret) se drží VÝHRADNĚ v paměti komponenty, nikdy v sessionStorage/localStorage.
 * @bugfix-note (2026-08-16) BUG: pokud captcha widget už existoval (byl vyžádán při
 * dřívějším pokusu) a přišel DALŠÍ neúspěšný pokus (opět s captcha_required=true),
 * `activateCaptcha()` se kvůli guard podmínce `if (... || this.captchaWidgetId) return`
 * vůbec nespustila - starý, už jednou spotřebovaný Turnstile token zůstal v
 * `captchaToken` a poslal se znovu, což Turnstile vždy odmítne (token je jednorázový).
 * Uživatel se tak zacyklil bez šance to opravit jinak než refreshem stránky. Oprava:
 * error handler teď explicitně rozlišuje "widget už existuje -> jen reset()" vs.
 * "widget ještě neexistuje -> poprvé render()".
 */

import { Component, ChangeDetectorRef, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, LoginError, TwoFactorError } from '../../../core/auth/auth.service';
import { TurnstileService } from '../../../core/services/turnstile.service';

type LoginStep = 'credentials' | 'otp';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnDestroy {
  @ViewChild('captchaContainer') captchaContainer?: ElementRef<HTMLDivElement>;

  step: LoginStep = 'credentials';

  email = '';
  password = '';
  errorMessage = '';
  showPassword = false;
  isSubmitting = false;

  // ── Captcha stav ────────────────────────────────────────────────────────
  captchaRequired = false;
  private captchaToken: string | null = null;
  private captchaWidgetId: string | null = null;

  // ── 2FA (OTP) stav ─────────────────────────────────────────────────────
  /** Pending-login secret z kroku 1 - drží se JEN v paměti, nikdy v sessionStorage. */
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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.clearCountdown();
    if (this.captchaWidgetId) {
      this.turnstile.remove(this.captchaWidgetId);
    }
    // Bezpečnostní úklid - citlivé hodnoty nesmí přežít v paměti komponenty déle, než je nutné.
    this.password = '';
    this.otpCode = '';
    this.loginToken = null;
  }

  /**
   * @description Krok 1: odešle přihlašovací údaje. Pokud backend vyžaduje captcha
   * (captchaRequired=true) a widget ještě nebyl vyplněn, request se ani neodešle.
   */
  onLogin(): void {
    if (this.isSubmitting) return;

    this.errorMessage = '';

    if (this.captchaRequired && !this.captchaToken) {
      this.errorMessage = 'Potvrďte prosím, že nejste robot.';
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
        this.errorMessage = error.message || 'Neplatné přihlašovací údaje.';
        this.password = ''; // heslo se po neúspěchu nemá držet v paměti/inputu

        if (error.captchaRequired) {
          // Token (pokud nějaký byl) je po odeslaném requestu považován za spotřebovaný -
          // Turnstile token je jednorázový bez ohledu na to, zda login uspěl nebo ne.
          this.captchaToken = null;

          if (this.captchaWidgetId) {
            // Widget už existuje z dřívějšího pokusu - jen vynutit vygenerování nového tokenu.
            this.turnstile.reset(this.captchaWidgetId);
            this.captchaRequired = true;
          } else {
            // První výskyt v této relaci - widget ještě neexistuje, vykreslit ho.
            this.activateCaptcha();
          }
        }
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * @description Vyrenderuje Turnstile widget POPRVÉ. Volá se jen když
   * `captchaWidgetId` ještě neexistuje - opakované vynucení nového tokenu u JIŽ
   * vykresleného widgetu řeší `turnstile.reset()` přímo v onLogin() error handleru
   * (viz @bugfix-note v hlavičce souboru).
   */
  private activateCaptcha(): void {
    this.captchaRequired = true;
    // Kontejner existuje v DOM až po @if(captchaRequired) - počkat na change detection.
    setTimeout(async () => {
      if (!this.captchaContainer) return;
      try {
        this.captchaWidgetId = await this.turnstile.render(
          this.captchaContainer.nativeElement,
          (token) => { this.captchaToken = token; },
          () => { this.captchaToken = null; } // token vypršel - musí se ověřit znovu
        );
      } catch {
        this.errorMessage = 'Nepodařilo se načíst ověření zabezpečení. Zkuste stránku obnovit.';
        this.cdr.detectChanges();
      }
    }, 0);
  }

  /**
   * @description Přepne UI do kroku zadání OTP kódu a spustí countdown platnosti
   * kódu i cooldown pro resend tlačítko.
   */
  private enterOtpStep(loginToken: string, expiresInSeconds: number): void {
    this.step = 'otp';
    this.loginToken = loginToken;
    this.otpCode = '';
    this.otpExpiresAt = Date.now() + expiresInSeconds * 1000;
    this.resendAvailableAt = Date.now() + 60_000; // sedí s backend RESEND_COOLDOWN_SECONDS
    this.startCountdown();
  }

  /**
   * @description Krok 2: ověří zadaný OTP kód a dokončí login. Při neshodě kódu
   * backend vrátí 422 s message "Neplatný ověřovací kód." - zobrazí se přímo v
   * errorMessage (viz šablona), uživatel je tedy o neshodě VŽDY informován.
   */
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
        this.errorMessage = error.message || 'Neplatný ověřovací kód.';
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * @description Vyžádá nový OTP kód. Respektuje frontend cooldown UI (tlačítko je
   * disabled, dokud neuplyne resendAvailableAt) - i tak backend cooldown/limit vynucuje
   * nezávisle, tohle je jen UX prevence zbytečných requestů.
   */
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
        this.errorMessage = error.message || 'Nový kód se nepodařilo odeslat.';
        if (error.retryAfter) {
          this.resendAvailableAt = Date.now() + error.retryAfter * 1000;
        }
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * @description Návrat na krok zadání hesla - zahodí pending-2FA session i captcha
   * stav (nová relace = nový login od začátku).
   */
  backToCredentials(): void {
    this.step = 'credentials';
    this.loginToken = null;
    this.otpCode = '';
    this.password = '';
    this.clearCountdown();
  }

  /** @description Povolí v OTP inputu jen číslice, max 6 znaků (žádné vkládání jiných znaků). */
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
        this.resetErrorMessage = error?.message || 'Požadavek se nepodařilo odeslat. Zkuste to prosím znovu.';
        this.cdr.detectChanges();
      }
    });
  }
}