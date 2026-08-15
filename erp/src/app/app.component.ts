/**
 * @file app.component.ts
 * @path src/app/app.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Root component of the application, serving as the main entry point for the component tree.
 * @dependencies
 * - AuthService: Used to verify the authentication state upon application initialization.
 * - PublicDataService: Used to read the cached global settings (populated by
 *   AppBootstrapService at startup) and resolve dynamic assets.
 * - ApplicationRef: Used to detect when the app (including lazy-loaded route chunks and
 *   any in-flight HTTP requests) has become fully stable, to hide the static index.html loader.
 *
 * @refactor-note (2026-08) Přidáno skrytí `#initial-loader` (statický spinner v index.html,
 * viz jeho @refactor-note) přes `ApplicationRef.isStable`. Dřív tenhle spinner mizel
 * automaticky, jakmile Angular vložil AppComponent šablonu do DOM (konec
 * APP_INITIALIZERu) - ale routovaná (lazy-loaded) komponenta s headerem v tu chvíli ještě
 * nebyla stažená ani vykreslená, takže bylo krátce vidět prázdnou stránku. `isStable`
 * emitne `true` až NgZone nemá ŽÁDNÉ čekající úlohy - to zahrnuje dynamický `import()`
 * lazy route chunku (Promise, patchovaný zone.js), veškeré HTTP requesty spuštěné uvnitř
 * NgZone (checkAuth() níže) i libovolné `setTimeout`. Používá se
 * `first(isStable => isStable)`, takže se loader skrývá jen JEDNOU - po prvním dosažení
 * stability, i kdyby appka později (např. při navigaci) zase krátce "nestabilizovala"
 * kvůli dalším HTTP voláním (o ty se stará LoadingInterceptor/LoadingService, ne tenhle kód).
 *
 * @bugfix-note (2026-08-15) `ngOnInit()` dřív volalo vlastní, NEZÁVISLÉ
 * `publicDataService.get('public/legal/config')` jen kvůli faviconě - mimo jednotnou
 * cache (`siteSettingsValue$`) populovanou `AppBootstrapService` při startu. Důsledek:
 * duplicitní síťový request na KAŽDÉ stránce (AppComponent se renderuje vždy, nezávisle
 * na routě) - viditelné i během web maintenance, protože tohle volání běželo úplně mimo
 * `webMaintenanceGuard`/`AppBootstrapService` logiku a nikdo ho negatoval. Přepojeno na
 * `siteSettingsValue$` (stejný vzor jako `BasePublicComponent`) - žádný nový request,
 * jen čtení z paměti. Favicon se aktualizuje, jakmile cache poprvé dostane hodnotu
 * (APP_INITIALIZER již dokončen v tu chvíli, takže první emit přijde synchronně).
 */

import { Component, OnInit, ApplicationRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { first } from 'rxjs/operators';
import { AuthService } from './core/auth/auth.service';
import { PublicDataService } from './shared/services/public-data.service';

/**
 * @description The root entry point of the application. It acts as the container for all routed views.
 * @usage Bootstrap entry point for the Angular application.
 * @note This component triggers authentication checks, handles global UI configurations like
 * dynamic favicon updates, and hides the static index.html loading spinner once the app is stable.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  private appRef = inject(ApplicationRef);

  constructor(
    private authService: AuthService,
    private publicDataService: PublicDataService
  ) {}

  /**
   * @description Initializes authentication and global site configurations.
   */
  ngOnInit(): void {
    this.authService.checkAuth().subscribe();

    // Read from the cache populated by AppBootstrapService at startup instead of
    // firing a duplicate HTTP request here (see bugfix-note in file header).
    this.publicDataService.siteSettingsValue$.subscribe(res => {
      if (res?.settings?.logo_path) {
        const url = this.publicDataService.getStorageUrl(res.settings.logo_path);
        this.updateFavicon(url);
      }
    });

    this.hideInitialLoaderWhenStable();
  }

  /**
   * @description Waits for the very first moment NgZone has no pending macro/microtasks
   * (initial CD cycle, lazy route chunk import, checkAuth() HTTP call above resolved),
   * then fades out and removes the static `#initial-loader` element from index.html.
   * Falls back to a no-op if the element is already gone (defensive - should
   * never happen in normal flow, but harmless if it does).
   */
  private hideInitialLoaderWhenStable(): void {
    this.appRef.isStable
      .pipe(first(isStable => isStable))
      .subscribe(() => {
        const loader = document.getElementById('initial-loader');
        if (!loader) return;

        loader.classList.add('fade-out');
        loader.addEventListener('transitionend', () => loader.remove(), { once: true });
      });
  }

  /**
   * @description Dynamically updates the favicon in the document head.
   * @param url The fully qualified URL to the new logo asset.
   */
  private updateFavicon(url: string): void {
    const link: HTMLLinkElement = document.querySelector('#dynamic-favicon') ||
      document.createElement('link');
    link.id = 'dynamic-favicon';
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
  }
}