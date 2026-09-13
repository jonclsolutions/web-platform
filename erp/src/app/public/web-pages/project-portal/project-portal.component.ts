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
 * closeThreadAsCustomer(), ProjectPortalLocalizationService integration, the tabbed
 * layout redesign, progress bar / unread count / estimated completion / contacts tab,
 * attachment upload, pagedMessages() open-thread scroll fix, real-time attachment
 * validation, global/detail polling, and the bidirectional thread status select are
 * unchanged - see version history.)
 *
 * @refactor-note (2026-09-12v2) BACKLOG "nápověda pro zákazníka na portálu": nová
 * záložka `'help'` přidána do `PortalTab` - čistě statický obsah (žádné API volání,
 * žádný nový stav), text celý žije v i18n JSON (`help_*` klíče), stejně jako zbytek
 * portálu. `setActiveTab()` beze změny - help záložka nepotřebuje lazy-loading jako
 * `contacts`.
 */

import { Component, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, finalize, timer, switchMap, filter } from 'rxjs';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { ProjectPortalLocalizationService } from './project-portal-localization.service';

type PortalState = 'loading' | 'login' | 'portal' | 'invalid';
type PortalTab = 'description' | 'checkpoints' | 'threads' | 'contacts' | 'help';

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB - sedí s backend `max:15360` KB pravidlem
const ALLOWED_ATTACHMENT_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv',
  'ppt', 'pptx', 'odp', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'zip', 'rar', '7z',
];

interface ProjectCheckpoint {
  id: number;
  label: string;
  status: 'new' | 'active' | 'done';
}

interface ProjectAttachment {
  id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number;
  download_url: string;
  view_url: string;
}

interface ProjectThreadMessage {
  id: number;
  author_type: 'customer' | 'admin';
  author_label: string | null;
  body: string;
  attachments?: ProjectAttachment[];
  created_at: string;
}

interface ProjectThread {
  id: number;
  subject: string;
  priority: string;
  status: string;
  last_message_at: string | null;
  unread_count?: number;
  has_more_older_messages?: boolean;
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
  estimated_completion_from: string | null;
  estimated_completion_to: string | null;
  checkpoints: ProjectCheckpoint[];
}

interface CompanySettings {
  company_name?: string;
  ico?: string;
  dic?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
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

  @ViewChild('ppMessageListEl') ppMessageListEl?: ElementRef<HTMLDivElement>;

  public readonly portalI18n = inject(ProjectPortalLocalizationService);

  public t(key: string): string {
    return this.portalI18n.getValue(key);
  }

  checkpointStatusLabels: Record<string, string> = {};

  token: string | null = null;
  state: PortalState = 'loading';

  loginPassword = '';
  loginError: string | null = null;
  loginLoading = false;

  project: PublicProject | null = null;
  threads: ProjectThread[] = [];
  selectedThread: ProjectThread | null = null;
  threadDetailLoading = false;
  olderMessagesLoading = false;

  activeTab: PortalTab = 'description';
  threadSearch = '';

  newThreadMode = false;
  newThreadSubject = '';
  newThreadPriority = 'medium';
  newThreadBody = '';
  newThreadSending = false;
  newThreadFiles: File[] = [];
  newThreadFileError: string | null = null;

  replyBody = '';
  replySending = false;
  replyFiles: File[] = [];
  replyFileError: string | null = null;

  isRefreshing = false;
  closingThread = false;

  isLangMenuOpen = false;

  companySettings: CompanySettings | null = null;
  companySettingsLoading = false;

  private sessionToken: string | null = null;

  /** @refactor-note (2026-09-11v6) Detailní polling nových zpráv uvnitř otevřeného vlákna. */
  private readonly POLL_INTERVAL_MS = 15000;
  private stopPolling$ = new Subject<void>();

  /** @refactor-note (2026-09-12) Globální polling seznamu vláken (badge nepřečtených). */
  private stopGlobalPolling$ = new Subject<void>();

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

