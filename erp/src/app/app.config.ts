/**
 * @file app.config.ts
 * @path src/app/app.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Global Angular application configuration, provider registration, and dependency injection setup.
 * @dependencies
 * - AuthTokenInterceptor: Handles automatic JWT injection into outgoing requests.
 * - LoadingInterceptor: Manages global HTTP request state tracking.
 * - AppBootstrapService: Preloads translations + site settings before the app renders,
 *   so the first paint never shows an empty/blank state.
 * - PageTitleStrategy: Resolves route `title` keys ("web.home") to the client-editable
 *   browser tab titles from `legal_page_titles`.
 * - LanguageUrlSerializer + LanguageRoutingService: The language in the public URLs (`/cs/…`,
 *   `/en/…`) - read from and written into the URLs, `<html lang>`.
 * - TextEditorLocationStrategy: path URLs; in the frame of the visual text editor no entries of
 *   the history of the tab (the Back button belongs to the admin).
 */

import { ApplicationConfig, APP_INITIALIZER, inject, provideAppInitializer } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig, TitleStrategy, UrlSerializer } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { routes } from './app.routes';
import { AuthTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { LoadingInterceptor } from './core/interceptors/loading.interceptor';
import { PasswordConfirmationInterceptor } from './core/interceptors/password-confirmation.interceptor';
import { LocationStrategy, registerLocaleData } from '@angular/common';
import localeCs from '@angular/common/locales/cs';
import localeEn from '@angular/common/locales/en';
import { AppBootstrapService } from './shared/services/app-bootstrap.service';
import { PageTitleStrategy } from './shared/services/page-title.strategy.service';
import { LanguageUrlSerializer } from './shared/services/language-url-serializer';
import { LanguageRoutingService } from './shared/services/language-routing.service';
import { TextEditorLocationStrategy } from './public/text-editor/text-editor-location-strategy';

registerLocaleData(localeCs, 'cs-CZ');
registerLocaleData(localeEn, 'en-US');

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
     * @note anchorScrolling lets links like [routerLink] + fragment="kb-12"
     *   smoothly scroll to the matching #kb-12 element on the SAME route,
     *   instead of the fragment being misinterpreted as a new root-level route.
     *   scrollPositionRestoration restores the scroll position correctly on
     *   browser back/forward navigation.
     * @note canceledNavigationResolution 'computed': a Back / Forward cancelled by a guard (unsaved
     *   texts) returns the browser history to where it was - with the default ('replace') the
     *   next Back skipped the guard and left the page.
     */
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled'
      }),
      withRouterConfig({ canceledNavigationResolution: 'computed' })
    ),

    /**
     * @description Browser tab titles from the admin ("Page titles").
     * @note Route `title` values are keys ("web.home", "admin.panel"), resolved by
     *   PageTitleStrategy in the current language. Must be registered, otherwise
     *   the default strategy shows the raw key.
     */
    { provide: TitleStrategy, useClass: PageTitleStrategy },

    /**
     * @description Path URLs; the website in the frame of the visual text editor replaces its
     *   history entry instead of adding one (Back leaves the editor, never steps back in the frame).
     */
    { provide: LocationStrategy, useClass: TextEditorLocationStrategy },

    /**
     * @description Language prefix of the public URLs (2026-11): routes and links stay without a
     *   language, the serializer removes the prefix when reading a URL (and switches to its
     *   language) and adds the current language when writing one. Admin / sign-in URLs unchanged.
     */
    { provide: UrlSerializer, useClass: LanguageUrlSerializer },
    // Follows the language of every navigated URL - started before the first navigation.
    provideAppInitializer(() => inject(LanguageRoutingService).init()),

    provideHttpClient(withInterceptorsFromDi()),

    /**
     * @description Step-up re-authentication (2026-10-26): a request refused with 403
     *   PASSWORD_CONFIRMATION_REQUIRED asks for the password and is repeated once.
     * @note FIRST on purpose - see the header of password-confirmation.interceptor.ts.
     */
    {
      provide: HTTP_INTERCEPTORS,
      useClass: PasswordConfirmationInterceptor,
      multi: true
    },

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