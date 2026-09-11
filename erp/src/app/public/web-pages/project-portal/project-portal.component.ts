/**
 * @file project-portal.component.ts
 * @path src/app/public/web-pages/project-portal/project-portal.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Customer-facing project portal - login (permanent access_token URL +
 * admin-generated password) followed by a 24h-sliding session. Session token stored
 * in localStorage (namespaced per project token) and sent to the backend as a
 * `session_token` param on every request (both GET query string and POST body) - see
 * CheckProjectSession middleware.
 *
 * (Earlier refactor-notes for the refresh() silent-update pattern,
 * closeThreadAsCustomer(), and the ProjectPortalLocalizationService integration are
 * unchanged - see version history.)
 *
 * @redesign-note (2026-09-11) BACKLOG "kompletní UI refactor - přehlednost,
 * profesionální vzhled": obsah pravého panelu rozdělen do TŘÍ ZÁLOŽEK (Description /
 * Checkpoints / Threads) místo jedné dlouhé scrollovací stránky - `activeTab` řídí,
 * která se vykresluje. Description záložka nově zobrazuje i `project.technologies`
 * (dřív v interface, ale nikde v šabloně nevykreslené). Jazykový přepínač přepsán z
 * dvou CZ/EN "chips" tlačítek (duplikovaných na dvou místech - login karta i sidebar)
 * na JEDEN dropdown (vlaječka + kód + rozbalovací nabídka), stejný vzor jako
 * `AdminLayoutComponent`'s header language switcher - `isLangMenuOpen`/
 * `toggleLangMenu()`/`closeLangMenu()`/`selectLanguage()`. Přidáno fulltextové
 * vyhledávání ve vláknech (`threadSearch`/`filteredThreads` getter) - hledá jak v
 * `subject`, tak v textu VŠECH zpráv daného vlákna (backend `threadsIndex()` posílá
 * vlákna already eager-loaded s `messages` relací, takže žádný nový request navíc).
 */

import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { ProjectPortalLocalizationService } from './project-portal-localization.service';

type PortalState = 'loading' | 'login' | 'portal' | 'invalid';
type PortalTab = 'description' | 'checkpoints' | 'threads';

interface ProjectCheckpoint {
  id: number;
  label: string;
  status: 'new' | 'active' | 'done';
}

interface ProjectThreadMessage {
  id: number;
  author_type: 'customer' | 'admin';
  author_label: string | null;
  body: string;
  created_at: string;
}

interface ProjectThread {
  id: number;
  subject: string;
  priority: string;
  status: string;
  last_message_at: string | null;
  messages?: ProjectThreadMessage[];
}

interface PublicProject {
  id: number;
  name: string;
  description: string | null;
  platform: string | null;
  project_lead: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  technologies: string | null;
  checkpoints: ProjectCheckpoint[];
}