  /**
 * @description BACKLOG "zákazník může sám uzavřít i znovu otevřít vlákno" -
 * OBOUSMĚRNÉ (dřív jen active -> closed) - zákazník může omylem zavřené vlákno
 * sám znovu otevřít, bez čekání na admina.
 */
threadStatusChanging = false;

updateThreadStatus(status: string): void {
  if (!this.selectedThread || this.threadStatusChanging || this.selectedThread.status === status) return;
  this.threadStatusChanging = true;
  this.cdr.markForCheck();

  this.publicDataService.post<ProjectThread>(
    `projects/public/${this.token}/threads/${this.selectedThread.id}/status?session_token=${encodeURIComponent(this.sessionToken!)}`,
    { status }
  ).pipe(
    finalize(() => { this.threadStatusChanging = false; this.cdr.markForCheck(); }),
    takeUntil(this.destroy$)
  ).subscribe({
    next: (updated) => {
      this.selectedThread!.status = updated.status;
      const inList = this.threads.find(t => t.id === this.selectedThread!.id);
      if (inList) inList.status = updated.status;
    },
    error: (err) => {
      if (err?.status === 404) {
        this.closeThread();
        this.loadThreads();
      }
    }
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
    this.stopPolling$.next();
    this.stopPolling$.complete();
    this.stopGlobalPolling$.next();
    this.stopGlobalPolling$.complete();
  }

  // ── Jazykový dropdown (minimalistický - jen vlaječka) ──────────────────────

  get currentLanguageMeta() {
    return this.portalI18n.availableLanguages.find(l => l.code === this.portalI18n.getCurrentLanguage());
  }

  toggleLangMenu(): void { this.isLangMenuOpen = !this.isLangMenuOpen; }
  closeLangMenu(): void { this.isLangMenuOpen = false; }
  selectLanguage(code: string): void {
    this.portalI18n.setLanguage(code);
    this.isLangMenuOpen = false;
  }

  // ── Záložky ──────────────────────────────────────────────────────────────

  setActiveTab(tab: PortalTab): void {
    this.activeTab = tab;
    if (tab === 'contacts' && !this.companySettings && !this.companySettingsLoading) {
      this.loadCompanySettings();
    }
    this.cdr.markForCheck();
  }

  private loadCompanySettings(): void {
    this.companySettingsLoading = true;
    this.cdr.markForCheck();

    this.publicDataService.getSiteSettings()
      .pipe(finalize(() => { this.companySettingsLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => { this.companySettings = res?.settings ?? null; },
        error: () => { this.companySettings = null; }
      });
  }

  // ── Progress bar ─────────────────────────────────────────────────────────

  get checkpointProgress(): { done: number; total: number; percent: number } {
    const total = this.project?.checkpoints?.length ?? 0;
    const done = this.project?.checkpoints?.filter(c => c.status === 'done').length ?? 0;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  }

  // ── Odhad termínu dokončení ──────────────────────────────────────────────

  get estimatedCompletionLabel(): string | null {
    const from = this.project?.estimated_completion_from;
    const to = this.project?.estimated_completion_to;
    if (!from && !to) return null;

    const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(
      this.portalI18n.getCurrentLanguage() === 'en' ? 'en-US' : 'cs-CZ',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );

    if (from && to) return `${fmt(from)} – ${fmt(to)}`;
    return fmt((from || to)!);
  }

  // ── Nepřečtené zprávy ────────────────────────────────────────────────────

  get totalUnreadCount(): number {
    return this.threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);
  }

  // ── Vyhledávání ve vláknech ──────────────────────────────────────────────

  get filteredThreads(): ProjectThread[] {
    const q = this.threadSearch.trim().toLowerCase();
    if (!q) return this.threads;

    return this.threads.filter(thread => {
      if (thread.subject?.toLowerCase().includes(q)) return true;
      return (thread.messages || []).some(msg => msg.body?.toLowerCase().includes(q));
    });
  }

  // ── Přílohy - výběr + REAL-TIME VALIDACE před odesláním ────────────────

  formatFileSize(bytes: number): string {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /**
   * @description Validuje a filtruje nově vybrané soubory PROTI stávajícímu výběru -
   * kontrola typu (přípona), velikosti a celkového počtu HNED při výběru, stejná
   * pravidla jako backend `Store*Request` (`mimes:...`, `max:15360`). Odmítnuté
   * soubory se do výsledku vůbec nedostanou, `onError` callback dostane první
   * narazivší chybovou hlášku (jedna hláška najednou stačí, ať se UI nezaplní).
   */
  private validateAndAddFiles(existing: File[], incoming: FileList, onError: (msg: string) => void): File[] {
    let result = [...existing];
    let errorSet = false;

    for (const file of Array.from(incoming)) {
      if (result.length >= MAX_ATTACHMENTS) {
        if (!errorSet) { onError(this.t('attachment_error_too_many').replace('{max}', String(MAX_ATTACHMENTS))); errorSet = true; }
        break;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
        if (!errorSet) { onError(this.t('attachment_error_type').replace('{name}', file.name)); errorSet = true; }
        continue;
      }
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        if (!errorSet) { onError(this.t('attachment_error_size').replace('{name}', file.name)); errorSet = true; }
        continue;
      }
      result.push(file);
    }

    return result;
  }

  onNewThreadFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.newThreadFileError = null;
    this.newThreadFiles = this.validateAndAddFiles(this.newThreadFiles, input.files, (msg) => { this.newThreadFileError = msg; });
    input.value = '';
    this.cdr.markForCheck();
  }

  removeNewThreadFile(index: number): void {
    this.newThreadFiles.splice(index, 1);
    this.newThreadFileError = null;
    this.cdr.markForCheck();
  }

  onReplyFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.replyFileError = null;
    this.replyFiles = this.validateAndAddFiles(this.replyFiles, input.files, (msg) => { this.replyFileError = msg; });
    input.value = '';
    this.cdr.markForCheck();
  }

