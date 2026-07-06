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
 */

import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { routes } from './app.routes';
import { AuthTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { LoadingInterceptor } from './core/interceptors/loading.interceptor';
import { registerLocaleData } from '@angular/common';
import localeCs from '@angular/common/locales/cs';

registerLocaleData(localeCs, 'cs-CZ');

/**
 * @description Global application configuration object for Angular providers.
 * @usage Provided to the application bootstrap function to initialize DI container.
 * @note Centralizes HTTP interceptors and routing configuration for the entire application.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
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
  ]
};