/**
 * @file has-permission.directive.ts
 * @path src/app/core/directives/has-permission.directive.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Structural directive for conditional rendering of DOM elements based on user permissions.
 * @dependencies
 * - PermissionService: Provides logic to verify if the current user possesses the required authorization.
 */

import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionService } from '../auth/services/permission.service';

/**
 * @description A structural directive that adds or removes an element from the DOM based on a permission string.
 * @usage Used in templates to hide/show UI elements (e.g., buttons, menu items) for authorized users only.
 * Supports several keys separated by `|` (OR) - `*appHasPermission="'key1|key2'"` renders the
 * element when the user has ANY of them.
 * @note The directive interacts directly with the ViewContainerRef to manage template instantiation.
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  /** Whether the content is currently rendered. */
  private hasView = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  /**
   * @description Shows the content when the user has at least one of the permissions
   *   ('a|b' = OR, spaces around keys ignored - same as AuthGuard).
   * @param permission Permission key(s).
   */
  @Input() set appHasPermission(permission: string) {
    const hasAny = permission.split('|').some(p => this.permissionService.hasPermission(p.trim()));

    if (hasAny && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasAny && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
