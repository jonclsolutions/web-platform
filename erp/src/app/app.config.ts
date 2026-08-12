/**
 * @file app.config.ts
 * @path src/app/app.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Global Angular application configuration, provider registration, and dependency injection setup.
 * @dependencies
 * - AuthTokenInterceptor: Handles automatic JWT injection into outgoing requests.
 * - LoadingInterceptor: Manages global HTTP request state tracking.
 * - AppBootstrapService: Preloads translations + site settings before the app renders,
 *   so the first paint never shows an empty/blank state.
 */

import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { routes } from './app.routes';
import { AuthTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { LoadingInterceptor } from './core/interceptors/loading.interceptor';
import { registerLocaleData } from '@angular/common';
import localeCs from '@angular/common/locales/cs';
import { AppBootstrapService } from './shared/services/app-bootstrap.service';

registerLocaleData(localeCs, 'cs-CZ');

/**
 * @description Factory used by APP_INITIALIZER. Angular waits for the returned
 *   Promise to resolve before bootstrapping the root component, so translations
 *   and site settings are already in memory on first render.
 */
function initAppFactory(bootstrap: AppBootstrapService) {
  return () => bootstrap.init();
}

/**
 * @description Global application configuration object for Angular providers.
 * @usage Provided to the application bootstrap function to initialize DI container.
 * @note Centralizes HTTP interceptors and routing configuration for the entire application.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    /**
     * @description Registers the app routes and enables in-memory scroll handling.
     * @note anchorScrolling lets links like [routerLink] + fragment="kb-security"
     *   smoothly scroll to the matching #kb-security element on the SAME route,
     *   instead of the fragment being misinterpreted as a new root-level route.
     *   scrollPositionRestoration restores the scroll position correctly on
     *   browser back/forward navigation.
     */
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled'
      })
    ),
    provideHttpClient(withInterceptorsFromDi()),

    /**
     * @description Injects the AuthTokenInterceptor to secure API communication.
     * @note Registered as 'multi: true' to allow multiple HTTP interceptors to coexist in the chain.
     */
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthTokenInterceptor,
      multi: true
    },

    /**
     * @description Injects the LoadingInterceptor to track network activity.
     * @note Used to trigger global loading indicators by observing active HTTP requests.
     */
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true
    },

    /**
     * @description Preloads translations and site settings (in parallel) before
     *   the root component is rendered. Prevents the "flash of empty content"
     *   (empty header, missing logo, blank text) on first load.
     */
    {
      provide: APP_INITIALIZER,
      useFactory: initAppFactory,
      deps: [AppBootstrapService],
      multi: true,
    },
  ]
};