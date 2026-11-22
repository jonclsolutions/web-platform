/**
 * @file js-creator-admin.routes.ts
 * @path src/app/apps/js-creator/admin/js-creator-admin.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Admin pages of the application "JS Creator", below `/admin/js-creator/` (inside
 *   AdminLayoutComponent, AuthGuard checks `data.permission` of every page). Each page is loaded
 *   on its first visit; every page has its manual page (`data.help`) and a sidebar item.
 * @usage `adminRoutes` of JS_CREATOR_APP; `help` = id of a page of the internal manual
 *   (api/app/Apps/JsCreator/Resources/knowledge-base).
 * @note Page paths have no slash (`image-templates`; videos later `video-templates`), sub-pages
 *   start with the path of their page (`image-templates/:id/edit`).
 *   The pages shared by the sections (outputs, library) are open with the view permission of
 *   any section - written out as `js-creator-images-view` (later `…|js-creator-videos-view`), the
 *   same expression as anySectionPermission('view') and as their manual pages. The pages of a
 *   section (`image-…`) need the view permission of the section; the editor saves only with its
 *   update permission and asks before leaving unsaved changes (unsavedTemplateGuard).
 */

import { Routes } from '@angular/router';
import { JS_CREATOR_AUDIT_LOG } from './js-creator-logs.config';
import { unsavedTemplateGuard } from './images/editor/unsaved-template.guard';

export const JS_CREATOR_ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'image-templates', pathMatch: 'full' },
  { path: 'image-templates', loadComponent: () => import('./images/templates/templates-page.component').then(m => m.TemplatesPageComponent), data: { help: 'js-creator-templates', permission: 'js-creator-images-view' } },
  { path: 'image-templates/:id/edit', loadComponent: () => import('./images/editor/template-editor.component').then(m => m.TemplateEditorComponent), canDeactivate: [unsavedTemplateGuard], data: { help: 'js-creator-editor', permission: 'js-creator-images-view' } },
  { path: 'outputs', loadComponent: () => import('./outputs/outputs-page.component').then(m => m.OutputsPageComponent), data: { help: 'js-creator-outputs', permission: 'js-creator-images-view' } },
  { path: 'library', loadComponent: () => import('./library/library-page.component').then(m => m.LibraryPageComponent), data: { help: 'js-creator-library', permission: 'js-creator-images-view' } },
  { path: 'settings', loadComponent: () => import('./settings/creator-settings.component').then(m => m.CreatorSettingsComponent), data: { help: 'js-creator-settings', permission: 'js-creator-settings-view' } },
  { path: 'logs', loadComponent: () => import('../../../admin/components/audit-log-page/audit-log-page.component').then(m => m.AuditLogPageComponent), data: { help: 'js-creator-logs', permission: 'js-creator-view-logs', auditLog: JS_CREATOR_AUDIT_LOG } },
];
