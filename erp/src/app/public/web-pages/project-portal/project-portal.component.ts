/**
 * @file project-portal.component.ts
 * @path src/app/public/web-pages/project-portal/project-portal.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Customer-facing project portal - login (permanent access_token URL +
 * admin-generated password) followed by a 24h-sliding session (CheckProjectSession middleware).
 *
 * @security The portal session is NOT handled by JavaScript at all: the API sets it as an
 *   HttpOnly / Secure / SameSite=Strict cookie limited to the routes of this project and the
 *   browser sends it by itself (same origin). Nothing is stored in localStorage, so an XSS
 *   cannot read the session. After a reload the portal simply asks the API (GET of the project):
 *   200 = the session is still valid, 401 = show the login.
 */

import { Component, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subject, takeUntil, finalize, timer, switchMap, filter } from 'rxjs';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { ApiEnvelope } from '../../../shared/interfaces/api-envelope';
import { ProjectPortalLocalizationService } from './project-portal-localization.service';
import { UploadRulesService } from '../../../shared/services/upload-rules.service';
import { UploadRule, extensionsLabel, fileExtension, isExtensionAllowed } from '../../../shared/utils/upload-rules';

type PortalState = 'loading' | 'login' | 'portal' | 'invalid';
type PortalTab = 'description' | 'checkpoints' | 'threads' | 'contacts' | 'help';

/** Fallback limits of the thread attachments while the rules of the API (`GET upload-rules`, profile project_thread) are not loaded. */
const DEFAULT_MAX_ATTACHMENTS = 5;
const DEFAULT_MAX_ATTACHMENT_SIZE_MB = 15;

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
  /** Null for types that are download only (see AttachmentPolicy on the API). */
  view_url: string | null;
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
  styleUrls: ['../../../admin/shared-styles/theme.css', './project-portal.component.css'],
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
  /** Error of the last failed new thread. */
  newThreadSendError: string | null = null;

  replyBody = '';
  replySending = false;
  replyFiles: File[] = [];
  replyFileError: string | null = null;
  /** Error of the last failed reply. */
  replySendError: string | null = null;

  isRefreshing = false;

  isLangMenuOpen = false;

  companySettings: CompanySettings | null = null;
  companySettingsLoading = false;

  /** Whether the portal holds a session (the session itself is only in the HttpOnly cookie). */
  private hasSession = false;

  /** Key under which the former versions kept the session token in localStorage (removed on load). */
  private readonly LEGACY_STORAGE_PREFIX = 'project_session_';

  private readonly POLL_INTERVAL_MS = 15000;
  private stopPolling$ = new Subject<void>();

  private stopGlobalPolling$ = new Subject<void>();

  constructor() {
    this.portalI18n.translations$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.checkpointStatusLabels = {
        new: this.t('checkpoint_status_new'),
        active: this.t('checkpoint_status_active'),
        done: this.t('checkpoint_status_done'),
      };
      this.cdr.markForCheck();
    });
  }

  /**
 * @description The customer can close and reopen a thread - BOTH directions, so a thread closed
 * by mistake can be reopened without waiting for an admin.
 */
threadStatusChanging = false;

