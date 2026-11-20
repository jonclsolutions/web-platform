/**
 * @file password-dialog.service.ts
 * @path src/app/core/services/password-dialog.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Opens the shared password dialog of the administration (PasswordDialogComponent)
 *   the same way as ConfirmDialogService / AlertDialogService - no template needed. The caller
 *   passes the texts and `submit(password)`, which performs the operation: `null` = done (the
 *   dialog closes, the promise resolves `true`), a text = failed (the dialog stays open with the
 *   text under the field, '' = without a text). Cancel resolves `false`.
 * @note The password lives only in the dialog field and in the caller's one request - this
 *   service never stores or logs it (GDPR art. 32, data minimisation).
 * @note AdminLocalizationService is taken LAZILY from the Injector: the service is used by
 *   PasswordConfirmationService, a dependency of an HTTP interceptor (eager injection while
 *   HttpClient is being built = circular DI, NG0200).
 * @dependencies
 * - PasswordDialogComponent: the prompt (created dynamically, attached to document.body).
 * - AdminLocalizationService: default texts of the admin section `password-dialog`.
 */

import { ApplicationRef, ComponentRef, EmbeddedViewRef, EnvironmentInjector, Injectable, Injector, createComponent, inject } from '@angular/core';
import { PasswordDialogComponent } from '../../admin/components/password-dialog/password-dialog.component';
import { AdminLocalizationService } from './admin-localization.service';

/** @description What the dialog shows and does; only `title` and `submit` are required. */
export interface PasswordDialogOptions {
  /** Header of the dialog. */
  title: string;
  /** Description above the field. */
  message?: string;
  /** Highlighted value after the description (e.g. the target state). */
  highlight?: string;
  /** Colour of the highlighted value (default success = green). */
  highlightTone?: 'success' | 'warning' | 'danger';
  /** Amber warning box above the field. */
  warning?: string;
  /** Label of the field (default "Current password"). */
  label?: string;
  /** Text of the confirm button (default "Confirm"). */
  confirmLabel?: string;
  /** Text of the cancel button (default "Cancel"). */
  cancelLabel?: string;
  /**
   * Performs the operation with the password.
   * @returns null = done; a text = failed, shown under the field ('' = stay open without a text).
   */
  submit: (password: string) => Promise<string | null>;
}

/**
 * @description Global password dialog.
 * @usage `if (await passwordDialog.open({ title, message, submit: pw => … })) { … }`
 */
@Injectable({ providedIn: 'root' })
export class PasswordDialogService {
  private readonly injector = inject(Injector);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);

  private componentRef?: ComponentRef<PasswordDialogComponent>;
  /** Resolver of the open dialog - called with `false` when the dialog is replaced. */
  private openResolve?: (done: boolean) => void;

  /**
   * @description Opens the dialog; an already open one is replaced (it resolves `false`).
   * @param options Texts and the operation.
   * @returns Promise - `true` = the operation succeeded, `false` = cancelled / replaced.
   */
  open(options: PasswordDialogOptions): Promise<boolean> {
    this.close();
    return new Promise<boolean>(resolve => this.mount(options, resolve));
  }

  /** @description Whether a dialog is open. */
  get isOpen(): boolean {
    return !!this.componentRef;
  }

  /**
   * @description Creates the dialog and wires submit / cancel.
   * @param options Texts and the operation.
   * @param resolve Resolver of the open() promise.
   */
  private mount(options: PasswordDialogOptions, resolve: (done: boolean) => void): void {
    const ref = createComponent(PasswordDialogComponent, { environmentInjector: this.environmentInjector });
    this.componentRef = ref;
    this.openResolve = resolve;
    this.appRef.attachView(ref.hostView);
    document.body.appendChild((ref.hostView as EmbeddedViewRef<unknown>).rootNodes[0] as HTMLElement);
    ref.instance.setTexts({
      title: options.title,
      message: options.message ?? '',
      highlight: options.highlight ?? '',
      highlightTone: options.highlightTone ?? 'success',
      warning: options.warning ?? '',
      label: options.label || this.t('label'),
      confirm: options.confirmLabel || this.t('confirm'),
      cancel: options.cancelLabel || this.t('cancel'),
    });

    const cancelSub = ref.instance.cancelled.subscribe(() => {
      this.close(ref);
      resolve(false);
    });
    const submitSub = ref.instance.submitted.subscribe(async (password: string) => {
      let error: string | null;
      try {
        error = await options.submit(password);
      } catch {
        error = this.t('failed');
      }
      if (this.componentRef !== ref) return;     // closed meanwhile
      if (error === null) {
        this.close(ref);
        resolve(true);
      } else {
        ref.instance.showError(error);
      }
    });
    ref.onDestroy(() => {
      cancelSub.unsubscribe();
      submitSub.unsubscribe();
    });
  }

  /**
   * @description Destroys the open dialog (only `ref` when given); a replaced one resolves `false`.
   * @param ref Dialog to close (undefined = the current one, replaced).
   */
  private close(ref?: ComponentRef<PasswordDialogComponent>): void {
    const current = this.componentRef;
    if (!current || (ref && ref !== current)) return;
    this.componentRef = undefined;
    const replacedResolve = ref ? undefined : this.openResolve;
    this.openResolve = undefined;
    this.appRef.detachView(current.hostView);
    current.destroy();
    replacedResolve?.(false);
  }

  /**
   * @description Default text of the admin section `password-dialog`.
   * @param key Key inside the section.
   */
  private t(key: string): string {
    return this.injector.get(AdminLocalizationService).getValue(`password-dialog.${key}`);
  }
}
