/**
 * @file permission.service.spec.ts
 * @path src/app/core/auth/services/permission.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PermissionService: never restored from localStorage (finding #38),
 *   set / check / clear of the permission list.
 * @dependencies
 * - Real localStorage (key 'userPermissions' cleared around every test).
 */

import { TestBed } from '@angular/core/testing';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  beforeEach(() => localStorage.removeItem('userPermissions'));
  afterEach(() => localStorage.removeItem('userPermissions'));

  /**
   * @description A permission list in localStorage grants nothing - the list comes only from
   *   AuthService (finding #38).
   * @input localStorage userPermissions '["a","b"]'; new service.
   * @output hasPermission('a') false.
   */
  it('ignores permissions in localStorage', () => {
    localStorage.setItem('userPermissions', '["a","b"]');
    expect(new PermissionService().hasPermission('a')).toBeFalse();
  });

  /**
   * @description set / has / clear; null is treated as an empty list.
   * @input setPermissions(['x']); clearPermissions(); setPermissions(null).
   * @output x granted, y not; nothing after clear; nothing after null.
   */
  it('sets, checks and clears permissions', () => {
    const service = TestBed.inject(PermissionService);
    expect(service.hasPermission('x')).toBeFalse();
    service.setPermissions(['x']);
    expect(service.hasPermission('x')).toBeTrue();
    expect(service.hasPermission('y')).toBeFalse();
    service.clearPermissions();
    expect(service.hasPermission('x')).toBeFalse();
    service.setPermissions(null as any);
    expect(service.hasPermission('x')).toBeFalse();
  });
});
