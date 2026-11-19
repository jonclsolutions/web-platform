/**
 * @file password-dialog.component.ts
 * @path src/app/admin/components/password-dialog/password-dialog.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared modal asking for the password of the signed-in user before a sensitive
 *   operation (maintenance switch of an application, operations on sysadmin accounts, e-mail
 *   access policy …): title with a close button, optional description with a highlighted value,
 *   optional amber warning, the password field, cancel / confirm. Rendered and driven by
 *   PasswordDialogService - the component only collects the password and shows the state
 *   (checking, error); it never stores or sends it itself.
 * @dependencies
 * - ScrollLockService: background scroll locked while open (same counter as other overlays).
 */

import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';

/** @description Texts of the dialog with every optional part resolved (set by PasswordDialogService). */
export interface PasswordDialogTexts {
  title: string;
  /** Description above the field ('' = none). */
  message: string;
  /** Highlighted value after the description, e.g. the target state ('' = none). */
  highlight: string;
  /** Colour of the highlighted value. */
  highlightTone: 'success' | 'warning' | 'danger';
  /** Amber warning box ('' = none). */
  warning: string;
  label: string;
  confirm: string;
  cancel: string;
  close: string;
}

/**
 * @description Password prompt of the administration.
 * @usage Created by PasswordDialogService.open(); not placed in templates.
 */
@Component({
  selector: 'app-password-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './password-dialog.component.html',
  styleUrls: ['./password-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordDialogComponent implements AfterViewInit, OnDestroy {
  /** Texts (neutral English defaults until the service sets the translation). */
  texts: PasswordDialogTexts = {
    title: 'Confirm with your password',
    message: '',
    highlight: '',
    highlightTone: 'success',
    warning: '',
    label: 'Current password',
    confirm: 'Confirm',
    cancel: 'Cancel',
    close: 'Close',
  };

  /** The typed password - cleared after every submit and on close. */
  password = '';
  /** The operation with the password is running. */
  busy = false;
  /** Error shown under the field (wrong password, locked, …), null = none. */
  error: string | null = null;

  /** Emitted with the typed password when the user submits. */
  @Output() submitted = new EventEmitter<string>();
  /** Emitted when the user cancels (button, close, Escape, overlay). */
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

  /** @description Cancels the dialog (not while the operation runs). */
  cancel(): void {
    if (this.busy) return;
    this.password = '';
    this.cancelled.emit();
  }

  /**
   * @description The operation failed - the dialog stays open for another try.
   * @param message Translated error under the field ('' = none, e.g. already announced elsewhere).
   */
  showError(message: string): void {
    this.busy = false;
    this.error = message || null;
    this.cd.markForCheck();
    setTimeout(() => this.passwordInput?.nativeElement.focus());
  }

  /**
   * @description Applies the texts (the service sets the translation and the options).
   * @param texts Resolved texts.
   */
  setTexts(texts: PasswordDialogTexts): void {
    this.texts = texts;
    this.cd.markForCheck();
  }

  /** @description Releases the scroll lock (once) and forgets the password. */
  ngOnDestroy(): void {
    this.password = '';
    if (this.locked) {
      this.locked = false;
      this.scrollLock.unlock();
    }
  }
}