@Component({
  selector: 'app-project-portal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-portal.component.html',
  styleUrl: './project-portal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectPortalComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private publicDataService = inject(PublicDataService);
  private destroy$ = new Subject<void>();

  public readonly portalI18n = inject(ProjectPortalLocalizationService);

  public t(key: string): string {
    return this.portalI18n.getValue(key);
  }

  checkpointStatusLabels: Record<string, string> = {};

  token: string | null = null;
  state: PortalState = 'loading';

  loginPassword = '';
  /** Ukládá KLÍČ (ne resolvnutý text) - viz starší refactor-note ve verzi historii. */
  loginError: string | null = null;
  loginLoading = false;

  project: PublicProject | null = null;
  threads: ProjectThread[] = [];
  selectedThread: ProjectThread | null = null;
  threadDetailLoading = false;

  /** @redesign-note (2026-09-11) Aktivní záložka pravého panelu - výchozí 'description'. */
  activeTab: PortalTab = 'description';

  /** @redesign-note (2026-09-11) Fulltextové vyhledávání ve vláknech - subject + text zpráv. */
  threadSearch = '';

  newThreadMode = false;
  newThreadSubject = '';
  newThreadPriority = 'medium';
  newThreadBody = '';
  newThreadSending = false;

  replyBody = '';
  replySending = false;

  isRefreshing = false;
  closingThread = false;

  /** @redesign-note (2026-09-11) Jazykový dropdown (vlaječka + kód) - viz hlavička souboru. */
  isLangMenuOpen = false;

  private sessionToken: string | null = null;

  private get storageKey(): string {
    return `project_session_${this.token}`;
  }

  constructor() {
    this.portalI18n.translations$.subscribe(() => {
      this.checkpointStatusLabels = {
        new: this.t('checkpoint_status_new'),
        active: this.t('checkpoint_status_active'),
        done: this.t('checkpoint_status_done'),
      };
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token');

    if (!this.token) {
      this.state = 'invalid';
      return;
    }

    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      this.sessionToken = stored;
      this.loadProject();
    } else {
      this.state = 'login';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Jazykový dropdown ────────────────────────────────────────────────────

  get currentLanguageMeta() {
    return this.portalI18n.availableLanguages.find(l => l.code === this.portalI18n.getCurrentLanguage());
  }

  toggleLangMenu(): void {
    this.isLangMenuOpen = !this.isLangMenuOpen;
  }

  closeLangMenu(): void {
    this.isLangMenuOpen = false;
  }

  selectLanguage(code: string): void {
    this.portalI18n.setLanguage(code);
    this.isLangMenuOpen = false;
  }

  // ── Záložky ──────────────────────────────────────────────────────────────

  setActiveTab(tab: PortalTab): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  private clearSession(): void {
    localStorage.removeItem(this.storageKey);
    this.sessionToken = null;
  }

  private loadProject(): void {
    this.state = 'loading';
    this.publicDataService.get<PublicProject>(`projects/public/${this.token}/?session_token=${encodeURIComponent(this.sessionToken!)}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (project) => {
          this.project = project;
          this.state = 'portal';
          this.loadThreads();
          this.cdr.markForCheck();
        },
        error: () => {
          this.clearSession();
          this.state = 'login';
          this.cdr.markForCheck();
        }
      });
  }

  login(): void {
    if (!this.loginPassword.trim() || this.loginLoading) return;

    this.loginLoading = true;
    this.loginError = null;
    this.cdr.markForCheck();

    this.publicDataService.post<{ session_token: string; project: PublicProject }>(
      `projects/public/${this.token}/login`,
      { password: this.loginPassword }
    ).pipe(
      finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => {
        this.sessionToken = res.session_token;
        localStorage.setItem(this.storageKey, this.sessionToken);
        this.project = res.project;
        this.state = 'portal';
        this.loadThreads();
      },
      error: (err: any) => {
        this.loginError = err?.status === 404
          ? 'error_project_not_found'
          : 'error_invalid_password';
      }
    });
  }

  logout(): void {
    if (!this.sessionToken) { this.state = 'login'; return; }

    this.publicDataService.post(`projects/public/${this.token}/logout?session_token=${encodeURIComponent(this.sessionToken)}`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({ complete: () => this.finishLogout(), error: () => this.finishLogout() });
  }

  private finishLogout(): void {
    this.clearSession();
    this.project = null;
    this.threads = [];
    this.selectedThread = null;
    this.state = 'login';
    this.loginPassword = '';
    this.activeTab = 'description';
    this.cdr.markForCheck();
  }

  private loadThreads(): void {
    this.publicDataService.get<ProjectThread[]>(`projects/public/${this.token}/threads?session_token=${encodeURIComponent(this.sessionToken!)}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (threads) => { this.threads = threads; this.cdr.markForCheck(); },
        error: () => {}
      });
  }

  /**
   * @description Fulltextové vyhledávání ve vláknech - shoda v `subject` NEBO v textu
   * kterékoliv zprávy daného vlákna. `threads` už mají `messages` eager-loadované
   * z `threadsIndex()`, žádný dodatečný request se nespouští.
   */
  get filteredThreads(): ProjectThread[] {
    const q = this.threadSearch.trim().toLowerCase();
    if (!q) return this.threads;

    return this.threads.filter(thread => {
      if (thread.subject?.toLowerCase().includes(q)) return true;
      return (thread.messages || []).some(msg => msg.body?.toLowerCase().includes(q));
    });
  }

  /**
   * @description Ruční obnovení dat - znovu natáhne detail projektu (checkpointy)
   * i seznam vláken, případně i otevřené vlákno (nové zprávy od admina). Tichá
   * aktualizace (nemění `state`), ať stránka neblikne přes 'loading'.
   */
  refresh(): void {
    if (!this.sessionToken || this.isRefreshing) return;
    this.isRefreshing = true;
    this.cdr.markForCheck();

    this.publicDataService.get<PublicProject>(`projects/public/${this.token}/?session_token=${encodeURIComponent(this.sessionToken)}`)
      .pipe(finalize(() => { this.isRefreshing = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (project) => {
          this.project = project;
          this.loadThreads();
          if (this.selectedThread) {
            this.openThread(this.selectedThread);
          }
        },
        error: () => {
          this.clearSession();
          this.state = 'login';
        }
      });
  }

  openThread(thread: ProjectThread): void {
    this.selectedThread = thread;
    this.threadDetailLoading = true;
    this.replyBody = '';
    this.cdr.markForCheck();

    this.publicDataService.get<ProjectThread>(`projects/public/${this.token}/threads/${thread.id}?session_token=${encodeURIComponent(this.sessionToken!)}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (full) => { this.selectedThread = full; this.threadDetailLoading = false; this.cdr.markForCheck(); },
        error: () => { this.threadDetailLoading = false; this.cdr.markForCheck(); }
      });
  }

  closeThread(): void {
    this.selectedThread = null;
    this.replyBody = '';
  }

  /**
   * @description BACKLOG "zákazník může sám uzavřít vlákno" - jednosměrné
   * (active -> closed), znovuotevření je jen na adminovi.
   */
  closeThreadAsCustomer(): void {
    if (!this.selectedThread || this.closingThread) return;
    this.closingThread = true;
    this.cdr.markForCheck();

    this.publicDataService.post<ProjectThread>(
      `projects/public/${this.token}/threads/${this.selectedThread.id}/close?session_token=${encodeURIComponent(this.sessionToken!)}`,
      {}
    ).pipe(
      finalize(() => { this.closingThread = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (updated) => {
        this.selectedThread!.status = updated.status;
        const inList = this.threads.find(t => t.id === this.selectedThread!.id);
        if (inList) inList.status = updated.status;
      }
    });
  }

  sendReply(): void {
    const body = this.replyBody.trim();
    if (!body || !this.selectedThread || this.replySending) return;

    this.replySending = true;
    this.cdr.markForCheck();

    this.publicDataService.post(
      `projects/public/${this.token}/threads/${this.selectedThread.id}/messages?session_token=${encodeURIComponent(this.sessionToken!)}`,
      { body }
    ).pipe(
      finalize(() => { this.replySending = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.replyBody = '';
        this.openThread(this.selectedThread!);
        this.loadThreads();
      }
    });
  }

  openNewThreadForm(): void {
    this.newThreadMode = true;
    this.newThreadSubject = '';
    this.newThreadPriority = 'medium';
    this.newThreadBody = '';
  }

  cancelNewThread(): void {
    this.newThreadMode = false;
  }

  submitNewThread(): void {
    if (!this.newThreadSubject.trim() || !this.newThreadBody.trim() || this.newThreadSending) return;

    this.newThreadSending = true;
    this.cdr.markForCheck();

    this.publicDataService.post<ProjectThread>(
      `projects/public/${this.token}/threads?session_token=${encodeURIComponent(this.sessionToken!)}`,
      { subject: this.newThreadSubject, priority: this.newThreadPriority, body: this.newThreadBody }
    ).pipe(
      finalize(() => { this.newThreadSending = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.newThreadMode = false;
        this.loadThreads();
      }
    });
  }
}