/**
 * @file dashboard.component.ts
 * @path src/app/admin/core-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Central administrative dashboard for the "Core" module - system-wide
 * settings and resources shared across the Web and Shop modules (user accounts, roles &
 * permissions, legal documents, external links, system-level audit logs). Gated behind
 * `core-view-dashboard` permission.
 *
 * @note Mirrors the structure of the Web dashboard (`web-pages/dashboard`) by design so
 * both dashboards share the same visual language and CSS classes (`cd-*` prefix). Does
 * NOT surface profile-related pages (`personal-info`, `welcome-page`) - those are visible
 * to every logged-in user regardless of `core-view-dashboard` and therefore do not belong
 * on a permission-gated overview page.
 *
 * @dependencies
 * - BaseDataComponent: Provides errorMessage/cd/alertDialogService (no CRUD needed here).
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

/**
 * @description A single aggregated metric tile shown in the stats grid.
 */
interface QuickStat {
  label: string;
  value: number | string;
  icon: string;
  color: string;
}

/**
 * @description A single shortcut card shown in the quick-navigation grid.
 */
interface NavSection {
  title: string;
  icon: string;
  route: string;
  description: string;
  color: string;
}

/**
 * @description Row shape returned by the system-level audit log endpoint
 * (`web_system_logs` table). Unlike business logs (`web_logs`), system logs are not tied
 * to an authenticated admin action against a specific entity - they capture
 * infrastructure/auth-level events (login attempts, password resets, etc.) and therefore
 * carry no `user_plain` / `affected_entity_*` columns.
 */
interface SystemActivityLog {
  id: number;
  created_at: string;
  origin: string;
  event_type: string;
  module: string;
  description: string;
}

/**
 * @description Serves as the sensitive system-configuration overview for administrators
 * with Core access. Aggregates counts from every resource owned by the Core module and
 * offers one-click navigation into each management screen.
 * @note Implements component-level data aggregation from multiple API endpoints, same
 * pattern as `WebDashboardComponent`.
 */
