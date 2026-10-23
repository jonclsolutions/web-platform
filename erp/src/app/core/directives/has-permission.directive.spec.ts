/**
 * @file has-permission.directive.spec.ts
 * @path src/app/core/directives/has-permission.directive.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of HasPermissionDirective: renders the content for a granted key
 *   (any of 'a|b'), removes it when the key changes to a denied one and never renders it twice.
 * @dependencies
 * - Host test component, PermissionService stub (createPermissionStub).
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HasPermissionDirective } from './has-permission.directive';
import { PermissionService } from '../auth/services/permission.service';
import { createPermissionStub } from '../../../testing/admin-test-helpers';

/** Host with one guarded element. */
@Component({
  standalone: true,
  imports: [HasPermissionDirective],
  template: `<span class="guarded" *appHasPermission="permission">secret</span>`
})
class HostComponent {
  permission = 'a';
}

describe('HasPermissionDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  const count = () => fixture.nativeElement.querySelectorAll('.guarded').length;

  /**
   * @description Shows / hides on changes; a second granted value (also with spaces around
   *   '|') keeps exactly one copy (bugfix 2026-10-23).
   * @input 'a' (granted); 'b | a'; 'c' (denied); 'a'.
   * @output 1; 1 (not 2); 0; 1.
   */
  it('renders the content once per granted state', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: PermissionService, useValue: createPermissionStub(['a']) }]
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(count()).toBe(1);

    fixture.componentInstance.permission = 'b | a';
    fixture.detectChanges();
    expect(count()).toBe(1);

    fixture.componentInstance.permission = 'c';
    fixture.detectChanges();
    expect(count()).toBe(0);

    fixture.componentInstance.permission = 'a';
    fixture.detectChanges();
    expect(count()).toBe(1);
  });
});
