/**
 * @file confirm-dialog.service.ts
 * @path src/app/core/services/confirm-dialog.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Service for programmatically creating and managing dynamic ConfirmDialogComponent instances globally.
 * @dependencies
 * - ConfirmDialogComponent: The UI component to be dynamically rendered.
 * - ApplicationRef: Required to manually attach/detach component views to the application tree.
 * - EnvironmentInjector: Required for dependency injection within dynamically created components.
 */

import { Injectable, ComponentRef, ApplicationRef, createComponent, EnvironmentInjector, EmbeddedViewRef } from '@angular/core';
import { ConfirmDialogComponent } from '../../admin/components/confirm-dialog/confirm-dialog.component';
import { first } from 'rxjs';

/**
 * @description Provides functionality to display global confirmation dialogs (Yes/No) without component template declaration.
 * @usage Used across the application to trigger user actions requiring confirmation.
 * @note The service manages the full lifecycle of the dynamic component, ensuring proper DOM attachment and cleanup.
 */
@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  private componentRef?: ComponentRef<ConfirmDialogComponent>;

  constructor(
    private environmentInjector: EnvironmentInjector,
    private appRef: ApplicationRef
  ) { }

  /**
   * @description Opens a confirmation dialog and returns a Promise resolving to a boolean.
   * @param title The dialog header text.
   * @param message The confirmation question/body text.
   * @returns {Promise<boolean>} Resolves to 'true' on confirm, 'false' on cancel.
   * @note If a dialog is already active, it is destroyed before the new one is initialized.
   */
  open(title: string, message: string): Promise<boolean> {
    this.closeDialog();

    this.componentRef = createComponent(ConfirmDialogComponent, {
      environmentInjector: this.environmentInjector
    });

    const domElem = (this.componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    this.appRef.attachView(this.componentRef.hostView);
    document.body.appendChild(domElem);

    this.componentRef.instance.title = title;
    this.componentRef.instance.message = message;
    this.componentRef.instance.show();

    return new Promise<boolean>((resolve) => {
      this.componentRef?.instance.onConfirm.pipe(first()).subscribe(() => {
        this.closeDialog();
        resolve(true);
      });

      this.componentRef?.instance.onCancel.pipe(first()).subscribe(() => {
        this.closeDialog();
        resolve(false);
      });
    });
  }

  /**
   * @description Handles the safe destruction of the active confirmation dialog.
   * @note Detaches the view from ApplicationRef and destroys the ComponentRef instance to prevent memory leaks.
   */
  private closeDialog(): void {
    if (this.componentRef) {
      this.componentRef.instance.hide();
      this.appRef.detachView(this.componentRef.hostView);
      this.componentRef.destroy();
      this.componentRef = undefined;
    }
  }
}