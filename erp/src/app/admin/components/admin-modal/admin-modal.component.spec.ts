/**
 * @file admin-modal.component.spec.ts
 * @path src/app/admin/components/admin-modal/admin-modal.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AdminModalComponent - the frame of every admin popup: header,
 *   projected body and footer, size and layer, dialog semantics, closing (button, Escape,
 *   backdrop, disabled while busy), scroll lock, focus (initial, kept inside, returned) and two
 *   windows open at once (the keyboard belongs to the top one).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub returning the key itself).
 * - ScrollLockService (replaced by a spy).
 */

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminModalComponent, AdminModalLevel, AdminModalSize } from './admin-modal.component';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';
import { createI18nStub } from '../../../../testing/admin-test-helpers';

/** Host with a body (a field marked data-autofocus), a footer and an optional second window. */
@Component({
  standalone: true,
  imports: [AdminModalComponent],
  template: `
    <button id="opener">open</button>
    @if (open()) {
      <app-admin-modal heading="Title" [subheading]="sub()" [size]="size()" [level]="level()"
                       [closeDisabled]="busy()" [closeOnBackdrop]="backdrop()" (dismissed)="dismissed = dismissed + 1">
        <input id="first" [attr.data-autofocus]="autofocus() ? '' : null">
        <ng-container modal-footer>
          @if (footer()) { <button id="cancel">Cancel</button><button id="save">Save</button> }
        </ng-container>
      </app-admin-modal>
    }
    @if (second()) {
      <app-admin-modal heading="Second" level="prompt" (dismissed)="secondDismissed = secondDismissed + 1">
        <button id="inner">x</button>
      </app-admin-modal>
    }
  `
})
class HostComponent {
  open = signal(true);
  second = signal(false);
  sub = signal('');
  size = signal<AdminModalSize>('md');
  level = signal<AdminModalLevel>('content');
  busy = signal(false);
  backdrop = signal(true);
  footer = signal(true);
  autofocus = signal(true);
  dismissed = 0;
  secondDismissed = 0;
}

describe('AdminModalComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;
  const el = (): HTMLElement => fixture.nativeElement;
  const q = (selector: string) => el().querySelector(selector) as HTMLElement;
  const key = (k: string, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return event;
  };

  /** Creates the host; `setup` changes its signals before the first render. */
  function create(setup: (h: HostComponent) => void = () => {}): void {
    scrollLock = jasmine.createSpyObj<ScrollLockService>('ScrollLockService', ['lock', 'unlock']);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: AdminLocalizationService, useValue: createI18nStub() },
        { provide: ScrollLockService, useValue: scrollLock },
      ]
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    setup(host);
    document.body.appendChild(el()); // focus works only on attached elements
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture.destroy();
    el().remove();
  });

  /**
   * @description The frame: title, close label, projected body and footer, size and layer
   *   attributes, dialog semantics; a subtitle describes the dialog; an empty footer is hidden.
   * @input heading 'Title'; then subheading 'Sub', size lg, level prompt, no footer buttons.
   * @output role dialog + aria-modal + labelledby = title id; close 'shared.close'; body input,
   *   footer buttons; data-size md / level content; then subtitle + describedby, lg, prompt,
   *   footer not displayed.
   */
  it('renders the frame with the projected content', () => {
    create();
    const card = q('.am-card');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(card.getAttribute('aria-labelledby')).toBe(q('.am-title').id);
    expect(card.getAttribute('aria-describedby')).toBeNull();
    expect(q('.am-title').textContent!.trim()).toBe('Title');
    expect(q('.am-close').getAttribute('aria-label')).toBe('shared.close');
    expect(q('.am-body #first')).not.toBeNull();
    expect(Array.from(el().querySelectorAll('.am-footer button')).map(b => b.id)).toEqual(['cancel', 'save']);
    expect([card.dataset['size'], q('.am-overlay').dataset['level']]).toEqual(['md', 'content']);

    host.sub.set('Sub');
    host.size.set('lg');
    host.level.set('prompt');
    host.footer.set(false);
    fixture.detectChanges();
    expect(q('.am-subtitle').textContent!.trim()).toBe('Sub');
    expect(card.getAttribute('aria-describedby')).toBe(q('.am-subtitle').id);
    expect([card.dataset['size'], q('.am-overlay').dataset['level']]).toEqual(['lg', 'prompt']);
    expect(getComputedStyle(q('.am-footer')).display).toBe('none');
  });

  /**
   * @description Closing: the close button, Escape and a click that starts and ends on the
   *   backdrop ask to close; a click inside the card, a drag from the card to the backdrop and
   *   (when switched off) the backdrop do not; while busy nothing closes.
   * @input close click; Escape; backdrop mousedown+click; card click; drag; closeOnBackdrop false; busy.
   * @output dismissed 3; unchanged by the rest; close button disabled while busy.
   */
  it('asks to close by the button, Escape and the backdrop', () => {
    create();
    q('.am-close').click();
    expect(key('Escape').defaultPrevented).toBeTrue();
    const overlay = q('.am-overlay');
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    overlay.click();
    expect(host.dismissed).toBe(3);

    q('.am-card').click();
    q('.am-card').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    overlay.click();
    expect(host.dismissed).toBe(3);

    host.backdrop.set(false);
    fixture.detectChanges();
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    overlay.click();
    expect(host.dismissed).toBe(3);

    host.busy.set(true);
    fixture.detectChanges();
    expect((q('.am-close') as HTMLButtonElement).disabled).toBeTrue();
    expect(key('Escape').defaultPrevented).toBeFalse();
    expect(host.dismissed).toBe(3);
  });

  /**
   * @description Scroll lock and focus: opening locks the page and focuses `[data-autofocus]`
   *   (otherwise the window); Tab from the last element goes to the first one and Shift+Tab back;
   *   closing unlocks and returns the focus to where it was.
   * @input focus #opener, open; Tab on save; Shift+Tab on the close button; close; without autofocus.
   * @output lock 1; focus #first; close button (first) / save (last); unlock 1, focus #opener; card.
   */
  it('locks the page and keeps the focus inside', () => {
    create(h => h.open.set(false));
    (el().querySelector('#opener') as HTMLElement).focus();
    host.open.set(true);
    fixture.detectChanges();
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
    expect(document.activeElement!.id).toBe('first');

    q('#save').focus();
    expect(key('Tab').defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(q('.am-close'));
    expect(key('Tab', true).defaultPrevented).toBeTrue();
    expect(document.activeElement!.id).toBe('save');
    q('#first').focus();
    expect(key('Tab').defaultPrevented).toBeFalse(); // inside: the browser moves on

    host.open.set(false);
    fixture.detectChanges();
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
    expect(document.activeElement!.id).toBe('opener');

    host.autofocus.set(false);
    host.open.set(true);
    fixture.detectChanges();
    expect(document.activeElement).toBe(q('.am-card'));
  });

  /**
   * @description Two windows: the keyboard belongs to the top (last opened) one; after it
   *   closes, the one below handles Escape again.
   * @input first window, then a second one; Escape; second closed; Escape.
   * @output only the second dismissed; then the first; scroll lock taken twice and released once.
   */
  it('gives the keyboard to the top window', () => {
    create();
    host.second.set(true);
    fixture.detectChanges();
    key('Escape');
    expect([host.dismissed, host.secondDismissed]).toEqual([0, 1]);

    host.second.set(false);
    fixture.detectChanges();
    key('Escape');
    expect([host.dismissed, host.secondDismissed]).toEqual([1, 1]);
    expect(scrollLock.lock).toHaveBeenCalledTimes(2);
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });
});
