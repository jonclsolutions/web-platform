/**
 * @file dashboard.component.ts
 * @path src/app/admin/web-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Central administrative dashboard component providing a high-level overview of
 * system metrics, recent activities, and navigation shortcuts.
 *
 * @refactor-note (2025) Dříve volal `HttpClient` přímo pro agregační dotazy (loadStats,
 * loadRecentActivity) vedle `BaseDataComponent`, který už `DataHandler` sám injektuje pro
 * `getItemDetails()`. Teď se pro všechny requesty používá jednotně `this.dataHandler`
 * (`getPaginatedCollection`, aby zůstal zachovaný `.total` z odpovědi) — komponenta už
 * vůbec nepotřebuje znát `HttpClient` ani ruční `/api` prefix.
 *
 * Zároveň opraveno: `ngOnDestroy` dřív nevolal `super.ngOnDestroy()`, takže `destroy$`
 * z `BaseDataComponent` se nikdy nedokončil a `crud`/`list` instance uvnitř base třídy by
 * si nikdy neuklidily své subscriptions.
 *
 * @dependencies
 * - BaseDataComponent: Inherited base class for state management and API access (deleguje na
 *   EntityCrudService / PaginatedListStore).
 * - LoadingService: Manages global loading states.
 * - DataHandler: Facilitates API communication for dashboard aggregation endpoints.
 * - RxJS: Handles asynchronous data aggregation using forkJoin.
 */

import { Component, ChangeDetectionStrategy, inject, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';

import * as Core from '../../../shared/imports/core-providers';
import { UserLogin } from '../../../shared/interfaces/user';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { LoadingService } from '../../../core/services/loading.service';
import { ActivityLog, QuickStat, NavSection } from './';

/**
 * @description Serves as the primary landing page for authenticated administrators.
 * @usage Provides immediate access to administrative sections and visualizes key performance
 * indicators (KPIs).
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
export class DashboardComponent extends BaseDataComponent<UserLogin> implements Core.OnInit, OnDestroy {

  public override loadingService = inject(LoadingService);

  override apiEndpoint = 'core/users';

  userData: UserLogin | null = null;
  userEmail: string | null = null;
  userRole: string | null = null;

  quickStats: QuickStat[] = [];
  loadingStats = true;

  recentActivity: ActivityLog[] = [];
  loadingActivity = true;

  readonly navSections: NavSection[] = [
    {
      title: 'E-shop',
      icon: '🛒',
      route: '/admin/shop/orders',
      description: 'Objednávky, produkty, zákazníci, kupóny',
      color: 'indigo',
    },
    {
      title: 'Uživatelé',
      icon: '👤',
      route: '/admin/core/users',
      description: 'Správa uživatelských účtů a rolí',
      color: 'sky',
    },
    {
      title: 'Web — Logy',
      icon: '📋',
      route: '/admin/web/logs',
      description: 'Záznamy o aktivitách na webu',
      color: 'slate',
    },
    {
      title: 'Support tickety',
      icon: '🎫',
      route: '/admin/web/support-tickets',
      description: 'Přijaté požadavky na podporu',
      color: 'amber',
    },
    {
      title: 'Uchazeči',
      icon: '📄',
      route: '/admin/web/job-applications',
      description: 'Reakce na pracovní pozice',
      color: 'green',
    },
    {
      title: 'Obchodní leady',
      icon: '💼',
      route: '/admin/web/sales-leads',
      description: 'Pipeline obchodních příležitostí',
      color: 'rose',
    },
  ];

  private emailSub?: Subscription;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.userRole = this.authService.getUserRole();

    this.emailSub = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      this.cd.markForCheck();
    });

    this.loadUserProfile();
    this.loadStats();
    this.loadRecentActivity();
  }

  /**
   * @description Fetches the currently authenticated user's profile information.
   */
  private loadUserProfile(): void {
    const userId = this.authService.getUserId();
    if (!userId) return;
    if (this.loadingService.isLoadingSnapshot) return;

    this.getItemDetails(parseInt(userId, 10)).subscribe({
      next: (response: any) => {
        this.userData = response.data ?? response;
        this.cd.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Nepodařilo se načíst profil.';
        this.cd.markForCheck();
      }
    });
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
          { label: 'Uživatelé systému', value: res.users?.total ?? '—', icon: '👤', color: 'sky' },
          {
            label: 'Otevřené tickety',
            value: res.openTickets?.total ?? '—',
            icon: '🎫',
            color: res.openTickets?.total > 0 ? 'amber' : 'green'
          },
          { label: 'Uchazeči', value: res.jobApps?.total ?? '—', icon: '📄', color: 'green' },
          { label: 'Obchodní leady', value: res.leads?.total ?? '—', icon: '💼', color: 'indigo' },
          { label: 'Novinky na webu', value: res.news?.total ?? '—', icon: '📰', color: 'rose' },
          { label: 'Záznamy v logu', value: res.webLogs?.total ?? '—', icon: '📋', color: 'slate' },
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
   * @description Returns a personalized greeting based on user profile name or email.
   */
  get welcomeMessage(): string {
    const name = this.userData?.full_name ?? this.userEmail ?? 'uživateli';
    return `Dobrý den, ${name}`;
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

  override ngOnDestroy(): void {
    this.emailSub?.unsubscribe();
    super.ngOnDestroy();
  }
}