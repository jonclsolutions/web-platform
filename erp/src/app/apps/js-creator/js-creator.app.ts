/**
 * @file js-creator.app.ts
 * @path src/app/apps/js-creator/js-creator.app.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the application "JS Creator" - posts for social networks generated
 *   from own templates (no AI, admin only, no public part). Every account has its own private
 *   workspace. The sidebar: the shared files of the workspace (outputs, library) and the system
 *   pages; the sections (images now, videos / GIFs later) add their own groups.
 * @dependencies AppManifest; its admin route table.
 */

import type { AppManifest } from '../app-manifest';
import { JS_CREATOR_ADMIN_ROUTES } from './admin/js-creator-admin.routes';

export const JS_CREATOR_APP: AppManifest = {
  id: 'js-creator',
  icon: 'image',
  color: 'amber',
  nameKey: 'module_js-creator',
  descriptionKey: 'app_description_js_creator',
  tabPermission: 'view-js-creator',
  adminI18n: true,
  nav: [
    {
      key: 'js-creator-files', labelKey: 'nav_group_js_creator_files',
      items: [
        { path: 'outputs', permission: 'js-creator-images-view', labelKey: 'nav_js_creator_outputs', icon: 'folder' },
        { path: 'library', permission: 'js-creator-images-view', labelKey: 'nav_js_creator_library', icon: 'image' },
      ],
    },
    {
      key: 'js-creator-system', labelKey: 'nav_group_system',
      items: [
        { path: 'settings', permission: 'js-creator-settings-view', labelKey: 'nav_js_creator_settings', icon: 'settings' },
        { path: 'logs', permission: 'js-creator-view-logs', labelKey: 'nav_js_creator_logs', icon: 'file-lines' },
      ],
    },
  ],
  adminRoutes: JS_CREATOR_ADMIN_ROUTES,
};
