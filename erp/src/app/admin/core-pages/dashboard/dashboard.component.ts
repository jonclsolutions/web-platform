/**
 * @file dashboard.component.ts
 * @path src/app/admin/core-pages/dashboard/dashboard.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Central administrative dashboard for the "Core" module - system-wide
 * settings and resources shared across the Web and Shop modules (user accounts, roles &
 * permissions, legal documents, external links, system-level audit logs). Gated behind
 * `core-view-dashboard` permission.
 *
 * @dependencies
 * - BaseDashboardComponent: stat tiles, hero, comparison bars, activity feed, icons, refresh.
 * - HasPermissionDirective: Gates the "Recent system events" section on `view-core`.
 * - PermissionService (inherited): decides which stat / nav / activity requests are sent at all.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import {
  BaseDashboardComponent, DashboardNavSection, DashboardStatDef
} from '../../components/base-dashboard/base-dashboard.component';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

/**
 * @description Serves as the sensitive system-configuration overview for administrators
 * with Core access. Aggregates counts from every resource owned by the Core module and
 * offers one-click navigation into each management screen.
 * @note The loading and rendering logic is shared with the web dashboard
 * (BaseDashboardComponent); every aggregated piece is gated by `PermissionService` /
 * `isSysadmin()`.
 */
@Component({
  selector: 'app-core-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule, HasPermissionDirective, PageHelpComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['../../shared-styles/dashboard.css', '../../shared-styles/dashboard-cards.css', './dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoreDashboardComponent extends BaseDashboardComponent {

  protected override translationSection: string = 'core-dashboard';
  public override t(key: string): string {
    return this.i18n.getValue(`core-dashboard.${key}`);
  }

  protected readonly logsEndpoint = 'core/logs';
  /** Permission key gating the `core/logs` GET in api.php (`CheckPermission` middleware). */
  protected readonly logsPermission = 'view-core';

  /**
   * Stat cards of the dashboard - only the items whose `isAllowed()` returns true are requested.
   */
  protected readonly statDefs: DashboardStatDef[] = [
    {
      key: 'users', labelKey: 'stat_users_label', icon: 'users',
      endpoint: 'core/users?per_page=1',
      isAllowed: () => this.permissionService.hasPermission('core-administrators-view'),
    },
    {
      // core/roles is NOT gated by a permission key - only by the sysadmin check in the controller.
      key: 'roles', labelKey: 'stat_roles_label', icon: 'shield',
      endpoint: 'core/roles?per_page=1',
      isAllowed: () => this.isSysadmin(),
    },
    {
      key: 'legalDocs', labelKey: 'stat_legal_docs_label', icon: 'legal',
      endpoint: 'legal/document-sections?per_page=1',
      isAllowed: () => this.permissionService.hasPermission('core-legal-documents-view'),
    },
    {
      key: 'externalLinks', labelKey: 'stat_external_links_label', icon: 'link',
      endpoint: 'core/external_links?per_page=1',
      isAllowed: () => this.permissionService.hasPermission('core-external-links-view'),
    },
    {
      key: 'coreLogs', labelKey: 'stat_core_logs_label', icon: 'logs',
      endpoint: 'core/logs?per_page=1',
      isAllowed: () => this.permissionService.hasPermission(this.logsPermission),
    },
  ];
  readonly navSections: DashboardNavSection[] = [
    {
      titleKey: 'nav_administrators_title',
      icon: 'users',
      route: '/admin/core/administrators',
      descriptionKey: 'nav_administrators_desc',
      isAllowed: () => this.permissionService.hasPermission('core-administrators-view'),
    },
    {
      titleKey: 'nav_roles_title',
      icon: 'shield',
      route: '/admin/core/edit-roles',
      descriptionKey: 'nav_roles_desc',
      // The core/edit-roles route is protected by sysadminGuard, not by a permission key.
      isAllowed: () => this.isSysadmin(),
    },
    {
      titleKey: 'nav_legal_title',
      icon: 'legal',
      route: '/admin/core/edit-legal',
      descriptionKey: 'nav_legal_desc',
      isAllowed: () => this.permissionService.hasPermission('core-legal-documents-view'),
    },
    {
      titleKey: 'nav_external_links_title',
      icon: 'link',
      route: '/admin/core/external-links',
      descriptionKey: 'nav_external_links_desc',
      isAllowed: () => this.permissionService.hasPermission('core-external-links-view'),
    },
    {
      titleKey: 'nav_logs_title',
      icon: 'logs',
      route: '/admin/core/logs',
      descriptionKey: 'nav_logs_desc',
      isAllowed: () => this.permissionService.hasPermission(this.logsPermission),
    },
    {
      titleKey: 'nav_web_settings_title',
      icon: 'settings',
      route: '/admin/core/web-settings',
      descriptionKey: 'nav_web_settings_desc',
      // WebSettingsComponent calls legal/config/* (SiteConfigurationController).
      isAllowed: () => this.permissionService.hasPermission('core-legal-config-view'),
    },
  ];
  /** @description event_type -> translation key for `eventTypeLabel()`. */
  protected readonly eventTypeLabelKeys: Record<string, string> = {
    login_success: 'ev_label_login_success',
    login_failed: 'ev_label_login_failed',
    logout: 'ev_label_logout',
    password_reset_requested: 'ev_label_password_reset_requested',
    password_reset_completed: 'ev_label_password_reset_completed',
    password_reset_failed: 'ev_label_password_reset_failed',
    password_reset_email_rate_limited: 'ev_label_password_reset_rate_limited',
    create: 'ev_label_create',
    update: 'ev_label_update',
    soft_delete: 'ev_label_soft_delete',
    hard_delete: 'ev_label_hard_delete',
    restore: 'ev_label_restore',
    error: 'ev_label_error',
  };
  /** @description event_type -> CSS badge class (auth events + CRUD). */
  protected readonly eventTypeClassMap: Record<string, string> = {
    login_success: 'ev-create',
    login_failed: 'ev-delete',
    logout: 'ev-update',
    password_reset_requested: 'ev-update',
    password_reset_completed: 'ev-create',
    password_reset_failed: 'ev-delete',
    password_reset_email_rate_limited: 'ev-error',
    create: 'ev-create', update: 'ev-update', soft_delete: 'ev-delete',
    hard_delete: 'ev-delete', restore: 'ev-restore', error: 'ev-error',
  };

  /**
   * @description Whether the signed-in user has the 'sysadmin' role - `core/roles` (and the
   *   `/admin/core/edit-roles` route) are not gated by a permission key, only by the role name.
   * @returns True when the current user's role is 'sysadmin'.
   */
  private isSysadmin(): boolean {
    return this.authService.getUserRole() === 'sysadmin';
  }
}
