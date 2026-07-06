/**
 * @file has-permission.directive.ts
 * @path src/app/shared/directives/has-permission.directive.ts
 * @project RegioPartner Web
 * @author RPSW
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
 * @note The directive interacts directly with the ViewContainerRef to manage template instantiation.
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  /**
   * @description Setter for the structural directive input.
   * @param permission The required permission string to be checked.
   * @note If the permission is granted, an embedded view is created; otherwise, the container is cleared to prevent unauthorized UI exposure.
   */
  @Input() set appHasPermission(permission: string) {
    if (this.permissionService.hasPermission(permission)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }
}