  removeReplyFile(index: number): void {
    this.replyFiles.splice(index, 1);
    this.replyFileError = null;
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
          this.startGlobalThreadsPolling();
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
        this.startGlobalThreadsPolling();
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
    this.stopPolling$.next();
    this.stopGlobalPolling$.next();
    this.clearSession();
    this.project = null;
    this.threads = [];
    this.selectedThread = null;
    this.state = 'login';
    this.loginPassword = '';
    this.activeTab = 'description';
    this.companySettings = null;
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
   * @description Dokud je zákazník přihlášený, každých 15s tiše přetáhne seznam
   * vláken (stejný endpoint jako `loadThreads()`) - `unread_count` na jednotlivých
   * vláknech i celkový `totalUnreadCount` badge se tak aktualizují i když zákazník
   * zrovna sedí na jiné záložce (Popis/Postup/Kontakty), ne jen uvnitř konkrétního
   * otevřeného vlákna. Pokud je zrovna NĚJAKÉ vlákno otevřené, jeho vlastní detailní
   * polling (`startPollingNewMessages()`) běží nezávisle vedle tohohle - dvojí
   * request navíc každých 15s je zanedbatelná cena za "live" pocit bez nutnosti
   * WebSocketů.
   */
  private startGlobalThreadsPolling(): void {
    this.stopGlobalPolling$.next();

    timer(this.POLL_INTERVAL_MS, this.POLL_INTERVAL_MS).pipe(
      switchMap(() =>
        this.publicDataService.get<ProjectThread[]>(
          `projects/public/${this.token}/threads?session_token=${encodeURIComponent(this.sessionToken!)}`
        )
      ),
      takeUntil(this.stopGlobalPolling$),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (threads) => {
        // Pokud je právě otevřené konkrétní vlákno, jeho detailní polling se stará
        // o messages/status samo - tady jen přeneseme čerstvý unread_count na
        // odpovídající položku v seznamu, ať se badge needvádí PŘES otevřené vlákno.
        if (this.selectedThread) {
          const fresh = threads.find(t => t.id === this.selectedThread!.id);
          if (fresh) fresh.unread_count = 0;
        }
        this.threads = threads;
        this.cdr.markForCheck();
      },
      error: () => { /* tichá chyba - další pokus za 15s */ }
    });
  }

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

