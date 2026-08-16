/**
 * @file turnstile.service.ts
 * @path src/app/core/services/turnstile.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Lazy-loading wrapper nad Cloudflare Turnstile (captcha) skriptem.
 * Skript se injektuje do <head> AŽ při prvním zavolání render() - ne automaticky
 * s appkou - protože captcha se má zobrazovat až od 3. neúspěšného loginu (viz
 * login.component.ts), ne pokaždé. Menší třetí-stranový tracking surface pro běžné
 * přihlášení.
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
   * @description Vloží Turnstile <script> do <head>, jen jednou (další volání
   * vrací stejnou promise / rovnou resolvne, pokud už je window.turnstile dostupné).
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
      script.onerror = () => reject(new Error('Nepodařilo se načíst ověření zabezpečení.'));
      document.head.appendChild(script);
    });

    return this.scriptLoadPromise;
  }

  /**
   * @description Vykreslí widget do daného kontejneru.
   * @param container Element, do kterého se widget vyrenderuje.
   * @param onSuccess Callback s vygenerovaným tokenem - poslat na backend při loginu.
   * @param onExpired Callback při vypršení tokenu (Turnstile tokeny mají krátkou platnost).
   * @returns ID widgetu, potřebné pro pozdější reset()/remove().
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
   * @description Vynutí nový token - MUSÍ se zavolat po každém neúspěšném pokusu
   * o login, protože Turnstile token je jednorázový (server ho po ověření spotřebuje).
   */
  reset(widgetId: string): void {
    window.turnstile?.reset(widgetId);
  }

  /** @description Odstraní widget z DOM a uvolní zdroje (volat v ngOnDestroy). */
  remove(widgetId: string): void {
    window.turnstile?.remove(widgetId);
  }
}