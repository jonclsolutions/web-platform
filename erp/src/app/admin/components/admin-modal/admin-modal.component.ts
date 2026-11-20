/**
 * @file admin-modal.component.ts
 * @path src/app/admin/components/admin-modal/admin-modal.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The one modal window ("popup") of the administration. It draws only the frame -
 *   dark backdrop, card, header with the title and the close button, the body and the footer -
 *   and the popup that uses it supplies the content. Header and footer stay in place and only
 *   the body scrolls. Behaviour shared by every popup lives here: closing with the close button,
 *   Escape and a click on the backdrop; the page under it does not scroll; the keyboard focus
 *   moves into the window, stays inside it (Tab) and returns where it was after closing; screen
 *   readers announce it as a dialog with its title. Several windows can be open at once (the
 *   password prompt over a form) - the keyboard belongs to the top one.
 * @usage
 *   ```html
 *   <app-admin-modal [heading]="…" [subheading]="…" size="md" [closeDisabled]="saving" (dismissed)="close()">
 *     …content of the body…
 *     <ng-container modal-footer>
 *       <button type="button" class="am-btn am-btn--secondary" (click)="close()">…</button>
 *       <button type="button" class="am-btn am-btn--primary" (click)="save()">…</button>
 *     </ng-container>
 *   </app-admin-modal>
 *   ```
 *   The popup shows / hides the whole element (`@if`); `dismissed` only asks it to close. The
 *   button classes (`am-btn …`) come from `admin/shared-styles/modal.css`, which the popup adds
 *   to its own `styleUrls` (its template owns the projected buttons). An element of the content
 *   with `data-autofocus` gets the focus when the window opens (otherwise the window itself).
 *   A form whose submit button sits in the footer links it with the `form` attribute
 *   (`<form [id]="formId">` … `<button type="submit" [attr.form]="formId">`).
 * @note Extending: a new part of the frame (e.g. buttons in the header) is a new named slot
 *   (`<ng-content select="[modal-…]">`) here, never a copy of the frame in a popup.
 * @dependencies
 * - ModalStackService: which open window is on top (keyboard handling).
 * - ScrollLockService: the page under the window does not scroll (shared counter).
 * - AdminLocalizationService: the label of the close button (`shared.close`).
 */

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input,
  OnDestroy, OnInit, Output, ViewChild, inject
} from '@angular/core';
import { ModalStackService } from '../../../core/services/modal-stack.service';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/** @description Width of the window: sm 440 px (prompts), md 620 px, lg 900 px (forms), xl 1100 px. */
export type AdminModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * @description Layer of the window: `content` - a popup of a page (form, editor, import …);
 *   `prompt` - a question that opens over another popup (confirmation, password).
 */
export type AdminModalLevel = 'content' | 'prompt';

/** Elements the keyboard can reach (Tab). */
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]'
].join(', ');

/** Counter of the ids that link the window with its title (aria-labelledby). */
let nextId = 0;

@Component({
  selector: 'app-admin-modal',
  standalone: true,
  templateUrl: './admin-modal.component.html',
  styleUrl: './admin-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminModalComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Title in the header (also the name of the dialog for screen readers). */
  @Input({ required: true }) heading!: string;
  /** Smaller text under the title ('' = none). */
  @Input() subheading = '';
  /** Width of the window. */
  @Input() size: AdminModalSize = 'md';
  /** Layer of the window. */
  @Input() level: AdminModalLevel = 'content';
  /** The window cannot be closed now (e.g. while saving) - the close button is disabled, Escape and the backdrop do nothing. */
  @Input() closeDisabled = false;
  /** A click on the backdrop closes the window. */
  @Input() closeOnBackdrop = true;
  /** The user asked to close the window (close button, Escape, backdrop). */
  @Output() dismissed = new EventEmitter<void>();

  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLElement>;

  private readonly stack = inject(ModalStackService);
  private readonly scrollLock = inject(ScrollLockService);
  private readonly i18n = inject(AdminLocalizationService);

  /** Ids of the title and the subtitle (aria-labelledby / aria-describedby). */
  readonly headingId = `am-${++nextId}-title`;
  readonly subheadingId = `${this.headingId}-sub`;

  /** The mouse button went down on the backdrop (a drag from the content ending outside does not close). */
  private pressedOnBackdrop = false;
  /** Element focused before the window opened - it gets the focus back. */
  private returnFocus: HTMLElement | null = null;
  private opened = false;

  /** @description Label of the close button. */
  get closeLabel(): string {
    return this.i18n.getValue('shared.close');
  }

  /** @description Registers the window on top, locks the page scroll, remembers the focus. */
  ngOnInit(): void {
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.stack.open(this);
    this.scrollLock.lock();
    this.opened = true;
  }

  /** @description Moves the focus into the window - to `[data-autofocus]` of the content, otherwise the window. */
  ngAfterViewInit(): void {
    const card = this.dialog.nativeElement;
    const target = card.querySelector<HTMLElement>('[data-autofocus]') ?? card;
    target.focus({ preventScroll: true });
  }

  /** @description Unregisters the window, releases the scroll lock and returns the focus. */
  ngOnDestroy(): void {
    if (!this.opened) return;
    this.opened = false;
    this.stack.close(this);
    this.scrollLock.unlock();
    if (this.returnFocus?.isConnected) {
      this.returnFocus.focus({ preventScroll: true });
    }
  }

  /** @description Asks the popup to close (unless closing is disabled now). */
  requestClose(): void {
    if (this.closeDisabled) return;
    this.dismissed.emit();
  }

  /**
   * @description Remembers whether the press started on the backdrop itself.
   * @param event mousedown on the backdrop.
   */
  onBackdropMousedown(event: MouseEvent): void {
    this.pressedOnBackdrop = event.target === event.currentTarget;
  }

  /**
   * @description A click on the backdrop (pressed and released on it) closes the window.
   * @param event click on the backdrop.
   */
  onBackdropClick(event: MouseEvent): void {
    const onBackdrop = this.pressedOnBackdrop && event.target === event.currentTarget;
    this.pressedOnBackdrop = false;
    if (onBackdrop && this.closeOnBackdrop) this.requestClose();
  }

  /**
   * @description Keyboard of the top window: Escape closes it, Tab keeps the focus inside.
   * @param event Key pressed anywhere on the page.
   */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.stack.isTop(this)) return;
    if (event.key === 'Escape') {
      if (this.closeDisabled) return;
      event.preventDefault();
      this.requestClose();
    } else if (event.key === 'Tab') {
      this.keepFocusInside(event);
    }
  }

  /**
   * @description Tab from the last element goes to the first one and Shift+Tab from the first one
   *   to the last one; focus outside the window is brought back.
   * @param event The Tab key.
   */
  private keepFocusInside(event: KeyboardEvent): void {
    const card = this.dialog.nativeElement;
    const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.getClientRects().length > 0);
    const active = document.activeElement;
    if (items.length === 0) {
      event.preventDefault();
      card.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (!card.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && (active === first || active === card)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
