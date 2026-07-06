/**
 * @file alert-dialog.service.ts
 * @path src/app/shared/services/alert-dialog.service.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2025
 * @description Service for programmatically creating and managing dynamic AlertDialogComponent instances globally.
 * @dependencies
 * - AlertDialogComponent: The UI component to be dynamically rendered.
 * - ApplicationRef: Required to manually attach/detach component views to the application tree.
 * - EnvironmentInjector: Required for dependency injection within dynamically created components.
 */

import { Injectable, ComponentRef, ApplicationRef, EnvironmentInjector, createComponent, EmbeddedViewRef } from '@angular/core';
import { AlertDialogComponent, AlertType } from '../../admin/components/alert-dialog/alert-dialog.component';
import { first } from 'rxjs/operators';

/**
 * @description Provides functionality to display global alert dialogs without needing to declare them in every template.
 * @usage Used across the application to trigger user alerts, confirmations, or notifications.
 * @note The service manages the entire lifecycle of the dynamic component, including manual DOM attachment and cleanup.
 */
@Injectable({
  providedIn: 'root'
})
export class AlertDialogService {
  private componentRef?: ComponentRef<AlertDialogComponent>;

  constructor(
    private environmentInjector: EnvironmentInjector,
    private appRef: ApplicationRef
  ) {}

  /**
   * @description Opens a dynamic alert dialog and returns a Promise that resolves when the user closes it.
   * @param title The dialog header text.
   * @param message The content body text.
   * @param type The alert classification (e.g., 'info', 'error').
   * @returns {Promise<void>} Resolves when the dialog is closed.
   * @note If another dialog is currently open, it is closed before the new one is initialized.
   */
  open(title: string, message: string, type: AlertType = 'info'): Promise<void> {
    this.closeDialog();

    const ref = createComponent(AlertDialogComponent, {
      environmentInjector: this.environmentInjector
    });

    this.componentRef = ref;

    if (!ref) {
      return Promise.resolve();
    }

    const domElem = (ref.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    this.appRef.attachView(ref.hostView);
    document.body.appendChild(domElem);

    ref.instance.title = title;
    ref.instance.message = message;
    ref.instance.type = type;
    ref.instance.show();

    return new Promise<void>((resolve) => {
      let isResolved = false;

      /**
       * @description Ensures the cleanup logic and promise resolution occur exactly once.
       */
      const handleClose = () => {
        if (isResolved) return;
        isResolved = true;
        this.closeDialog();
        resolve();
      };

      ref.instance.onClose.pipe(first()).subscribe(() => {
        handleClose();
      });

      ref.instance.onOk.pipe(first()).subscribe(() => {
        handleClose();
      });
    });
  }

  /**
   * @description Handles the safe destruction of the active dialog component.
   * @note Detaches the view from ApplicationRef and destroys the ComponentRef instance to prevent memory leaks.
   */
  private closeDialog(): void {
    if (!this.componentRef) {
      return;
    }

    const refToDestroy = this.componentRef;
    this.componentRef = undefined;

    try {
      if (refToDestroy.instance) {
        refToDestroy.instance.hide();
      }
      
      if (refToDestroy.hostView && !refToDestroy.hostView.destroyed) {
        this.appRef.detachView(refToDestroy.hostView);
      }
      
      refToDestroy.destroy();
    } catch (error) {
      console.warn('[AlertDialogService] Warning during dialog closure:', error);
    }
  }
}