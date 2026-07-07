/**
 * @file confirm-dialog.component.ts
 * @path src/app/admin/components/confirm-dialog/confirm-dialog.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A reusable modal dialog component for capturing user confirmation before executing critical or destructive actions.
 * @dependencies
 * - Angular core: Component, EventEmitter, Input, Output decorators.
 */

import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * @description Renders a modal confirmation dialog to prevent accidental user actions.
 * @usage Used by ConfirmDialogService to prompt users globally across the application.
 * @note Implements body scroll blocking to maintain focus on the modal while active.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent {
  /** * @description Header text displayed in the dialog. */
  @Input() title: string = 'Confirmation';
  /** * @description The descriptive message explaining the action to be confirmed. */
  @Input() message: string = 'Are you sure you want to perform this action?';

  /** * @description Event emitted when the user confirms the action. */
  @Output() onConfirm = new EventEmitter<void>();
  /** * @description Event emitted when the user cancels the dialog. */
  @Output() onCancel = new EventEmitter<void>();

  isVisible: boolean = false;

  /**
   * @description Displays the dialog and locks the background scroll.
   */
  show(): void {
    this.isVisible = true;
    this.blockBackgroundScroll();
  }

  /**
   * @description Hides the dialog and restores background scroll.
   */
  public hide(): void {
    this.isVisible = false;
    this.unblockBackgroundScroll();
  }

  /**
   * @description Emits confirmation event and closes the dialog.
   */
  confirm(): void {
    this.onConfirm.emit();
    this.hide(); 
  }

  /**
   * @description Emits cancellation event and closes the dialog.
   */
  cancel(): void {
    this.onCancel.emit();
    this.hide(); 
  }

  /**
   * @description Adds a class to the body element to disable scrolling.
   */
  private blockBackgroundScroll(): void {
    document.body.classList.add('no-scroll');
  }

  /**
   * @description Removes the scroll-blocking class from the body.
   */
  private unblockBackgroundScroll(): void {
    document.body.classList.remove('no-scroll');
  }
}