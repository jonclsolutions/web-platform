import { Component, ChangeDetectionStrategy, inject, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';

import * as Core from '../../../shared/imports/core-providers';
import { UserLogin } from '../../../shared/interfaces/user';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { LoadingService } from '../../../core/services/loading.service';

interface ActivityLog {
  id: number;
  event_type: string;
  module: string;
  description: string;
  user_plain: string;
  origin: string;
  created_at: string;
}

interface QuickStat {
  label: string;
  value: number | string;
  icon: string;
  color: 'indigo' | 'green' | 'amber' | 'rose' | 'sky' | 'slate';
}

interface NavSection {
  title: string;
  icon: string;
  route: string;
  description: string;
  color: 'indigo' | 'green' | 'amber' | 'sky' | 'rose' | 'slate';
}

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
  private http = inject(HttpClient);

  override apiEndpoint = 'core/users';

  // ---- Uživatel ----
  userData: UserLogin | null = null;
  userEmail: string | null = null;
  userRole: string | null = null;

  // ---- Statistiky ----
  quickStats: QuickStat[] = [];
  loadingStats = true;

  // ---- Logy aktivit ----
  recentActivity: ActivityLog[] = [];
  loadingActivity = true;

  // ---- Navigační sekce ----
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

  // ---- Subscriptions ----
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

  // ---- Profil ----
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

  // ---- Statistiky ze všech dostupných API ----
  private loadStats(): void {
    this.loadingStats = true;

    forkJoin({
      users:        this.http.get<any>('/api/core/users?per_page=1').pipe(catchError(() => of(null))),
      webLogs:      this.http.get<any>('/api/web/logs?per_page=1').pipe(catchError(() => of(null))),
      tickets:      this.http.get<any>('/api/web/support_tickets?per_page=1').pipe(catchError(() => of(null))),
      openTickets:  this.http.get<any>('/api/web/support_tickets?status=open&per_page=1').pipe(catchError(() => of(null))),
      jobApps:      this.http.get<any>('/api/web/job_applications?per_page=1').pipe(catchError(() => of(null))),
      leads:        this.http.get<any>('/api/web/sales_leads?per_page=1').pipe(catchError(() => of(null))),
      news:         this.http.get<any>('/api/web/news?per_page=1').pipe(catchError(() => of(null))),
    }).subscribe({
      next: (res) => {
        this.quickStats = [
          {
            label: 'Uživatelé systému',
            value: res.users?.total ?? '—',
            icon: '👤',
            color: 'sky',
          },
          {
            label: 'Otevřené tickety',
            value: res.openTickets?.total ?? '—',
            icon: '🎫',
            color: res.openTickets?.total > 0 ? 'amber' : 'green',
          },
          {
            label: 'Uchazeči',
            value: res.jobApps?.total ?? '—',
            icon: '📄',
            color: 'green',
          },
          {
            label: 'Obchodní leady',
            value: res.leads?.total ?? '—',
            icon: '💼',
            color: 'indigo',
          },
          {
            label: 'Novinky na webu',
            value: res.news?.total ?? '—',
            icon: '📰',
            color: 'rose',
          },
          {
            label: 'Záznamy v logu',
            value: res.webLogs?.total ?? '—',
            icon: '📋',
            color: 'slate',
          },
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

  // ---- Poslední aktivita (web logy) ----
  private loadRecentActivity(): void {
    this.loadingActivity = true;

    this.http.get<any>('/api/web/logs?per_page=8&sort_by=created_at&sort_direction=desc')
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

  // ---- Helpers ----
  get welcomeMessage(): string {
    const name = this.userData?.full_name ?? this.userEmail ?? 'uživateli';
    return `Dobrý den, ${name}`;
  }

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
  }
}