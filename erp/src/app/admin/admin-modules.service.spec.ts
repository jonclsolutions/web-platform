/**
 * @file admin-modules.service.spec.ts
 * @path src/app/admin/admin-modules.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AdminModulesService: which pages, sections, modules and applications
 *   the user may open and their landing page (same rule as the AuthGuard).
 * @dependencies src/testing/admin-test-helpers.ts (auth and permission stubs).
 */

import { TestBed } from '@angular/core/testing';

import { AdminModulesService } from './admin-modules.service';
import { AdminTestContext, createAdminTestContext } from '../../testing/admin-test-helpers';
import { navOf } from './admin-navigation.config';
import { APPS } from '../apps/apps.registry';
import { requiresApps } from '../../testing/requires-apps';

describe('AdminModulesService', () => {
  let ctx: AdminTestContext;
  let service: AdminModulesService;

  beforeEach(() => {
    ctx = createAdminTestContext({ granted: [] });
    TestBed.configureTestingModule({ providers: ctx.providers });
    service = TestBed.inject(AdminModulesService);
  });

  /**
   * @description A page needs one of its keys ("a|b"); a page without a permission is open to
   *   everybody; a role-only page to the sysadmin only.
   * @input core-legal-config-view; the edit-legal, calendar and edit-roles pages; then sysadmin.
   * @output edit-legal true, calendar true, edit-roles false; sysadmin: edit-roles true.
   */
  it('decides which pages the user may open', () => {
    ctx.permissions.granted = new Set(['core-legal-config-view']);
    const core = navOf('core').flatMap(group => group.items);
    const page = (path: string) => core.find(item => item.path === path)!;
    expect(service.canOpen(page('edit-legal'))).toBeTrue();
    expect(service.canOpen(page('calendar'))).toBeTrue();
    expect(service.canOpen(page('edit-roles'))).toBeFalse();
    expect(service.hasAnyPermission(['x|core-legal-config-view'])).toBeTrue();
    ctx.auth.session.role = 'sysadmin';
    expect(service.canOpen(page('edit-roles'))).toBeTrue();
  });

  /**
   * @description A module is available with its tab permission and a page; the landing page is
   *   the first page of the sidebar the user may open; the applications follow the same rule.
   * @input view-project-portal + project-portal-view-logs; then + web-projects-view; then
   *   view-web without a web page; sysadmin.
   * @output project portal available, landing /admin/project-portal/logs, then …/projects; web
   *   not available; availableApps ['project-portal']; sysadmin: every installed application,
   *   unknown module false. Needs the web and the project portal (requiresApps).
   */
  it('decides which modules and applications the user may open', () => {
    requiresApps('web', 'project-portal');
    ctx.permissions.granted = new Set(['view-project-portal', 'project-portal-view-logs', 'view-web']);
    expect(service.isAvailable('project-portal')).toBeTrue();
    expect(service.landingUrl('project-portal')).toBe('/admin/project-portal/logs');
    expect(service.isAvailable('web')).toBeFalse();
    expect(service.landingUrl('web')).toBeNull();
    expect(service.availableApps().map(app => app.id)).toEqual(['project-portal']);

    ctx.permissions.granted = new Set(['view-project-portal', 'project-portal-view-logs', 'web-projects-view']);
    expect(service.landingUrl('project-portal')).toBe('/admin/project-portal/projects');
    expect(service.isGroupVisible(navOf('project-portal').find(group => group.key === 'project-portal-projects')!)).toBeTrue();
    expect(service.isGroupVisible(navOf('project-portal').find(group => group.key === 'project-portal-business')!)).toBeFalse();

    ctx.permissions.granted = new Set();
    ctx.auth.session.role = 'sysadmin';
    expect(service.availableApps().map(app => app.id)).toEqual(APPS.map(app => app.id));
    expect(service.isAvailable('nope')).toBeFalse();
  });
});
