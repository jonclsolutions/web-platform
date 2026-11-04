/**
 * @file captcha.component.ts
 * @path src/app/shared/components/captcha/captcha.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Invisible bot protection of the public web forms (contact, order form, job
 * application) - two layers the visitor normally never sees:
 * 1) Cloudflare Turnstile in the `interaction-only` mode - the check runs in the background while
 *    the visitor fills the form; the widget appears only when Cloudflare wants an interaction
 *    (suspicious traffic). Nothing to click for an ordinary visitor.
 * 2) Honeypot - a text field hidden from people (off-screen, no tab stop, hidden from screen
 *    readers, no autofill). Simple bots fill every field; the server then drops the submission.
 * The form calls `nextToken()` on submit (immediate when the background check is done, otherwise
 * it waits for it) and `appendTo(formData)`; after every refused submission it calls `reset()` -
 * a token is single-use. The server verifies both on every submission (PublicFormGuard).
 * @usage
 * `<app-captcha [loadErrorText]="t.errors?.captcha_load" />` and in the form
 * `this.captcha.nextToken().pipe(switchMap(token => post(...)))`.
 * @note The Turnstile script is loaded only here (lazy, TurnstileService). Cloudflare Turnstile
 * sets no tracking cookie - it must be named as a processor in the privacy policy (GDPR).
 * @dependencies
 * - TurnstileService: script loading, render / reset / remove of the widget.
 */

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy, ViewChild,
  inject, signal
} from '@angular/core';
import { BehaviorSubject, Observable, Subject, defer, filter, map, merge, take, throwError, timeout } from 'rxjs';
import { CaptchaUnavailableError } from '../../utils/public-form-errors';
import { TurnstileService, TurnstileTheme } from '../../../core/services/turnstile.service';

/** @description Name of the honeypot field - must match PublicFormGuard::HONEYPOT_FIELD. */
export const HONEYPOT_FIELD = 'website';

/** @description Longest wait for the token on submit (an interactive challenge included), ms. */
export const CAPTCHA_TOKEN_TIMEOUT_MS = 60000;

@Component({
  selector: 'app-captcha',
  standalone: true,
  template: `
    <div class="captcha-trap" aria-hidden="true">
      <label>Website <input #trap type="text" [attr.name]="trapName" tabindex="-1" autocomplete="off"></label>
    </div>
    <div #container class="captcha-widget"></div>
    @if (loadFailed()) {
      <p class="captcha-error" role="alert">{{ loadErrorText }}</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .captcha-trap { position: absolute; left: -10000px; top: auto; width: 1px; height: 1px; overflow: hidden; }
    .captcha-widget:not(:empty) { margin: 4px 0 12px; }
    .captcha-error { margin: 6px 0 12px; font-size: 0.83rem; color: var(--clr-error, #d33); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CaptchaComponent implements AfterViewInit, OnDestroy {
  /** Translated text shown when the captcha script cannot be loaded. */
  @Input() loadErrorText = '';
  /** Colour scheme of the widget when it has to appear (follows the visitor's system setting). */
  @Input() theme: TurnstileTheme = 'auto';

  @ViewChild('container', { static: true }) container!: ElementRef<HTMLDivElement>;
  @ViewChild('trap', { static: true }) trap!: ElementRef<HTMLInputElement>;

  /** Set when the Turnstile script could not be loaded. */
  readonly loadFailed = signal(false);
  readonly trapName = HONEYPOT_FIELD;

  private turnstile = inject(TurnstileService);
  private token$ = new BehaviorSubject<string | null>(null);
  private failed$ = new Subject<void>();
  private widgetId: string | null = null;
  private destroyed = false;

  /**
   * @description Renders the invisible widget - the background check starts right away, so the
   * token is usually ready long before the visitor submits. A widget that finishes rendering
   * after the form was closed is removed at once.
   */
  ngAfterViewInit(): void {
    this.turnstile.render(
      this.container.nativeElement,
      (token) => this.token$.next(token),
      () => this.token$.next(null),
      { theme: this.theme, appearance: 'interaction-only' }
    ).then((id) => {
      if (this.destroyed) {
        this.turnstile.remove(id);
      } else {
        this.widgetId = id;
      }
    }).catch(() => {
      this.loadFailed.set(true);
      this.failed$.next();
    });
  }

  /**
   * @description The token for the submission: emits at once when the background check is done,
   * otherwise when it finishes (an interactive challenge included). Errors with
   * CaptchaUnavailableError when the script could not be loaded or no token came within
   * CAPTCHA_TOKEN_TIMEOUT_MS.
   * @returns Observable emitting one token.
   */
  nextToken(): Observable<string> {
    const unavailable = () => throwError(() => new CaptchaUnavailableError());
    return defer(() => this.loadFailed()
      ? unavailable()
      : merge(
          this.token$.pipe(filter((t): t is string => !!t)),
          this.failed$.pipe(map((): string => { throw new CaptchaUnavailableError(); }))
        ).pipe(take(1), timeout({ first: CAPTCHA_TOKEN_TIMEOUT_MS, with: unavailable })));
  }

  /**
   * @description Adds the captcha token and the honeypot value to the submission.
   * @param formData Multipart body of the form.
   * @param token Token from nextToken().
   */
  appendTo(formData: FormData, token: string): void {
    formData.append('captcha_token', token);
    formData.append(HONEYPOT_FIELD, this.trap.nativeElement.value);
  }

  /**
   * @description Drops the used token and starts a new background check - call after every
   * refused submission (the server consumed the token while verifying it).
   */
  reset(): void {
    this.token$.next(null);
    if (this.widgetId) this.turnstile.reset(this.widgetId);
  }

  /** @description Removes the widget from the page. */
  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.widgetId) this.turnstile.remove(this.widgetId);
  }
}
