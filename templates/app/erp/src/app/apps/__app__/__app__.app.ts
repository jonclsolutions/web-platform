/**
 * @file __app__.app.ts
 * @path src/app/apps/__app__/__app__.app.ts
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Manifest of the application "__NAME__" - what the core needs to know about it
 *   (apps.registry.ts): name, icon, colour, tab permission, sidebar, admin routes, texts.
 * @note A public part adds `publicArea` (public-area.ts) and `publicRoutes` with its layout.
 * @dependencies AppManifest; its admin route table.
 */

import type { AppManifest } from '../app-manifest';
import { __APP_CONST___ADMIN_ROUTES } from './admin/__app__-admin.routes';

export const __APP_CONST___APP: AppManifest = {
  id: '__app__',
  icon: 'box',
  color: 'amber',
  nameKey: 'module___app__',
  descriptionKey: 'app_description___app_snake__',
  tabPermission: 'view-__app__',
  adminI18n: true,
  nav: [
    {
      key: '__app__-system', labelKey: 'nav_group_system',
      items: [
        { path: 'logs', permission: '__app__-view-logs', labelKey: 'nav___app_snake___logs', icon: 'file-lines' },
      ],
    },
  ],
  adminRoutes: __APP_CONST___ADMIN_ROUTES,
};
