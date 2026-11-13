/**
 * @file web-welcome-page.component.ts
 * @path src/app/apps/web/admin/web-welcome-page/web-welcome-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Welcome / landing page of the "Web" module - seen by a user with the
 * `web-welcome-page-view` permission after switching to the Web module in the header. Unlike
 * `core/welcome-page` (personal profile, role, e-mail) it holds NO data of the logged-in user -
 * it is an informational landing page describing the Web module (editing the public web,
 * forms / inquiries, business processes) with quick links to its pages. Every card is gated by
 * the same permission key as the matching item of the left menu of `AdminLayoutComponent`, so
 * the user sees only links to pages they can open.
 * @dependencies
 * - HasPermissionDirective: Gates the visibility of the cards (`*appHasPermission`), same
 *   pattern as the menu of AdminLayoutComponent.
 * - AdminLocalizationService: Static i18n of the admin UI - manual injection, the component
 *   does not extend BaseDataComponent (a landing page, not a CRUD data page).
 * @note No ChangeDetectorRef / markForCheck() needed - no asynchronously changing state (no
 * HTTP call, no subscribe), `quickLinks` is a static array and Angular re-evaluates the
 * `strings` / `t()` getters in the ordinary change detection cycle.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { PageHelpComponent } from '../../../../admin/components/page-help/page-help.component';

/** @description One quick link of a card - `icon` is a key rendered through @switch in the template (shared SVGs in the same visual language as the admin-layout menu). */
interface QuickLinkCard {
  icon: string;
  titleKey: string;
  descKey: string;
  route: string;
  permission: string;
}

@Component({
  selector: 'app-web-welcome-page',
  standalone: true,
  imports: [CommonModule, RouterModule, HasPermissionDirective, PageHelpComponent],
  templateUrl: './web-welcome-page.component.html',
  styleUrls: ['../../../../admin/shared-styles/welcome-page.css', '../../../../admin/shared-styles/welcome-links.css'],
})
export class WebWelcomePageComponent {
  public readonly i18n = inject(AdminLocalizationService);

  public get strings(): any { return this.i18n.getMergedSection('web-welcome-page'); }

  /**
   * @description Quick links to the key pages of the Web module, in the order of the left menu
   * (`nav` of WEB_APP, web.app.ts). The permission keys match the menu 1:1.
   */
  readonly quickLinks: QuickLinkCard[] = [
    { icon: 'edit-website', titleKey: 'card_edit_website_title', descKey: 'card_edit_website_desc', route: '/admin/web/edit-website', permission: 'web-edit-website-view' },
    { icon: 'user-request', titleKey: 'card_user_request_title', descKey: 'card_user_request_desc', route: '/admin/web/user-request', permission: 'web-user-requests-view' },
    { icon: 'sales-leads', titleKey: 'card_sales_leads_title', descKey: 'card_sales_leads_desc', route: '/admin/web/sales-leads', permission: 'web-sales-leads-view' },
    { icon: 'sales-orders', titleKey: 'card_sales_orders_title', descKey: 'card_sales_orders_desc', route: '/admin/web/sales-orders', permission: 'web-sales-orders-view' },
    { icon: 'job-applications', titleKey: 'card_job_applications_title', descKey: 'card_job_applications_desc', route: '/admin/web/job-applications', permission: 'web-job-applications-view' },
    { icon: 'logs', titleKey: 'card_logs_title', descKey: 'card_logs_desc', route: '/admin/web/business-logs', permission: 'web-view-web-logs' },
  ];

  t(key: string): string {
    return this.i18n.getValue(`web-welcome-page.${key}`);
  }
}