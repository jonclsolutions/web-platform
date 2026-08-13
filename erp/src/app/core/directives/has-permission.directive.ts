/**
 * @file has-permission.directive.ts
 * @path src/app/core/directives/has-permission.directive.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Structural directive for conditional rendering of DOM elements based on user permissions.
 * @dependencies
 * - PermissionService: Provides logic to verify if the current user possesses the required authorization.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php, admin-routing.module.ts
 *      a admin-layout.component.html stejné datum): direktiva nyní podporuje víc klíčů
 *      oddělených `|` (logika OR - stačí mít KTERÝKOLIV z nich), stejně jako backend
 *      `CheckPermission` middleware (`permission:klic1|klic2` na routách). Potřeba např. pro
 *      `core-legal-documents-view|core-legal-config-view` na položce "GDPR / TOS / COOKIES"
 *      v menu, protože stránka kombinuje dva zdroje, které dřív sdílely jeden permission klíč
 *      a nově mají každý svůj. Split probíhá čistě v direktivě - `PermissionService.hasPermission()`
 *      beze změny, pořád bere a vyhodnocuje jeden klíč.
 */

import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionService } from '../auth/services/permission.service';

/**
 * @description A structural directive that adds or removes an element from the DOM based on a permission string.
 * @usage Used in templates to hide/show UI elements (e.g., buttons, menu items) for authorized users only.
 * Podporuje i víc klíčů oddělených `|` (OR) - `*appHasPermission="'klic1|klic2'"` propustí
 * element, pokud má uživatel KTERÝKOLIV z nich.
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
   * @param permission Jeden permission klíč, nebo víc klíčů oddělených `|` (OR - stačí mít
   * kterýkoliv z nich). Stejná syntaxe jako `permission:klic1|klic2` middleware na backendu.
   * @note If any of the given permissions is granted, an embedded view is created; otherwise,
   * the container is cleared to prevent unauthorized UI exposure.
   */
  @Input() set appHasPermission(permission: string) {
const requiredPermissions = permission.split('|');
const hasAny = requiredPermissions.some(p => this.permissionService.hasPermission(p));

if (hasAny) {
this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
this.viewContainer.clear();
    }
  }
}