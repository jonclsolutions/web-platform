/**
 * @file web-public.routes.ts
 * @path src/app/apps/web/public/web-public.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public routes of the web application: the website in its layout (home, services,
 *   contact, references, FAQ, knowledge base, about us, jobs, the shared
 *   legal pages and the known 404 address), its maintenance page and the catch-all 404 of the
 *   public web.
 * @usage `publicRoutes` / `publicFallbackRoutes` of WEB_APP (web.app.ts), composed by app.routes.ts.
 * @note The root path ('') and '/home' both resolve directly to HomeComponent (no redirectTo) so the
 *   browser address bar keeps showing the clean domain root. `title` values are page keys for
 *   PageTitleStrategy, not display texts.
 */

import { Routes } from '@angular/router';
import { webMaintenanceGuard } from './components/guards/web-maintenance.guard';
import { publicNotFoundRoute } from '../../../public/not-found/public-not-found.config';
import { PUBLIC_AREA_DATA, PublicArea } from '../../../public/public-area';
import { legalPageRoute } from '../../../public/legal/legal-page/legal-page.config';

/** Public area of the web: its translations, home page and the dark look of the shared pages. */
export const WEB_PUBLIC_AREA: PublicArea = { translationModule: 'web', path: '', theme: 'dark' };

export const WEB_PUBLIC_ROUTES: Routes = [
  {
    path: '',
    canActivateChild: [webMaintenanceGuard],
    data: { [PUBLIC_AREA_DATA]: WEB_PUBLIC_AREA },
    loadComponent: () => import('./web-layout/web-layout.component').then(m => m.WebLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'web.home',
        loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'home',
        title: 'web.home',
        loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
      },
      { path: 'services', title: 'web.services', loadComponent: () => import('./services/services.component').then(m => m.ServicesComponent) },
      { path: 'contact', title: 'web.contact', loadComponent: () => import('./contact/contact.component').then(m => m.ContactComponent) },
      legalPageRoute('web', 'tos'),
      legalPageRoute('web', 'gdpr'),
      { path: 'references', title: 'web.references', loadComponent: () => import('./references/references.component').then(m => m.ReferencesComponent) },
      { path: 'faq', title: 'web.faq', loadComponent: () => import('./faq/faq.component').then(m => m.FaqComponent) },
      { path: 'knowledge-base', title: 'web.knowledge-base', loadComponent: () => import('./knowledge-base/knowledge-base.component').then(m => m.KnowledgeBaseComponent) },
      legalPageRoute('web', 'cookies'),
      { path: 'about-us', title: 'web.about-us', loadComponent: () => import('./about-us/about-us.component').then(m => m.AboutUsComponent) },
      { path: 'jobs', title: 'web.jobs', loadComponent: () => import('./jobs/jobs-list/jobs-list.component').then(m => m.JobsListComponent) },
      { path: 'jobs/:id', title: 'web.job-detail', loadComponent: () => import('./jobs/job-item/job-item.component').then(m => m.JobItemComponent) },
      // Known address of the web 404 page (e.g. for links); unknown URLs use the catch-all at the end.
      { ...publicNotFoundRoute('web'), path: '404' },
    ]
  },
  {
    path: 'web-maintenance',
    title: 'web.web-maintenance',
    loadComponent: () => import('./web-maintenance/web-maintenance.component').then(m => m.WebMaintenanceComponent)
  },
];

/**
 * Catch-all of the public web - MUST stay after every other route of the application (app.routes.ts
 * places it last): any URL no route knows gets the web 404 inside the web layout (same maintenance
 * guard as the web).
 */
export const WEB_PUBLIC_FALLBACK_ROUTES: Routes = [
  {
    path: '',
    canActivateChild: [webMaintenanceGuard],
    data: { [PUBLIC_AREA_DATA]: WEB_PUBLIC_AREA },
    loadComponent: () => import('./web-layout/web-layout.component').then(m => m.WebLayoutComponent),
    children: [publicNotFoundRoute('web')]
  },
];
