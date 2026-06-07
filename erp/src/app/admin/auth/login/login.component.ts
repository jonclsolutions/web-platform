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
  email = '';
  password = '';
  errorMessage = '';
  showPassword = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

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
}