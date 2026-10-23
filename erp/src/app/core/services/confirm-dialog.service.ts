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
 * @bugfix-note (2026-10-23) Button labels (open finding #20): `open()` takes optional `labels`;
 *   without them the defaults of the current surface are used (`setDefaultLabels()`, set by the
 *   admin layout from the admin translations), and only then the neutral English defaults of the
 *   component. The service itself stays independent of the admin / public translation services
 *   (the dialog is used on both).
 */

import { Injectable, ComponentRef, ApplicationRef, createComponent, EnvironmentInjector, EmbeddedViewRef } from '@angular/core';
import { ConfirmDialogComponent } from '../../admin/components/confirm-dialog/confirm-dialog.component';
import { first } from 'rxjs';

/**
 * @description Texts of the two dialog buttons; a missing / empty one falls back to the default.
 */
export interface ConfirmDialogLabels {
  confirm?: string;
  cancel?: string;
}

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
  /** Resolver of the promise of the currently open dialog (settled as `false` when replaced). */
  private pendingResolve?: (confirmed: boolean) => void;
  /** Labels used when the caller passes none (set by the surface layout, e.g. AdminLayoutComponent). */
  private defaultLabels: ConfirmDialogLabels | null = null;

  constructor(
    private environmentInjector: EnvironmentInjector,
    private appRef: ApplicationRef
  ) { }

  /**
   * @description Opens a confirmation dialog and returns a Promise resolving to a boolean.
   * @param title The dialog header text.
   * @param message The confirmation question/body text.
   * @param labels Optional button texts; missing ones come from `setDefaultLabels()` / the component.
   * @returns {Promise<boolean>} Resolves to 'true' on confirm, 'false' on cancel.
   * @note If a dialog is already active, it is destroyed before the new one is initialized.
   * @bugfix-note (2026-10-23) The promise of a dialog replaced by a newer open() never settled
   *   (the awaiting caller hung forever and leaked) - it now resolves to `false` (= not confirmed).
   */
  open(title: string, message: string, labels?: ConfirmDialogLabels): Promise<boolean> {
    this.settle(false);
    this.closeDialog();

    this.componentRef = createComponent(ConfirmDialogComponent, {
      environmentInjector: this.environmentInjector
    });

    const domElem = (this.componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    this.appRef.attachView(this.componentRef.hostView);
    document.body.appendChild(domElem);

    this.componentRef.instance.title = title;
    this.componentRef.instance.message = message;
    const confirmLabel = labels?.confirm || this.defaultLabels?.confirm;
    const cancelLabel = labels?.cancel || this.defaultLabels?.cancel;
    if (confirmLabel) this.componentRef.instance.confirmLabel = confirmLabel;
    if (cancelLabel) this.componentRef.instance.cancelLabel = cancelLabel;
    this.componentRef.instance.show();

    return new Promise<boolean>((resolve) => {
      this.pendingResolve = resolve;

      this.componentRef?.instance.onConfirm.pipe(first()).subscribe(() => {
        this.closeDialog();
        this.settle(true);
      });

      this.componentRef?.instance.onCancel.pipe(first()).subscribe(() => {
        this.closeDialog();
        this.settle(false);
      });
    });
  }

  /**
   * @description Sets (or clears with `null`) the button labels used when `open()` gets none.
   * @param labels Translated default labels of the current surface.
   */
  setDefaultLabels(labels: ConfirmDialogLabels | null): void {
    this.defaultLabels = labels;
  }

  /**
   * @description Settles the promise of the open dialog (once).
   * @param confirmed Result handed to the caller.
   */
  private settle(confirmed: boolean): void {
    const resolve = this.pendingResolve;
    this.pendingResolve = undefined;
    resolve?.(confirmed);
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