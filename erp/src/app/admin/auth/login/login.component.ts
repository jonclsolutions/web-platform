import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  // ── Přihlašovací formulář ───────────────────────────────────
  email        = '';
  password     = '';
  errorMessage = '';
  showPassword = false;

  // ── Modal zapomenutého hesla ────────────────────────────────
  showForgotModal = false;
  resetEmail      = '';
  resetSent       = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  // ── Přihlášení — původní logika beze změny ──────────────────
  onLogin(): void {
    this.errorMessage = '';
    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.router.navigate(['/admin/dashboard']);
      },
      error: (error) => {
        this.errorMessage = error.message || 'Nesprávné přihlašovací údaje.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Modal — otevření ─────────────────────────────────────────
  openForgotModal(): void {
    this.resetEmail = '';
    this.resetSent  = false;
    this.showForgotModal = true;
    this.cdr.detectChanges();
  }

  // ── Modal — zavření ──────────────────────────────────────────
  closeForgotModal(): void {
    this.showForgotModal = false;
    this.cdr.detectChanges();
  }

  // ── Reset hesla — placeholder ────────────────────────────────
  onResetPassword(): void {
    if (!this.resetEmail.trim()) return;

    // TODO: nahradit skutečným HTTP voláním na reset endpoint
    console.log(`Reset email byl odeslan na: ${this.resetEmail}`);

    this.resetSent = true;
    this.cdr.detectChanges();

    // Automatické zavření po 3 s
    setTimeout(() => {
      this.closeForgotModal();
    }, 3000);
  }
}