  /**
   * @refactor-note (2026-09-11v6) Po úspěšném načtení scrolluje na spodek (nejnovější
   * zprávy) a spouští detailní polling nových zpráv - viz `startPollingNewMessages()`.
   */
  openThread(thread: ProjectThread): void {
    this.selectedThread = thread;
    this.threadDetailLoading = true;
    this.replyBody = '';
    this.replyFiles = [];
    this.replyFileError = null;
    this.cdr.markForCheck();

    this.publicDataService.get<ProjectThread>(`projects/public/${this.token}/threads/${thread.id}?session_token=${encodeURIComponent(this.sessionToken!)}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (full) => {
          this.selectedThread = full;
          this.threadDetailLoading = false;
          const inList = this.threads.find(t => t.id === thread.id);
          if (inList) inList.unread_count = 0;
          this.cdr.markForCheck();
          this.scrollMessagesToBottom();
          this.startPollingNewMessages();
        },
        error: () => { this.threadDetailLoading = false; this.cdr.markForCheck(); }
      });
  }

  /**
   * @description Dokud je vlákno otevřené, každých 15s se zeptá jen na zprávy novější
   * než ta poslední lokálně známá (`after_id`) - žádné zbytečné přetahování celého
   * vlákna. Nové zprávy se PŘIPOJÍ na konec a scrollne se dolů. Zastaveno v
   * `closeThread()`/`ngOnDestroy()` přes `stopPolling$`.
   * @bugfix-note (2026-09-11v6) `timer(0, ...)` MÍSTO `interval(...)` - první
   * kontrola proběhne OKAMŽITĚ, ne až po první plné periodě.
   * `filter(() => !!this.selectedThread)` - pokud vlákno mezitím zmizí (uživatel
   * ho zavřel přesně v okamžiku tiku), tik se přeskočí místo shození subscription.
   */
  private startPollingNewMessages(): void {
    this.stopPolling$.next();

    timer(0, this.POLL_INTERVAL_MS).pipe(
      filter(() => !!this.selectedThread),
      switchMap(() => {
        const lastId = this.selectedThread?.messages?.[this.selectedThread.messages.length - 1]?.id ?? 0;
        return this.publicDataService.get<{ data: ProjectThreadMessage[]; status: string }>(
          `projects/public/${this.token}/threads/${this.selectedThread!.id}/new-messages?session_token=${encodeURIComponent(this.sessionToken!)}&after_id=${lastId}`
        );
      }),
      takeUntil(this.stopPolling$),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => {
        if (!this.selectedThread || res.data.length === 0) return;
        this.selectedThread.messages = [...this.selectedThread.messages!, ...res.data];
        this.selectedThread.status = res.status;
        this.cdr.markForCheck();
        this.scrollMessagesToBottom();
      },
      error: (err) => {
        console.error('[ProjectPortal] Polling new messages failed:', err);
      }
    });
  }

  /**
   * @description Předřadí starší dávku zpráv PŘED stávající lokální seznam a
   * zachová scroll pozici (uživatel zůstane dívat se na stejnou zprávu, ne
   * "vystřelí" nahoru/dolů) - měří `scrollHeight` PŘED vložením nové dávky a PO,
   * rozdíl nastaví jako nový `scrollTop`.
   */
  loadOlderMessages(): void {
    if (!this.selectedThread || this.olderMessagesLoading || !this.selectedThread.has_more_older_messages) return;
    const oldestId = this.selectedThread.messages?.[0]?.id;
    if (!oldestId) return;

    const container = this.ppMessageListEl?.nativeElement;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    this.olderMessagesLoading = true;
    this.cdr.markForCheck();

    this.publicDataService.get<{ data: ProjectThreadMessage[]; has_more_older_messages: boolean }>(
      `projects/public/${this.token}/threads/${this.selectedThread.id}/messages?session_token=${encodeURIComponent(this.sessionToken!)}&before_message_id=${oldestId}`
    ).pipe(finalize(() => { this.olderMessagesLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.selectedThread!.messages = [...res.data, ...(this.selectedThread!.messages || [])];
          this.selectedThread!.has_more_older_messages = res.has_more_older_messages;
          this.cdr.markForCheck();
          setTimeout(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - prevScrollHeight;
            }
          });
        }
      });
  }

  private scrollMessagesToBottom(): void {
    setTimeout(() => {
      const el = this.ppMessageListEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  closeThread(): void {
    this.stopPolling$.next();
    this.selectedThread = null;
    this.replyBody = '';
    this.replyFiles = [];
    this.replyFileError = null;
  }

  /**
   * @description BACKLOG "zákazník může sám uzavřít vlákno" - jednosměrné
   * (active -> closed), znovuotevření je jen na adminovi.
   * @bugfix-note (2026-09-11v6) Pokud backend odpoví 404 (vlákno mezitím zmizelo -
   * reset dat, souběžná session apod.), appka se tiše vrátí na seznam vláken s
   * obnoveným seznamem, místo nechání syrové HTTP chyby bez reakce.
   * @note Nahrazeno `updateThreadStatus()` (obousměrné) - metoda zůstává
   * nepoužívaná v šabloně, dokud nebude odstraněna při dalším úklidu.
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
      },
      error: (err) => {
        if (err?.status === 404) {
          this.closeThread();
          this.loadThreads();
        }
      }
    });
  }

  sendReply(): void {
    const body = this.replyBody.trim();
    if (!body || !this.selectedThread || this.replySending) return;

    this.replySending = true;
    this.cdr.markForCheck();

    const payload: FormData | { body: string } = this.replyFiles.length > 0
      ? this.buildFormData({ body }, this.replyFiles)
      : { body };

    this.publicDataService.post(
      `projects/public/${this.token}/threads/${this.selectedThread.id}/messages?session_token=${encodeURIComponent(this.sessionToken!)}`,
      payload
    ).pipe(
      finalize(() => { this.replySending = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.replyBody = '';
        this.replyFiles = [];
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
    this.newThreadFiles = [];
    this.newThreadFileError = null;
  }

  cancelNewThread(): void {
    this.newThreadMode = false;
    this.newThreadFiles = [];
    this.newThreadFileError = null;
  }

  submitNewThread(): void {
    if (!this.newThreadSubject.trim() || !this.newThreadBody.trim() || this.newThreadSending) return;

    this.newThreadSending = true;
    this.cdr.markForCheck();

    const base = { subject: this.newThreadSubject, priority: this.newThreadPriority, body: this.newThreadBody };
    const payload: FormData | typeof base = this.newThreadFiles.length > 0
      ? this.buildFormData(base, this.newThreadFiles)
      : base;

    this.publicDataService.post<ProjectThread>(
      `projects/public/${this.token}/threads?session_token=${encodeURIComponent(this.sessionToken!)}`,
      payload
    ).pipe(
      finalize(() => { this.newThreadSending = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.newThreadMode = false;
        this.newThreadFiles = [];
        this.loadThreads();
      }
    });
  }

  private buildFormData(fields: Record<string, string>, files: File[]): FormData {
    const fd = new FormData();
    Object.entries(fields).forEach(([key, value]) => fd.append(key, value));
    files.forEach(file => fd.append('attachments[]', file, file.name));
    return fd;
  }
}