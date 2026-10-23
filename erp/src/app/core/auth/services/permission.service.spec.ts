/**
 * @file permission.service.spec.ts
 * @path src/app/core/auth/services/permission.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PermissionService: restore from localStorage (valid / broken JSON),
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
   * @description Permissions saved in localStorage are restored on creation; broken JSON is
   *   logged and ignored.
   * @input '["a","b"]'; then '{broken'.
   * @output hasPermission('a') true; with broken JSON nothing granted + console.error.
   */
  it('restores saved permissions and ignores broken JSON', () => {
    localStorage.setItem('userPermissions', '["a","b"]');
    expect(new PermissionService().hasPermission('a')).toBeTrue();

    spyOn(console, 'error');
    localStorage.setItem('userPermissions', '{broken');
    expect(new PermissionService().hasPermission('a')).toBeFalse();
    expect(console.error).toHaveBeenCalled();
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
