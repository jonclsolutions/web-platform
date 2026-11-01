/**
 * @file turnstile.service.ts
 * @path src/app/core/services/turnstile.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Lazy-loading wrapper of the Cloudflare Turnstile (captcha) script. The script is
 * injected into <head> only on the first render() call - not with the app - because the
 * captcha shows only from the 3rd failed login (see login.component.ts). A smaller third-party
 * tracking surface for an ordinary login.
 */

import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class TurnstileService {
  private scriptLoadPromise: Promise<void> | null = null;

  /**
   * @description Inserts the Turnstile <script> into <head> only once (further calls return the
   * same promise / resolve at once when window.turnstile is already available).
   */
  private loadScript(): Promise<void> {
    if (window.turnstile) return Promise.resolve();
    if (this.scriptLoadPromise) return this.scriptLoadPromise;

    this.scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load security verification.'));
      document.head.appendChild(script);
    });

    return this.scriptLoadPromise;
  }

  /**
   * @description Renders the widget into the given container.
   * @param container Element the widget is rendered into.
   * @param onSuccess Callback with the generated token - sent to the backend on login.
   * @param onExpired Callback when the token expires (Turnstile tokens are short-lived).
   * @returns ID of the widget, needed for a later reset() / remove().
   */
  async render(container: HTMLElement, onSuccess: (token: string) => void, onExpired?: () => void): Promise<string> {
    await this.loadScript();
    return window.turnstile!.render(container, {
      sitekey: environment.turnstileSiteKey,
      callback: onSuccess,
      'expired-callback': () => onExpired?.(),
      'error-callback': () => onExpired?.(),
      theme: 'dark',
    });
  }

  /**
   * @description Forces a new token - MUST be called after every failed login attempt, because a
   * Turnstile token is single-use (the server consumes it when verifying).
   */
  reset(widgetId: string): void {
    window.turnstile?.reset(widgetId);
  }

  /** @description Removes the widget from the DOM and frees the resources (call in ngOnDestroy). */
  remove(widgetId: string): void {
    window.turnstile?.remove(widgetId);
  }
}