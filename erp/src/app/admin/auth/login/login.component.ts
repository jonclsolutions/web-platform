/**
 * @file login.component.ts
 * @path src/app/admin/auth/login/login.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Authentication component providing a user login interface and password recovery workflow.
 * @dependencies
 * - AuthService: Handles the secure authentication request and password reset requests.
 * - Router: Manages navigation upon successful authentication.
 * - ChangeDetectorRef: Manual change detection for UI updates during asynchronous operations.
 * @refactor-note (2026) Post-login navigace přesměrována z '/admin/welcome-page' na
 *      '/admin/core/dashboard' - nová výchozí přistávací stránka po přihlášení odpovídá
 *      novému Core modulu (viz admin-routing.module.ts).
 */

import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * @description Represents the login view of the administrative application.
 * @usage Used as the entry point for protected admin pages.
 * @note Manages local form state and a dynamic modal for password recovery.
 */
@Component({
selector: 'app-login',
standalone: true,
imports: [FormsModule, RouterModule],
templateUrl: './login.component.html',
styleUrls: ['./login.component.css']
})
export class LoginComponent {
email = '';
password = '';
errorMessage = '';
showPassword = false;

showForgotModal = false;
resetEmail = '';
resetSent = false;
resetSubmitting = false;
resetErrorMessage = '';

constructor(
private router: Router,
private authService: AuthService,
private cdr: ChangeDetectorRef
  ) {}

/**
   * @description Processes user credentials and navigates to the core dashboard upon success.
   * @note Updates the errorMessage state if authentication fails.
   */
onLogin(): void {
this.errorMessage = '';
this.authService.login({ email: this.email, password: this.password }).subscribe({
next: () => {
this.setInitialAdminModule();
this.router.navigate(['/admin/core/dashboard']);
      },
error: (error) => {
this.errorMessage = error.message || 'Incorrect credentials.';
this.cdr.detectChanges();
      }
    });
  }

/**
   * @description Zapíše do localStorage 'core' jako aktuální admin modul, ať AdminLayoutComponent
   *              po přihlášení nezobrazí zbytek UI (přepínač, sidebar) podle modulu zvoleného
   *              v předchozí relaci, ale podle skutečné cílové URL '/admin/core/dashboard'.
   */
private setInitialAdminModule(): void {
if (typeof window !== 'undefined') {
localStorage.setItem('admin_current_module', 'core');
    }
  }

/**
   * @description Resets the recovery form state and displays the password reset modal.
   */
openForgotModal(): void {
this.resetEmail = '';
this.resetSent = false;
this.resetErrorMessage = '';
this.showForgotModal = true;
this.cdr.detectChanges();
  }

/**
   * @description Closes the password recovery modal.
   */
closeForgotModal(): void {
this.showForgotModal = false;
this.cdr.detectChanges();
  }

/**
   * @description Triggers the password reset request via the backend (POST /forgot-password).
   * @note Backend always returns a generic success message regardless of whether the account
   *       exists (user enumeration protection), so the UI shows the same confirmation either way.
   *       The modal auto-closes 3 seconds after a successful request.
   */
onResetPassword(): void {
if (!this.resetEmail.trim() || this.resetSubmitting) return;

this.resetSubmitting = true;
this.resetErrorMessage = '';

this.authService.requestPasswordReset(this.resetEmail.trim()).subscribe({
next: () => {
this.resetSubmitting = false;
this.resetSent = true;
this.cdr.detectChanges();

setTimeout(() => {
this.closeForgotModal();
        }, 3000);
      },
error: (error) => {
this.resetSubmitting = false;
// auth.service.ts už mapuje HTTP chyby (429 apod.) na hotovou zprávu v error.message,
// takže zde žádné další rozlišování podle status kódu neděláme.
this.resetErrorMessage = error?.message || 'Požadavek se nepodařilo odeslat. Zkuste to prosím znovu.';
this.cdr.detectChanges();
      }
    });
  }
}