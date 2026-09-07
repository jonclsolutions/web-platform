/**
 * @file web-welcome-page.component.ts
 * @path src/app/admin/web-pages/web-welcome-page/web-welcome-page.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Uvítací/rozcestníková stránka modulu "Web" - vidí ji uživatel s
 * oprávněním `web-welcome-page-view` po přepnutí na modul Web v headeru. Na rozdíl od
 * `core/welcome-page` (osobní profil, role, e-mail) NEOBSAHUJE žádné údaje o
 * přihlášeném uživateli - je to čistě informační rozcestník popisující, co modul Web
 * obsahuje (editace veřejného webu, formuláře/poptávky, obchodní procesy) a rychlé
 * odkazy na jednotlivé stránky sekce. Každá karta je gatovaná stejným permission
 * klíčem, jaký v levém menu používá `AdminLayoutComponent` pro danou položku - takže
 * uživatel vidí jen odkazy na stránky, ke kterým reálně má přístup.
 * @dependencies
 * - HasPermissionDirective: Gatuje viditelnost jednotlivých karet (`*appHasPermission`),
 *   stejný vzor jako menu v AdminLayoutComponent.
 * - AdminLocalizationService: Statické i18n admin UI - ruční injection, komponenta
 *   nedědí BaseDataComponent (samostatná landing page, ne datová CRUD stránka).
 * @note Komponenta nepotřebuje ChangeDetectorRef/markForCheck() - nemá žádný
 * asynchronně měnící se stav (žádné HTTP volání, žádný subscribe), `quickLinks` je
 * statické pole a `strings`/`t()` gettery Angular přehodnotí při běžném change
 * detection cyklu bez nutnosti explicitního triggeru.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/** @description Jeden rychlý odkaz na kartě - `icon` je klíč vykreslený přes @switch v šabloně (sdílené SVG se stejným vizuálním jazykem jako admin-layout menu). */
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
  imports: [CommonModule, RouterModule, HasPermissionDirective],
  templateUrl: './web-welcome-page.component.html',
  styleUrl: './web-welcome-page.component.css',
})
export class WebWelcomePageComponent {
  public readonly i18n = inject(AdminLocalizationService);

  public get strings(): any { return this.i18n.getMergedSection('web-welcome-page'); }

  /**
   * @description Rychlé odkazy na klíčové stránky modulu Web, v pořadí odpovídajícím
   * levému menu (viz admin-layout.component.html, sekce "Obchod"/"Obsah webu"/"Lidé"/
   * "Systém"). Permission klíče jsou 1:1 shodné s těmi v menu.
   */
  readonly quickLinks: QuickLinkCard[] = [
    { icon: 'edit-website', titleKey: 'card_edit_website_title', descKey: 'card_edit_website_desc', route: '/admin/web/edit-website', permission: 'web-edit-website-view' },
    { icon: 'edit-news', titleKey: 'card_edit_news_title', descKey: 'card_edit_news_desc', route: '/admin/web/edit-news', permission: 'web-news-view' },
    { icon: 'user-request', titleKey: 'card_user_request_title', descKey: 'card_user_request_desc', route: '/admin/web/user-request', permission: 'web-user-requests-view' },
    { icon: 'sales-leads', titleKey: 'card_sales_leads_title', descKey: 'card_sales_leads_desc', route: '/admin/web/sales-leads', permission: 'web-sales-leads-view' },
    { icon: 'sales-orders', titleKey: 'card_sales_orders_title', descKey: 'card_sales_orders_desc', route: '/admin/web/sales-orders', permission: 'web-sales-orders-view' },
    { icon: 'projects', titleKey: 'card_projects_title', descKey: 'card_projects_desc', route: '/admin/web/projects', permission: 'web-projects-view' },
    { icon: 'job-applications', titleKey: 'card_job_applications_title', descKey: 'card_job_applications_desc', route: '/admin/web/job-applications', permission: 'web-job-applications-view' },
    { icon: 'support-tickets', titleKey: 'card_support_tickets_title', descKey: 'card_support_tickets_desc', route: '/admin/web/support-tickets', permission: 'web-support-tickets-view' },
    { icon: 'logs', titleKey: 'card_logs_title', descKey: 'card_logs_desc', route: '/admin/web/business-logs', permission: 'web-view-web-logs' },
  ];

  t(key: string): string {
    return this.i18n.getValue(`web-welcome-page.${key}`);
  }
}