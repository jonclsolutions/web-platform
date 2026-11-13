/**
 * @file app.routes.ts
 * @path src/app/app.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Routing of the whole frontend: the public routes of the installed applications
 *   (from their manifests, apps.registry.ts), the login / password reset / account activation and
 *   the lazy-loaded admin, then the public catch-all routes of the applications.
 * @dependencies
 * - APPS (apps.registry.ts): publicRoutes / publicFallbackRoutes of every application.
 * - AdminRoutingModule: Loads the protected administrative section.
 * @note `title` values are page keys for PageTitleStrategy, not display texts. Without any
 *   application with a catch-all route an unknown URL leads to the admin (its 404 page).
 */

import { Routes } from '@angular/router';
import { APPS } from './apps/apps.registry';

/**
 * @description Main application routing configuration.
 * @usage Imported by the root application config.
 * @note All public pages use lazy loading. The catch-all routes of the applications MUST come
 *   last - the router takes the first match.
 */
export const routes: Routes = [
  // --- PUBLIC ROUTES OF THE APPLICATIONS (web, e-shop, project portal …) ---
  ...APPS.flatMap(app => app.publicRoutes ?? []),

  // --- ADMIN & AUTH (core) ---
  { path: 'auth/login', title: 'admin.panel', loadComponent: () => import('./admin/auth/login/login.component').then(m => m.LoginComponent) },
  {
    // Public page outside AdminLayoutComponent and AuthGuard - target of the link in the e-mail.
    path: 'auth/reset-password',
    title: 'admin.panel',
    loadComponent: () =>
      import('./admin/auth/reset-password/reset-password.component')
        .then(m => m.ResetPasswordComponent)
  },
  {
    // Public page outside AdminLayoutComponent and AuthGuard - target of the link in
    // AccountActivationMail (account created by an admin, waiting for the password).
    path: 'auth/activate-account/:token',
    title: 'admin.panel',
    loadComponent: () =>
      import('./admin/auth/activate-account/activate-account.component')
        .then(m => m.ActivateAccountComponent)
  },
  { path: 'admin', title: 'admin.panel', loadChildren: () => import('./admin/admin-routing.module').then(m => m.AdminRoutingModule) },

  // --- CATCH-ALL ROUTES OF THE APPLICATIONS (e.g. the 404 of the public web) - MUST STAY LAST ---
  ...APPS.flatMap(app => app.publicFallbackRoutes ?? []),
  { path: '**', redirectTo: 'admin' },
];
