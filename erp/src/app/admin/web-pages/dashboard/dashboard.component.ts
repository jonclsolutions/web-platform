/**
 * @file dashboard.component.ts
 * @path src/app/admin/web-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Central administrative dashboard component providing website-content
 * metrics, recent activity, and navigation shortcuts. Gated behind `web-view-dashboard`
 * permission.
 *
 * @refactor-note (2026) Profil uživatele, uvítací hlavička a "vytvořen účet" byly přesunuty
 * na novou WelcomePageComponent (`/admin/welcome-page`), kterou vidí každý přihlášený uživatel
 * s oprávněním `web-view-welcome-page` - tahle stránka teď obsahuje výhradně citlivé/agregační
 * přehledy (počty uživatelů, tickety, systémové logy, rychlé odkazy do modulů), které mají
 * vidět jen uživatelé s `web-view-dashboard`. Odstraněno vše, co s profilem souviselo
 * (getItemDetails/profil, e-mail subscription, welcomeMessage) - `BaseDataComponent` tu
 * zůstává jen kvůli `errorMessage`/`cd`/`alertDialogService` a jednotnému vzoru, i když
 * `apiEndpoint` se teď prakticky nevyužívá (agregace jede přes `dataHandler` napřímo).
 *
 * @refactor-note (2026-08) Core/Web split: přehledy sdílené napříč Web a Shop (uživatelé,
 * role, právní dokumenty, systémové logy) byly přesunuty na nový `CoreDashboardComponent`
 * (`core-pages/dashboard`). Tento dashboard teď obsahuje výhradně metriky a navigaci pro
 * obsah a provoz webové prezentace - doplněny chybějící moduly `edit-website`,
 * `sales-orders` a `user-request`, které v `web-pages` existují, ale dřív na dashboardu
 * chyběly.
 *
 * @icons-note (2026) `quickStats`/`navSections` teď v poli `icon` nenesou emoji, ale klíč
 *      do `ICONS` mapy (viz `getIcon()`) - šablona ho vykresluje jako inline SVG přes
 *      `[innerHTML]`. Ikony jsou záměrně bez `viewBox` a s `width="24" height="24"`
 *      (přesně dle souřadnic cest) - zmenšení na výslednou velikost řeší CSS
 *      (`.cd-stat-icon svg`/`.cd-nav-icon svg`), protože `[innerHTML]` na SVG vloženém
 *      do běžného HTML elementu prochází HTML parserem, který by atribut `viewBox`
 *      přepsal na malé `viewbox` (SVG ho pak ignoruje) - tomuhle se tak vyhneme úplně.
 *
 * @dependencies
 * - BaseDataComponent: Poskytuje errorMessage/cd/alertDialogService (žádné CRUD tu není potřeba).
 * - LoadingService: Manages global loading states.
 * - DataHandler: Facilitates API communication for dashboard aggregation endpoints.
 * - RxJS: Handles asynchronous data aggregation using forkJoin.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin, catchError, of } from 'rxjs';

import * as Core from '../../../shared/imports/core-providers';
import { UserLogin } from '../../../shared/interfaces/user';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { LoadingService } from '../../../core/services/loading.service';
import { ActivityLog, QuickStat, NavSection } from './';

/**
 * @description Serves as the website-content overview page for administrators with
 * dashboard access. Not the post-login landing page anymore - see WelcomePageComponent.
 * System-wide/cross-module metrics (users, roles, legal, system logs) live on
 * `CoreDashboardComponent` instead.
 * @note Implements component-level data aggregation from multiple API endpoints to populate the
 * dashboard view.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent extends BaseDataComponent<UserLogin> implements Core.OnInit {

  public override loadingService = inject(LoadingService);
  private sanitizer = inject(DomSanitizer);

  override apiEndpoint = 'core/users';

  quickStats: QuickStat[] = [];
  loadingStats = true;

  recentActivity: ActivityLog[] = [];
  loadingActivity = true;

  readonly navSections: NavSection[] = [
    {
      title: 'Novinky',
      icon: 'newspaper',
      route: '/admin/web/edit-news',
      description: 'Aktuality a oznámení publikovaná na webu',
      color: 'rose',
    },
    {
      title: 'Obsah webu',
      icon: 'globe',
      route: '/admin/web/edit-website',
      description: 'Texty a obsah veřejných stránek',
      color: 'sky',
    },
    {
      title: 'Poptávky',
      icon: 'mail',
      route: '/admin/web/user-request',
      description: 'Poptávkový formulář z webu',
      color: 'amber',
    },
    {
      title: 'Nabídky a objednávky',
      icon: 'inbox',
      route: '/admin/web/sales-orders',
      description: 'Zpracované obchodní objednávky',
      color: 'indigo',
    },
    {
      title: 'Obchodní leady',
      icon: 'briefcase',
      route: '/admin/web/sales-leads',
      description: 'Pipeline obchodních příležitostí',
      color: 'green',
    },
    {
      title: 'Support tickety',
      icon: 'ticket',
      route: '/admin/web/support-tickets',
      description: 'Přijaté požadavky na podporu',
      color: 'amber',
    },
    {
      title: 'Uchazeči',
      icon: 'file',
      route: '/admin/web/job-applications',
      description: 'Reakce na pracovní pozice',
      color: 'slate',
    },
    {
      title: 'Business logy',
      icon: 'logs',
      route: '/admin/web/business-logs',
      description: 'Záznamy o aktivitách na webu',
      color: 'rose',
    },
  ];

  /**
   * Knihovna ikon použitých na dashboardu - klíč odpovídá hodnotě `icon` v
   * `QuickStat`/`NavSection`. Bez `viewBox` (viz @icons-note výše), velikost
   * na obrazovce řídí CSS (`.cd-stat-icon svg`, `.cd-nav-icon svg`).
   */
  private readonly ICONS: Record<string, string> = {
    logs: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>`,
    ticket: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 1 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
    file: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    briefcase: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    newspaper: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`,
    globe: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    mail: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    inbox: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  };

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadStats();
    this.loadRecentActivity();
  }

  /**
   * @description Vrátí bezpečně vysanitizovanou SVG značku pro zadaný klíč ikony
   *              (viz `ICONS`), pro vykreslení přes `[innerHTML]` v šabloně.
   */
  getIcon(key: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.ICONS[key] ?? '');
  }

  /**
   * @description Aggregates statistical data from every website-content module
   * concurrently using forkJoin.
   * @note If an individual request fails, it defaults to null to ensure the rest of the
   * dashboard remains functional. `getPaginatedCollection` je zvolený záměrně (ne
   * `getCollection`), protože potřebujeme zachovat `.total` z odpovědi, ne jen odbalené
   * pole záznamů.
   * @assumption Endpoint `web/raw_request_commissions` je odvozený z názvu tabulky
   * `web_raw_request_commissions` (`WebRawRequestCommissionController`) - over si přesný
   * název route.
   */
  private loadStats(): void {
    this.loadingStats = true;

    forkJoin({
      news:          this.dataHandler.getPaginatedCollection<any>('web/news?per_page=1').pipe(catchError(() => of(null))),
      openTickets:   this.dataHandler.getPaginatedCollection<any>('web/support_tickets?status=open&per_page=1').pipe(catchError(() => of(null))),
      jobApps:       this.dataHandler.getPaginatedCollection<any>('web/job_applications?per_page=1').pipe(catchError(() => of(null))),
      leads:         this.dataHandler.getPaginatedCollection<any>('web/sales_leads?per_page=1').pipe(catchError(() => of(null))),
      salesOrders:   this.dataHandler.getPaginatedCollection<any>('web/sales_orders?per_page=1').pipe(catchError(() => of(null))),
      rawRequests:   this.dataHandler.getPaginatedCollection<any>('web/raw_request_commissions?per_page=1').pipe(catchError(() => of(null))),
      webLogs:       this.dataHandler.getPaginatedCollection<any>('web/logs?per_page=1').pipe(catchError(() => of(null))),
    }).subscribe({
      next: (res) => {
        this.quickStats = [
          { label: 'Novinky na webu', value: res.news?.total ?? '—', icon: 'newspaper', color: 'rose' },
          {
            label: 'Otevřené tickety',
            value: res.openTickets?.total ?? '—',
            icon: 'ticket',
            color: res.openTickets?.total > 0 ? 'amber' : 'green'
          },
          { label: 'Uchazeči', value: res.jobApps?.total ?? '—', icon: 'file', color: 'slate' },
          { label: 'Obchodní leady', value: res.leads?.total ?? '—', icon: 'briefcase', color: 'green' },
          { label: 'Nabídky a objednávky', value: res.salesOrders?.total ?? '—', icon: 'inbox', color: 'indigo' },
          { label: 'Poptávky', value: res.rawRequests?.total ?? '—', icon: 'mail', color: 'amber' },
          { label: 'Záznamy v logu', value: res.webLogs?.total ?? '—', icon: 'logs', color: 'sky' },
        ];
        this.loadingStats = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.loadingStats = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Fetches the latest business-level events for the activity feed
   * (content changes, CRUD actions on web-owned resources).
   */
  private loadRecentActivity(): void {
    this.loadingActivity = true;
    this.dataHandler.getPaginatedCollection<any>('web/logs?per_page=8&sort_by=created_at&sort_direction=desc')
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: (res) => {
          this.recentActivity = Array.isArray(res) ? res : (res?.data ?? []);
          this.loadingActivity = false;
          this.cd.markForCheck();
        },
        error: () => {
          this.loadingActivity = false;
          this.cd.markForCheck();
        }
      });
  }

  /**
   * @description Formats current system date for display in the dashboard header.
   */
  get currentDateTime(): string {
    return new Date().toLocaleDateString('cs-CZ', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('cs-CZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  eventTypeLabel(type: string): string {
    const map: Record<string, string> = {
      create: 'Vytvoření', update: 'Úprava', soft_delete: 'Smazání',
      hard_delete: 'Trvalé smazání', restore: 'Obnova',
      export: 'Export', error: 'Chyba', payment: 'Platba',
    };
    return map[type] ?? type;
  }

  eventTypeClass(type: string): string {
    const map: Record<string, string> = {
      create: 'ev-create', update: 'ev-update', soft_delete: 'ev-delete',
      hard_delete: 'ev-delete', restore: 'ev-restore',
      export: 'ev-export', error: 'ev-error', payment: 'ev-create',
    };
    return map[type] ?? 'ev-default';
  }
}