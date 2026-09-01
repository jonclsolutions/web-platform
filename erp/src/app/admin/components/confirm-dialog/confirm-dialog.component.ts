/**
 * @file confirm-dialog.component.ts
 * @path src/app/admin/components/confirm-dialog/confirm-dialog.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A reusable modal dialog component for capturing user confirmation before executing critical or destructive actions.
 * @dependencies
 * - Angular core: Component, EventEmitter, Input, Output decorators.
 * - ScrollLockService: Sdílený zámek scrollu na pozadí (viz refactor-note 2026-08-31).
 *
 * @refactor-note (2026-08-31) SCROLL LOCK SJEDNOCEN - dřív vlastní `no-scroll` CSS
 * třída přidávaná/odebíraná na `<body>` v `blockBackgroundScroll()`/
 * `unblockBackgroundScroll()`. Na rozdíl od ostatních overlay komponent (které vznikají
 * a zanikají 1:1 s viditelností přes `@if` v rodičovské šabloně, takže zámek šel do
 * `ngOnInit`/`ngOnDestroy`) je tahle komponenta typicky DLOUHOŽIJÍCÍ SINGLETON řízený
 * `ConfirmDialogService` - `show()`/`hide()` se volají IMPERATIVNĚ na stále existující
 * instanci, ne přes vznik/zánik komponenty. Zámek proto žije přímo v `show()`/`hide()`,
 * ne v lifecycle hoocích, a deleguje na sdílený `ScrollLockService` (stejné referenční
 * počítadlo jako u všech ostatních modalů v aplikaci - viz scroll-lock.service.ts),
 * takže se správně chová i když je confirm dialog otevřený NAD jiným už zamčeným
 * overlayem (např. potvrzení mazání nad export popupem) - zavření confirm dialogu pak
 * neodemkne scroll předčasně, dokud je pořád otevřený ten vnější overlay.
 */

import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';

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

  private scrollLock = inject(ScrollLockService);

  /**
   * @description Displays the dialog and locks the background scroll.
   */
  show(): void {
    this.isVisible = true;
    this.scrollLock.lock();
  }

  /**
   * @description Hides the dialog and restores background scroll.
   */
  public hide(): void {
    this.isVisible = false;
    this.scrollLock.unlock();
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