updateThreadStatus(status: string): void {
  if (!this.selectedThread || this.threadStatusChanging || this.selectedThread.status === status) return;
  this.threadStatusChanging = true;
  this.cdr.markForCheck();

  this.portalPost<ProjectThread>(
    `projects/public/${this.token}/threads/${this.selectedThread.id}/status`,
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

  private uploadRulesService = inject(UploadRulesService);

  /** Attachment rules of the API (profile project_thread) - null until loaded / when unavailable. */
  attachmentRules: UploadRule | null = null;

  /** @description Maximum number of attachments of one message. */
  get maxAttachments(): number {
    return this.attachmentRules?.max_files ?? DEFAULT_MAX_ATTACHMENTS;
  }

  /** @description Maximum size of one attachment in MB. */
  get maxAttachmentSizeMb(): number {
    return this.attachmentRules?.max_file_size_mb ?? DEFAULT_MAX_ATTACHMENT_SIZE_MB;
  }


  /** @description "Allowed types: …" appended to a type error ('' while no rules are known). */
  get attachmentTypesText(): string {
    const ext = this.attachmentRules?.extensions ?? [];
    return ext.length ? this.t('attachment_allowed_types').replace('{types}', extensionsLabel(ext)) : '';
  }

  ngOnInit(): void {
    this.uploadRulesService.rules('project_thread')
      .pipe(takeUntil(this.destroy$))
      .subscribe(rules => { this.attachmentRules = rules; this.cdr.markForCheck(); });

    this.token = this.route.snapshot.paramMap.get('token');

    if (!this.token) {
      this.state = 'invalid';
      return;
    }

    this.removeLegacySessionToken();
    // The cookie (if any) is unreadable here - the API answers whether the session is valid.
    this.loadProject();
  }

  /** @description Deletes the session token a former version of the portal kept in localStorage. */
  private removeLegacySessionToken(): void {
    try {
      localStorage.removeItem(`${this.LEGACY_STORAGE_PREFIX}${this.token}`);
    } catch {
      // Storage unavailable - nothing to remove.
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

  // ── Language dropdown (minimalist - flag only) ──────────────────────

  get currentLanguageMeta() {
    return this.portalI18n.availableLanguages.find(l => l.code === this.portalI18n.getCurrentLanguage());
  }

  toggleLangMenu(): void { this.isLangMenuOpen = !this.isLangMenuOpen; }
  closeLangMenu(): void { this.isLangMenuOpen = false; }
  selectLanguage(code: string): void {
    this.portalI18n.setLanguage(code);
    this.isLangMenuOpen = false;
  }

  // ── Tabs ──────────────────────────────────────────────────────────────

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

  // ── Estimated completion date ──────────────────────────────────────────────

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

  // ── Unread messages ────────────────────────────────────────────────────

  get totalUnreadCount(): number {
    return this.threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);
  }

  // ── Search in threads ──────────────────────────────────────────────

  get filteredThreads(): ProjectThread[] {
    const q = this.threadSearch.trim().toLowerCase();
    if (!q) return this.threads;

    return this.threads.filter(thread => {
      if (thread.subject?.toLowerCase().includes(q)) return true;
      return (thread.messages || []).some(msg => msg.body?.toLowerCase().includes(q));
    });
  }

  // ── Attachments - choice + REAL-TIME VALIDATION before sending ────────────────

  formatFileSize(bytes: number): string {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /**
   * @description Validates and filters newly chosen files AGAINST the current selection - checks
   * the type (extension), size and total count AT ONCE on selection, with the same rules as the
   * backend `Store*Request` (`mimes:...`, `max:15360`). Refused files never get into the result,
   * the `onError` callback gets the first error message hit (one message at a time is enough).
   */
  private validateAndAddFiles(existing: File[], incoming: FileList, onError: (msg: string) => void): File[] {
    let result = [...existing];
    let errorSet = false;

    for (const file of Array.from(incoming)) {
      if (result.length >= this.maxAttachments) {
        if (!errorSet) { onError(this.t('attachment_error_too_many').replace('{max}', String(this.maxAttachments))); errorSet = true; }
        break;
      }
      if (!isExtensionAllowed(file.name, this.attachmentRules?.extensions ?? [])) {
        const ext = fileExtension(file.name);
        // The allowed types are listed only now, together with the refusal (not up front)
        // (a type error needs a non-empty list, so the types text is never empty here).
        if (!errorSet) { onError(this.t('attachment_error_type').replace('{name}', file.name).replace('{ext}', ext ? '.' + ext : '?') + ' ' + this.attachmentTypesText); errorSet = true; }
        continue;
      }
      if (file.size > this.maxAttachmentSizeMb * 1024 * 1024) {
        if (!errorSet) { onError(this.t('attachment_error_size').replace('{name}', file.name).replace('{maxMb}', String(this.maxAttachmentSizeMb))); errorSet = true; }
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

  /** GET of a portal endpoint (the browser sends the session cookie). */
  private portalGet<T>(path: string): Observable<T> {
    return this.publicDataService.get<T>(path);
  }

  /** GET of a portal endpoint keeping the envelope (`meta`, finding #6). */
  private portalGetWithMeta<T, M>(path: string): Observable<ApiEnvelope<T, M>> {
    return this.publicDataService.getWithMeta<T, M>(path);
  }

  /** POST to a portal endpoint (the browser sends the session cookie). */
  private portalPost<T>(path: string, body: any): Observable<T> {
    return this.publicDataService.post<T>(path, body);
  }

  private clearSession(): void {
    this.hasSession = false;
  }

  private loadProject(): void {
    this.state = 'loading';
    this.portalGet<PublicProject>(`projects/public/${this.token}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (project) => {
          this.hasSession = true;
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

    this.portalPost<{ project: PublicProject }>(
      `projects/public/${this.token}/login`,
      { password: this.loginPassword }
    ).pipe(
      finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => {
        this.hasSession = true;
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
    if (!this.hasSession) { this.state = 'login'; return; }

    this.portalPost(`projects/public/${this.token}/logout`, {})
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
    this.portalGet<ProjectThread[]>(`projects/public/${this.token}/threads`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (threads) => { this.threads = threads; this.cdr.markForCheck(); },
        error: () => {}
      });
  }

  /**
   * @description While the customer is logged in, silently reloads the thread list every 15 s (the
   * same endpoint as `loadThreads()`) - the `unread_count` of the threads and the total
   * `totalUnreadCount` badge update even while the customer is on another tab (Description /
   * Progress / Contacts). When a thread is open, its own detail polling
   * (`startPollingNewMessages()`) runs independently next to this one - one extra request every
   * 15 s is a negligible price for a "live" feel without WebSockets.
   */
  private startGlobalThreadsPolling(): void {
    this.stopGlobalPolling$.next();

    timer(this.POLL_INTERVAL_MS, this.POLL_INTERVAL_MS).pipe(
      switchMap(() =>
        this.portalGet<ProjectThread[]>(
          `projects/public/${this.token}/threads`
        )
      ),
      takeUntil(this.stopGlobalPolling$),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (threads) => {
        // When a thread is open, its detail polling handles the
        // messages / status itself - here only the fresh unread_count is copied to the
        // matching list item, so the badge is not doubled OVER the open thread.
        if (this.selectedThread) {
          const fresh = threads.find(t => t.id === this.selectedThread!.id);
          if (fresh) fresh.unread_count = 0;
        }
        this.threads = threads;
        this.cdr.markForCheck();
      },
      error: () => { /* silent error - next attempt in 15 s */ }
    });
  }

  refresh(): void {
    if (!this.hasSession || this.isRefreshing) return;
    this.isRefreshing = true;
    this.cdr.markForCheck();

    this.portalGet<PublicProject>(`projects/public/${this.token}`)
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
    this.replyFiles = [];
    this.replyFileError = null;
    this.cdr.markForCheck();

    this.portalGetWithMeta<ProjectThread, { has_more_older_messages: boolean }>(`projects/public/${this.token}/threads/${thread.id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          // `has_more_older_messages` comes in meta (finding #6), kept on the thread for the template.
          const full: ProjectThread = { ...res.data, has_more_older_messages: !!res.meta?.has_more_older_messages };
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
   * @description While the thread is open, asks every 15 s only for messages newer than the last
   * locally known one (`after_id`) - no needless reload of the whole thread. New messages are
   * APPENDED and the view scrolls down. Stopped in `closeThread()` / `ngOnDestroy()` through
   * `stopPolling$`.
   */
  private startPollingNewMessages(): void {
    this.stopPolling$.next();

    timer(0, this.POLL_INTERVAL_MS).pipe(
      filter(() => !!this.selectedThread),
      switchMap(() => {
        const lastId = this.selectedThread?.messages?.[this.selectedThread.messages.length - 1]?.id ?? 0;
        return this.portalGetWithMeta<ProjectThreadMessage[], { status: string }>(
          `projects/public/${this.token}/threads/${this.selectedThread!.id}/new-messages?after_id=${lastId}`
        );
      }),
      takeUntil(this.stopPolling$),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => {
        if (!this.selectedThread || res.data.length === 0) return;
        this.selectedThread.messages = [...this.selectedThread.messages!, ...res.data];
        this.selectedThread.status = res.meta?.status ?? this.selectedThread.status;
        this.cdr.markForCheck();
        this.scrollMessagesToBottom();
      },
      error: (err) => {
        console.error('[ProjectPortal] Polling new messages failed:', err);
      }
    });
  }

  /**
   * @description Prepends an older batch of messages BEFORE the current local list and keeps the
   * scroll position (the user stays on the same message instead of jumping up / down) - measures
   * `scrollHeight` BEFORE and AFTER inserting the batch and sets the difference as the new
   * `scrollTop`.
   */
  loadOlderMessages(): void {
    if (!this.selectedThread || this.olderMessagesLoading || !this.selectedThread.has_more_older_messages) return;
    const oldestId = this.selectedThread.messages?.[0]?.id;
    if (!oldestId) return;

    const container = this.ppMessageListEl?.nativeElement;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    this.olderMessagesLoading = true;
    this.cdr.markForCheck();

    this.portalGetWithMeta<ProjectThreadMessage[], { has_more_older_messages: boolean }>(
      `projects/public/${this.token}/threads/${this.selectedThread.id}/messages?before_message_id=${oldestId}`
    ).pipe(finalize(() => { this.olderMessagesLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.selectedThread!.messages = [...res.data, ...(this.selectedThread!.messages || [])];
          this.selectedThread!.has_more_older_messages = !!res.meta?.has_more_older_messages;
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

  sendReply(): void {
    const body = this.replyBody.trim();
    if (!body || !this.selectedThread || this.replySending) return;

    this.replySending = true;
    this.replySendError = null;
    this.cdr.markForCheck();

    const payload: FormData | { body: string } = this.replyFiles.length > 0
      ? this.buildFormData({ body }, this.replyFiles)
      : { body };

    this.portalPost(
      `projects/public/${this.token}/threads/${this.selectedThread.id}/messages`,
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
      },
      error: () => {
        this.replySendError = this.t('error_send_failed');
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
    this.newThreadSendError = null;
    this.cdr.markForCheck();

    const base = { subject: this.newThreadSubject, priority: this.newThreadPriority, body: this.newThreadBody };
    const payload: FormData | typeof base = this.newThreadFiles.length > 0
      ? this.buildFormData(base, this.newThreadFiles)
      : base;

    this.portalPost<ProjectThread>(
      `projects/public/${this.token}/threads`,
      payload
    ).pipe(
      finalize(() => { this.newThreadSending = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.newThreadMode = false;
        this.newThreadFiles = [];
        this.loadThreads();
      },
      error: () => {
        this.newThreadSendError = this.t('error_send_failed');
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