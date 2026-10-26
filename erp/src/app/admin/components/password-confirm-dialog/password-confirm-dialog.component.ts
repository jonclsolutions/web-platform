/**
 * @file password-confirm-dialog.component.ts
 * @path src/app/admin/components/password-confirm-dialog/password-confirm-dialog.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-26
 * @description Modal asking for the own password before a sensitive operation (operations on
 *   sysadmin accounts, changes of the e-mail access policy). Rendered and driven by
 *   PasswordConfirmationService - the component only collects the password and shows the state
 *   (checking, wrong password, locked); it never stores or sends it itself.
 * @dependencies
 * - ScrollLockService: background scroll locked while open (same counter as other overlays).
 */

import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';

/** @description Texts of the dialog (translated by PasswordConfirmationService). */
export interface PasswordConfirmDialogTexts {
  title: string;
  message: string;
  label: string;
  confirm: string;
  cancel: string;
}

/**
 * @description Password prompt of the step-up confirmation.
 * @usage Created by PasswordConfirmationService.confirm(); not placed in templates.
 */
@Component({
  selector: 'app-password-confirm-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './password-confirm-dialog.component.html',
  styleUrls: ['./password-confirm-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordConfirmDialogComponent implements AfterViewInit, OnDestroy {
  /** Texts (neutral English defaults until the service sets the translation). */
  texts: PasswordConfirmDialogTexts = {
    title: 'Confirm with your password',
    message: 'This operation needs your password.',
    label: 'Password',
    confirm: 'Confirm',
    cancel: 'Cancel',
  };

  /** The typed password - cleared after every submit and on close. */
  password = '';
  /** A request with the password is running. */
  busy = false;
  /** Error shown under the field (wrong password, locked, …), null = none. */
  error: string | null = null;

  /** Emitted with the typed password when the user submits. */
  @Output() submitted = new EventEmitter<string>();
  /** Emitted when the user cancels (button, Escape, overlay). */
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('passwordInput') passwordInput?: ElementRef<HTMLInputElement>;

  private readonly scrollLock = inject(ScrollLockService);
  private readonly cd = inject(ChangeDetectorRef);
  private locked = false;

  constructor() {
    this.scrollLock.lock();
    this.locked = true;
  }

  /** @description Focuses the password field once it is rendered. */
  ngAfterViewInit(): void {
    this.passwordInput?.nativeElement.focus();
  }

  /** @description Submits a non-empty password (once at a time). */
  submit(): void {
    if (this.busy || !this.password) return;
    const value = this.password;
    this.password = '';
    this.busy = true;
    this.error = null;
    this.submitted.emit(value);
    this.cd.markForCheck();
  }

  /** @description Cancels the confirmation. */
  cancel(): void {
    if (this.busy) return;
    this.password = '';
    this.cancelled.emit();
  }

  /**
   * @description Shows why the confirmation failed and lets the user try again.
   * @param message Translated error.
   */
  showError(message: string): void {
    this.busy = false;
    this.error = message;
    this.cd.markForCheck();
    setTimeout(() => this.passwordInput?.nativeElement.focus());
  }

  /** @description Applies new texts (the service sets the translation). */
  setTexts(texts: PasswordConfirmDialogTexts): void {
    this.texts = texts;
    this.cd.markForCheck();
  }

  /** @description Releases the scroll lock (once). */
  ngOnDestroy(): void {
    this.password = '';
    if (this.locked) {
      this.locked = false;
      this.scrollLock.unlock();
    }
  }
}
