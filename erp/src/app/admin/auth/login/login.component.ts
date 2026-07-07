/**
 * @file login.component.ts
 * @path src/app/admin/auth/login/login.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Authentication component providing a user login interface and password recovery workflow.
 * @dependencies
 * - AuthService: Handles the secure authentication request.
 * - Router: Manages navigation upon successful authentication.
 * - ChangeDetectorRef: Manual change detection for UI updates during asynchronous operations.
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

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * @description Processes user credentials and navigates to the dashboard upon success.
   * @note Updates the errorMessage state if authentication fails.
   */
  onLogin(): void {
    this.errorMessage = '';
    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.router.navigate(['/admin/dashboard']);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Incorrect credentials.';
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * @description Resets the recovery form state and displays the password reset modal.
   */
  openForgotModal(): void {
    this.resetEmail = '';
    this.resetSent = false;
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
   * @description Triggers the password reset process via the backend.
   * @note Displays a success confirmation message before closing the modal automatically after 3 seconds.
   */
  onResetPassword(): void {
    if (!this.resetEmail.trim()) return;

    // TODO: Integrate with backend API reset endpoint (implement by email link)
    console.log(`Password reset requested for: ${this.resetEmail}`);

    this.resetSent = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.closeForgotModal();
    }, 3000);
  }
}