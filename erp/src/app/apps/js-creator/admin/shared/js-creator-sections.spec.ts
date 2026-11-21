/**
 * @file js-creator-sections.spec.ts
 * @path src/app/apps/js-creator/admin/shared/js-creator-sections.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the permission helpers of the sections of JS Creator.
 * @dependencies src/testing/admin-test-helpers.ts (permission stub).
 */

import { anySectionPermission, can, sectionPermission } from './js-creator-sections';
import { createPermissionStub } from '../../../../../testing/admin-test-helpers';
import { PermissionService } from '../../../../core/auth/services/permission.service';

describe('js-creator-sections', () => {
  /**
   * @description Keys of a section action and of "any section".
   * @input images + view; action create
   * @output 'js-creator-images-view'; 'js-creator-images-create'
   */
  it('builds the permission keys', () => {
    expect(sectionPermission('images', 'view')).toBe('js-creator-images-view');
    expect(anySectionPermission('create')).toBe('js-creator-images-create');
  });

  /**
   * @description can() is true with the action in a section, false without it.
   * @input account with js-creator-images-view only
   * @output view true, delete false
   */
  it('checks an action in any section', () => {
    const permissions = createPermissionStub(['js-creator-images-view']) as unknown as PermissionService;
    expect(can(permissions, 'view')).toBeTrue();
    expect(can(permissions, 'delete')).toBeFalse();
  });
});
