/**
 * @file alert-dialog.component.ts
 * @path src/app/admin/components/alert-dialog/alert-dialog.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Presentational component providing a modal alert/notification interface for user feedback.
 * @dependencies
 * - CommonModule: Standard Angular directives.
 */

import { Component, EventEmitter, Output, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertType = 'info' | 'warning' | 'danger' | 'success';

/**
 * @description Displays a modal alert dialog with customizable types and automatic timeout behavior.
 * @usage Dynamically instantiated by AlertDialogService to show global system notifications.
 * @note Implements an automatic timeout for non-critical alerts (info/success) to streamline user experience.
 */
@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-dialog.component.html',
  styleUrls: ['./alert-dialog.component.css']
})
export class AlertDialogComponent implements OnDestroy {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() type: AlertType = 'info';

  @Output() onOk = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();

  isVisible: boolean = false;
  private autoHideTimeout: any;

  /**
   * @description Displays the dialog and starts the auto-hide timer if applicable.
   * @note Timers are set only for 'info' and 'success' types to ensure critical warnings remain visible until user interaction.
   */
  show(): void {
    this.isVisible = true;
    
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }

    if (this.type === 'success' || this.type === 'info') {
      this.autoHideTimeout = setTimeout(() => {
        this.hide();
      }, 5000); 
    }
  }

  /**
   * @description Hides the dialog and triggers the closure event.
   */
  public hide(): void {
    this.isVisible = false;
    this.onClose.emit();
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }
  }

  /**
   * @description Confirms the alert and closes the dialog.
   */
  ok(): void {
    this.onOk.emit();
    this.hide();
  }

  /**
   * @description Closes the dialog via UI interaction.
   */
  closeClick(): void {
    this.hide();
  }

  /**
   * @description Cleans up memory by clearing active timeouts during component destruction.
   */
  ngOnDestroy(): void {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }
  }

  /**
   * @description Maps the alert type to a corresponding CSS class for styling.
   * @returns {string} The CSS class name.
   * @note Fallback logic defaults to 'info-dialog' if an unknown type is provided.
   */
  getDialogClass(): string {
    switch (this.type) {
      case 'warning': return 'warning-dialog';
      case 'danger': return 'danger-dialog';
      case 'success': return 'success-dialog';
      default: return 'info-dialog';
    }
  }
}