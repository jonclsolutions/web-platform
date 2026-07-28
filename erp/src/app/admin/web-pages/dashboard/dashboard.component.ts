/**
 * @file dashboard.component.ts
 * @path src/app/admin/web-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Central administrative dashboard component providing sensitive system metrics,
 * recent activity, and navigation shortcuts. Gated behind `web-view-dashboard` permission.
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
 * @description Serves as the sensitive metrics/overview page for administrators with
 * dashboard access. Not the post-login landing page anymore - see WelcomePageComponent.
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
      title: 'E-shop',
      icon: 'cart',
      route: '/admin/shop/orders',
      description: 'Objednávky, produkty, zákazníci, kupóny',
      color: 'indigo',
    },
    {
      title: 'Uživatelé',
      icon: 'users',
      route: '/admin/core/users',
      description: 'Správa uživatelských účtů a rolí',
      color: 'sky',
    },
    {
      title: 'Web — Logy',
      icon: 'logs',
      route: '/admin/web/logs',
      description: 'Záznamy o aktivitách na webu',
      color: 'slate',
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
      color: 'green',
    },
    {
      title: 'Obchodní leady',
      icon: 'briefcase',
      route: '/admin/web/sales-leads',
      description: 'Pipeline obchodních příležitostí',
      color: 'rose',
    },
  ];

  /**
   * Knihovna ikon použitých na dashboardu - klíč odpovídá hodnotě `icon` v
   * `QuickStat`/`NavSection`. Bez `viewBox` (viz @icons-note výše), velikost
   * na obrazovce řídí CSS (`.cd-stat-icon svg`, `.cd-nav-icon svg`).
   */
  private readonly ICONS: Record<string, string> = {
    cart: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    users: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    logs: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>`,
    ticket: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 1 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
    file: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    briefcase: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    newspaper: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`,
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
   * @description Aggregates statistical data from multiple system modules concurrently using
   * forkJoin.
   * @note If an individual request fails, it defaults to null to ensure the rest of the dashboard
   * remains functional. `getPaginatedCollection` je zvolený záměrně (ne `getCollection`), protože
   * potřebujeme zachovat `.total` z odpovědi, ne jen odbalené pole záznamů.
   */
  private loadStats(): void {
    this.loadingStats = true;

    forkJoin({
      users:        this.dataHandler.getPaginatedCollection<any>('core/users?per_page=1').pipe(catchError(() => of(null))),
      webLogs:      this.dataHandler.getPaginatedCollection<any>('web/logs?per_page=1').pipe(catchError(() => of(null))),
      tickets:      this.dataHandler.getPaginatedCollection<any>('web/support_tickets?per_page=1').pipe(catchError(() => of(null))),
      openTickets:  this.dataHandler.getPaginatedCollection<any>('web/support_tickets?status=open&per_page=1').pipe(catchError(() => of(null))),
      jobApps:      this.dataHandler.getPaginatedCollection<any>('web/job_applications?per_page=1').pipe(catchError(() => of(null))),
      leads:        this.dataHandler.getPaginatedCollection<any>('web/sales_leads?per_page=1').pipe(catchError(() => of(null))),
      news:         this.dataHandler.getPaginatedCollection<any>('web/news?per_page=1').pipe(catchError(() => of(null))),
    }).subscribe({
      next: (res) => {
        this.quickStats = [
          { label: 'Uživatelé systému', value: res.users?.total ?? '—', icon: 'users', color: 'sky' },
          {
            label: 'Otevřené tickety',
            value: res.openTickets?.total ?? '—',
            icon: 'ticket',
            color: res.openTickets?.total > 0 ? 'amber' : 'green'
          },
          { label: 'Uchazeči', value: res.jobApps?.total ?? '—', icon: 'file', color: 'green' },
          { label: 'Obchodní leady', value: res.leads?.total ?? '—', icon: 'briefcase', color: 'indigo' },
          { label: 'Novinky na webu', value: res.news?.total ?? '—', icon: 'newspaper', color: 'rose' },
          { label: 'Záznamy v logu', value: res.webLogs?.total ?? '—', icon: 'logs', color: 'slate' },
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
   * @description Fetches the latest system events for the activity feed.
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