@Component({
  selector: 'app-core-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoreDashboardComponent extends BaseDataComponent<UserLogin> implements Core.OnInit {

  public override loadingService = inject(LoadingService);
  private sanitizer = inject(DomSanitizer);

  override apiEndpoint = 'core/users';

  quickStats: QuickStat[] = [];
  loadingStats = true;

  recentActivity: SystemActivityLog[] = [];
  loadingActivity = true;

  readonly navSections: NavSection[] = [
    {
      title: 'Administrátoři',
      icon: 'users',
      route: '/admin/core/administrators',
      description: 'Správa uživatelských účtů administrátorů',
      color: 'sky',
    },
    {
      title: 'Role a oprávnění',
      icon: 'shield',
      route: '/admin/core/edit-roles',
      description: 'Definice rolí a jejich přístupových práv',
      color: 'indigo',
    },
    {
      title: 'Právní dokumenty',
      icon: 'legal',
      route: '/admin/core/edit-legal',
      description: 'GDPR, obchodní podmínky a další dokumenty',
      color: 'slate',
    },
    {
      title: 'Externí odkazy',
      icon: 'link',
      route: '/admin/core/external-links',
      description: 'Odkazy na analytiku a externí nástroje',
      color: 'green',
    },
    {
      title: 'Systémové logy',
      icon: 'logs',
      route: '/admin/core/logs',
      description: 'Auditní záznamy autentizace a systému',
      color: 'amber',
    },
    {
      title: 'Nastavení webu',
      icon: 'settings',
      route: '/admin/core/web-settings',
      description: 'Globální konfigurace webu a e-shopu',
      color: 'rose',
    },
  ];

  /**
   * Icon library used on this dashboard - key matches the `icon` value in
   * `QuickStat`/`NavSection`. Deliberately without `viewBox` (sizing is controlled purely
   * by CSS via `.cd-stat-icon svg` / `.cd-nav-icon svg`) - see the identical note in
   * `WebDashboardComponent` for why `viewBox` would otherwise get lower-cased and ignored
   * when injected through `[innerHTML]`.
   */
  private readonly ICONS: Record<string, string> = {
    users: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    shield: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    legal: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M7 21h10"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/><path d="m7 7 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m17 7 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/></svg>`,
    link: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    logs: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>`,
    settings: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
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
   * @description Returns a safely sanitized SVG markup string for the given icon key
   * (see `ICONS`), for rendering via `[innerHTML]` in the template.
   * @param key Icon identifier used in `QuickStat.icon` / `NavSection.icon`.
   * @returns Sanitized SVG markup, or an empty sanitized string if the key is unknown.
   */
  getIcon(key: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.ICONS[key] ?? '');
  }

  /**
   * @description Aggregates resource counts from every Core-owned endpoint concurrently
   * using forkJoin.
   * @note If an individual request fails, it defaults to null so the rest of the
   * dashboard remains functional. `getPaginatedCollection` is used deliberately (not
   * `getCollection`) to keep `.total` from the response instead of just the unwrapped
   * page of records.
   * @assumption `core/roles`, `legal/document_sections` and `core/system_logs` endpoint
   * names are inferred from the project's existing naming convention
   * (`{module}/{table_name}`) - verify against the real API routes for `CoreRoleController`,
   * `DocumentSectionController` and the controller backing the `core-pages/logs` page
   * before relying on these in production.
   */
  private loadStats(): void {
    this.loadingStats = true;

    forkJoin({
      users:         this.dataHandler.getPaginatedCollection<any>('core/users?per_page=1').pipe(catchError(() => of(null))),
      roles:         this.dataHandler.getPaginatedCollection<any>('core/roles?per_page=1').pipe(catchError(() => of(null))),
      legalDocs:     this.dataHandler.getPaginatedCollection<any>('legal/document-sections?per_page=1').pipe(catchError(() => of(null))),
      externalLinks: this.dataHandler.getPaginatedCollection<any>('web/external_links?per_page=1').pipe(catchError(() => of(null))),
      systemLogs:    this.dataHandler.getPaginatedCollection<any>('core/system_logs?per_page=1').pipe(catchError(() => of(null))),
    }).subscribe({
      next: (res) => {
        this.quickStats = [
          { label: 'Uživatelé systému', value: res.users?.total ?? '—', icon: 'users', color: 'sky' },
          { label: 'Role a oprávnění', value: res.roles?.total ?? '—', icon: 'shield', color: 'indigo' },
          { label: 'Právní dokumenty', value: res.legalDocs?.total ?? '—', icon: 'legal', color: 'slate' },
          { label: 'Externí odkazy', value: res.externalLinks?.total ?? '—', icon: 'link', color: 'green' },
          { label: 'Systémové logy', value: res.systemLogs?.total ?? '—', icon: 'logs', color: 'amber' },
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
   * @description Fetches the latest system-level audit events (authentication, password
   * resets, infrastructure) for the activity feed.
   * @assumption Endpoint name `core/system_logs` - see note on `loadStats()`.
   */
  private loadRecentActivity(): void {
    this.loadingActivity = true;
    this.dataHandler.getPaginatedCollection<any>('core/system_logs?per_page=8&sort_by=created_at&sort_direction=desc')
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

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('cs-CZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /**
   * @description Maps raw `event_type` values from `web_system_logs` to human-readable
   * Czech labels.
   * @param type Raw event type string.
   * @returns Human-readable label, falling back to the raw value if unmapped.
   */
  eventTypeLabel(type: string): string {
    const map: Record<string, string> = {
      password_reset_requested: 'Žádost o reset hesla',
      password_reset_completed: 'Reset hesla dokončen',
      password_reset_failed: 'Reset hesla selhal',
      login_success: 'Přihlášení',
      login_failed: 'Neúspěšné přihlášení',
      create: 'Vytvoření', update: 'Úprava', delete: 'Smazání', error: 'Chyba',
    };
    return map[type] ?? type;
  }

  /**
   * @description Maps raw `event_type` values to a CSS badge class controlling color.
   * @param type Raw event type string.
   * @returns CSS class name, falling back to a neutral default.
   */
  eventTypeClass(type: string): string {
    const map: Record<string, string> = {
      password_reset_requested: 'ev-update',
      password_reset_completed: 'ev-create',
      password_reset_failed: 'ev-delete',
      login_success: 'ev-create',
      login_failed: 'ev-delete',
      create: 'ev-create', update: 'ev-update', delete: 'ev-delete', error: 'ev-error',
    };
    return map[type] ?? 'ev-default';
  }
}