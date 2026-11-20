/**
 * @file confirm-dialog.component.ts
 * @path src/app/admin/components/confirm-dialog/confirm-dialog.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description A reusable modal dialog component for capturing user confirmation before executing critical or destructive actions.
 * @dependencies
 * - Angular core: Component, EventEmitter, Input, Output decorators.
 * - AdminModalComponent: the shared popup frame (prompt layer) - it also locks the page scroll,
 *   closes on Escape / the backdrop (= cancel) and handles the focus.
 */

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AdminModalComponent } from '../admin-modal/admin-modal.component';

/**
 * @description Renders a modal confirmation dialog to prevent accidental user actions.
 * @usage Used by ConfirmDialogService to prompt users globally across the application.
 * @note The frame is rendered only while visible, so the page scroll is locked exactly then.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [AdminModalComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['../../shared-styles/modal.css', './confirm-dialog.component.css']
})
export class ConfirmDialogComponent {
  /** * @description Header text displayed in the dialog. */
  @Input() title: string = 'Confirmation';
  /** * @description The descriptive message explaining the action to be confirmed. */
  @Input() message: string = 'Are you sure you want to perform this action?';
  /** * @description Text of the confirm button (translated by the caller / ConfirmDialogService). */
  @Input() confirmLabel: string = 'Confirm';
  /** * @description Text of the cancel button (translated by the caller / ConfirmDialogService). */
  @Input() cancelLabel: string = 'Cancel';

  /** * @description Event emitted when the user confirms the action. */
  @Output() onConfirm = new EventEmitter<void>();
  /** * @description Event emitted when the user cancels the dialog. */
  @Output() onCancel = new EventEmitter<void>();

  isVisible: boolean = false;

  /**
   * @description Displays the dialog.
   */
  show(): void {
    this.isVisible = true;
  }

  /**
   * @description Hides the dialog.
   */
  public hide(): void {
    this.isVisible = false;
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
}