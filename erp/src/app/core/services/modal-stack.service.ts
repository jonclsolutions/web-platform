/**
 * @file modal-stack.service.ts
 * @path src/app/core/services/modal-stack.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Order of the open modals of the administration (AdminModalComponent). Several can
 *   be open at once - e.g. the password prompt over a record form - and keyboard handling
 *   (Escape closes, Tab stays inside) belongs only to the one on top, the last one opened.
 * @usage A modal calls `open(this)` when it appears and `close(this)` when it is destroyed, and
 *   asks `isTop(this)` before it reacts to a key.
 * @dependencies none
 */

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ModalStackService {
  /** Open modals, the last one on top. */
  private readonly stack: object[] = [];

  /**
   * @description Registers a modal that has just opened (it becomes the top one).
   * @param modal The modal instance.
   */
  open(modal: object): void {
    this.close(modal);
    this.stack.push(modal);
  }

  /**
   * @description Removes a closed modal (wherever it is - modals may close out of order).
   * @param modal The modal instance.
   */
  close(modal: object): void {
    const index = this.stack.indexOf(modal);
    if (index >= 0) this.stack.splice(index, 1);
  }

  /**
   * @description Whether the modal is the top one - the one that handles the keyboard.
   * @param modal The modal instance.
   */
  isTop(modal: object): boolean {
    return this.stack.length > 0 && this.stack[this.stack.length - 1] === modal;
  }
}
