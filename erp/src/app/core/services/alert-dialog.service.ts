/**
 * @file alert-dialog.service.ts
 * @path src/app/core/services/alert-dialog.service.ts
 * @project RPSW Web
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

/**
 * @description Provides functionality to display global alert dialogs without needing to declare them in every template.
 * @usage Used across the application to trigger user alerts, confirmations, or notifications.
 * @note Manages a single persistent toast-queue component for the lifetime of the app -
 * see @refactor-note above for why this replaced the old create/destroy-per-alert approach.
 */
@Injectable({
  providedIn: 'root'
})
export class AlertDialogService {
  private componentRef?: ComponentRef<AlertDialogComponent>;
  private nextId = 0;
  private pendingResolvers = new Map<number, () => void>();

  constructor(
    private environmentInjector: EnvironmentInjector,
    private appRef: ApplicationRef
  ) {}

  /**
   * @description Queues a new toast notification and returns a Promise that resolves when
   * THAT SPECIFIC toast is closed (by the user, or by its own auto-hide timer) - it no
   * longer waits for, or is affected by, any other toast currently in the queue.
   * @param title The dialog header text.
   * @param message The content body text.
   * @param type The alert classification (e.g., 'info', 'error').
   * @returns {Promise<void>} Resolves when this toast is closed.
   */
  open(title: string, message: string, type: AlertType = 'info'): Promise<void> {
    this.ensureContainer();

    const id = ++this.nextId;

    return new Promise<void>((resolve) => {
      this.pendingResolvers.set(id, resolve);
      this.componentRef!.instance.addToast({ id, title, message, type });
    });
  }

  /**
   * @description Lazily creates and mounts the single, long-lived toast-queue container
   * component - only runs once, on the first call to open() in the app's lifetime.
   */
  private ensureContainer(): void {
    if (this.componentRef) {
      return;
    }

    const ref = createComponent(AlertDialogComponent, {
      environmentInjector: this.environmentInjector
    });

    this.componentRef = ref;

    const domElem = (ref.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    this.appRef.attachView(ref.hostView);
    document.body.appendChild(domElem);

    ref.instance.toastClosed.subscribe((id: number) => {
      const resolve = this.pendingResolvers.get(id);
      if (resolve) {
        this.pendingResolvers.delete(id);
        resolve();
      }
    });
  }
}