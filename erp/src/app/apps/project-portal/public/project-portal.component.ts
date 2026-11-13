/**
 * @file project-portal.component.ts
 * @path src/app/apps/project-portal/public/project-portal.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Customer-facing project portal - login (permanent access_token URL + login name
 *   and password of a client account created by the supplier) followed by a 24h-sliding session
 *   (CheckProjectSession middleware). Laid out like the administration: header (menu button,
 *   signed-in name, refresh, language), a left menu that collapses (desktop) or slides in (mobile)
 *   and the sections Overview (key numbers + "What is new since your last visit"), Progress,
 *   Communication (unread badge, "waiting on you"), Approvals (approve / request changes),
 *   Updates of the supplier, Files, Contacts, My account (own e-mail and e-mail notifications -
 *   all off by default) and Help. Sign-in: login name + password, or a one-time code / link sent
 *   to the account's e-mail (also the invitation link `?access=`); `?section=` of an e-mail opens
 *   its section after the sign-in.
 * @note The client sees only what the supplier made public: no internal notes, no internal
 *   checkpoint notes (the API leaves them out). Several accounts of one client share the
 *   conversations - messages show who wrote them ("You" for the own ones).
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
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, takeUntil, finalize, timer, switchMap, filter } from 'rxjs';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { ApiEnvelope } from '../../../shared/interfaces/api-envelope';
import { ProjectPortalLocalizationService } from './project-portal-localization.service';
import { UploadRulesService } from '../../../shared/services/upload-rules.service';
import { UploadRule, extensionsLabel, fileExtension, isExtensionAllowed } from '../../../shared/utils/upload-rules';

type PortalState = 'loading' | 'login' | 'portal' | 'invalid';
/** Sections of the left menu. */
export type PortalTab = 'overview' | 'checkpoints' | 'threads' | 'approvals' | 'updates' | 'files' | 'contacts' | 'account' | 'help';

/** Notification switches the client sets in "My account" (all off by default). */
export const PORTAL_NOTIFICATIONS = ['notify_replies', 'notify_checkpoint_status', 'notify_checkpoint_dates', 'notify_updates', 'notify_approvals'] as const;
export type PortalNotification = typeof PORTAL_NOTIFICATIONS[number];

/** Settings of the own account the client may change. */
export interface PortalAccountSettings {
  email: string;
  language: 'cz' | 'en';
  notify_replies: boolean;
  notify_checkpoint_status: boolean;
  notify_checkpoint_dates: boolean;
  notify_updates: boolean;
  notify_approvals: boolean;
}

/** Items of the left menu in their order (Help and logout are at the bottom). */
export const PORTAL_SECTIONS: PortalTab[] = ['overview', 'checkpoints', 'threads', 'approvals', 'updates', 'files', 'contacts'];

/** How the login screen signs in: password, or a code e-mailed to the account. */
export type PortalLoginMode = 'password' | 'code';

/** Item of "What is new" (API ProjectActivityFeed, client audience). */
export interface PortalActivityItem {
  type: 'update' | 'checkpoint' | 'approval_requested' | 'approval_decided' | 'reply';
  at: string;
  title: string;
  detail: string | null;
  actor?: string | null;
  target: { section: string; id: number | null };
  is_new: boolean;
}

/** Update of the supplier. */
export interface PortalUpdate {
  id: number;
  title: string;
  body: string;
  author_label: string | null;
  published_at: string | null;
  attachments?: ProjectAttachment[];
}

/** Approval request. */
export interface PortalApproval {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'approved' | 'changes_requested';
  due_date: string | null;
  checkpoint_label?: string | null;
  requested_by_label: string | null;
  requested_at: string | null;
  attachments?: ProjectAttachment[];
  decisions?: { id: number; decision: 'approved' | 'changes_requested'; comment: string | null; author_label: string | null; account_id: number | null; created_at: string }[];
}

/** localStorage key of the collapsed menu (a per-browser convenience only). */
export const PORTAL_SIDEBAR_STORAGE_KEY = 'pp_sidebar_collapsed';

/** Window width up to which the menu slides in over the content instead of collapsing. */
const MOBILE_MAX_WIDTH = 768;

/** Fallback limits of the thread attachments while the rules of the API (`GET upload-rules`, profile project_thread) are not loaded. */
const DEFAULT_MAX_ATTACHMENTS = 5;
const DEFAULT_MAX_ATTACHMENT_SIZE_MB = 15;

interface ProjectCheckpoint {
  id: number;
  /** Title of the checkpoint. */
  label: string;
  /** What the checkpoint covers (written by the supplier) - shown when the item is expanded. */
  description?: string | null;
  /** Planned date (Y-m-d). */
  due_date?: string | null;
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
  /** Client account that wrote the message (null for the supplier). */
  author_account_id?: number | null;
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
  /** Whose turn it is in an active thread: 'customer' (you) | 'supplier' | null (closed). */
  waiting_on?: 'customer' | 'supplier' | null;
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
  /** The signed-in client account with the settings it may change itself. */
  account?: {
    id: number;
    username: string;
    display_name: string;
    email?: string | null;
    language?: 'cz' | 'en';
    notify_replies?: boolean;
    notify_checkpoint_status?: boolean;
    notify_checkpoint_dates?: boolean;
    notify_updates?: boolean;
    notify_approvals?: boolean;
    /** The e-mail was proven by a code / link. */
    email_verified?: boolean;
    /** The account can sign in with a password. */
    has_password?: boolean;
  };
}

/** File of a conversation (Files section). */
interface PortalFile {
  id: number;
  original_filename: string;
  size_bytes: number;
  download_url: string;
  /** Where the file comes from: a thread, an update, an approval request. */
  source?: 'thread' | 'update' | 'approval';
  source_id?: number | null;
  source_title?: string | null;
  thread_id: number | null;
  thread_subject: string | null;
  author_type: 'customer' | 'admin';
  author_label: string | null;
  created_at: string;
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
  private router = inject(Router);
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

  loginUsername = '';
  loginPassword = '';
  /** Password, or a code e-mailed to the account. */
  loginMode: PortalLoginMode = 'password';
  /** Code mode: the code was requested (second step - enter it). */
  codeRequested = false;
  loginCode = '';
  /** Neutral confirmation after a code request (never says whether the account exists). */
  loginInfo: string | null = null;
  /** Section asked for by the address (`?section=` of an e-mail) - opened after the sign-in. */
  private requestedSection: PortalTab | null = null;

  /** "What is new" (overview). */
  activity: PortalActivityItem[] = [];
  activityUnseen = 0;
  activityLoading = false;
  updates: PortalUpdate[] = [];
  updatesLoading = false;
  approvals: PortalApproval[] = [];
  approvalsLoading = false;
  /** Approval with an open "request changes" form, its comment. */
  changesFormId: number | null = null;
  changesComment = '';
  /** Approval whose decision is being sent. */
  decidingId: number | null = null;
  decisionError: string | null = null;
  loginError: string | null = null;
  loginLoading = false;

  project: PublicProject | null = null;
  threads: ProjectThread[] = [];
  selectedThread: ProjectThread | null = null;
  threadDetailLoading = false;
  olderMessagesLoading = false;

  activeTab: PortalTab = 'overview';
  /** Items of the left menu. */
  readonly sections = PORTAL_SECTIONS;
  /** Desktop: the left menu shows icons only. */
  sidebarCollapsed = false;
  /** Mobile: the left menu slid in over the content. */
  mobileNavOpen = false;

  files: PortalFile[] = [];
  filesLoading = false;
  filesError = false;

  /** Kinds of notifications offered in "My account". */
  readonly notificationKinds = PORTAL_NOTIFICATIONS;
  /** Draft of "My account" (filled from the account when the section opens). */
  accountSettings: PortalAccountSettings = ProjectPortalComponent.settingsOf(undefined);
  accountSaving = false;
  /** Result of the last save: 'saved' | 'error' | 'email_required' | null. */
  accountSaveResult: 'saved' | 'error' | 'email_required' | null = null;
  threadSearch = '';
  /** Checkpoints whose description is expanded. */
  expandedCheckpointIds = new Set<number>();

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
    this.sidebarCollapsed = this.readSidebarCollapsed();
    const query = this.route.snapshot.queryParamMap;
    const section = query.get('section') as PortalTab | null;
    this.requestedSection = section && (PORTAL_SECTIONS as string[]).concat(['account', 'help']).includes(section) ? section : null;
    const accessLink = query.get('access');
    if (accessLink) {
      // One-time link of an e-mail (sign-in code / invitation) - used once, then dropped from the address.
      this.loginWithLink(accessLink);
      return;
    }
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

  // ── Layout: menu button, collapsed / slid-in menu ─────────────────────

  /** @description The window is narrow - the menu slides in over the content. */
  private isMobileWidth(): boolean {
    try {
      return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
    } catch {
      return false;
    }
  }

  /** @description Menu button: slides the menu in / out on mobile, collapses it on desktop (remembered). */
  toggleSidebar(): void {
    if (this.isMobileWidth()) {
      this.mobileNavOpen = !this.mobileNavOpen;
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      this.storeSidebarCollapsed(this.sidebarCollapsed);
    }
    this.cdr.markForCheck();
  }

  /** @description Closes the slid-in menu (overlay click, item picked). */
  closeMobileNav(): void {
    this.mobileNavOpen = false;
    this.cdr.markForCheck();
  }

  /** @description Remembered state of the collapsed menu (false when the storage is unavailable). */
  private readSidebarCollapsed(): boolean {
    try {
      return localStorage.getItem(PORTAL_SIDEBAR_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * @description Remembers the collapsed menu in this browser (nothing personal is stored).
   * @param collapsed New state.
   */
  private storeSidebarCollapsed(collapsed: boolean): void {
    try {
      localStorage.setItem(PORTAL_SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Storage unavailable - the menu simply starts expanded next time.
    }
  }

  // ── My account: e-mail and notifications ─────────────────────────────

  /**
   * @description Settings draft of an account (empty e-mail, Czech, all notifications off when unknown).
   * @param account Account of the API.
   */
  static settingsOf(account: PublicProject['account']): PortalAccountSettings {
    return {
      email: account?.email ?? '',
      language: account?.language ?? 'cz',
      notify_replies: !!account?.notify_replies,
      notify_checkpoint_status: !!account?.notify_checkpoint_status,
      notify_checkpoint_dates: !!account?.notify_checkpoint_dates,
      notify_updates: !!account?.notify_updates,
      notify_approvals: !!account?.notify_approvals,
    };
  }

  /** @description Puts the saved settings of the account into the form. */
  resetAccountSettings(): void {
    this.accountSettings = ProjectPortalComponent.settingsOf(this.project?.account);
    this.accountSaveResult = null;
    this.cdr.markForCheck();
  }

  /** @description The form differs from the saved settings. */
  get accountSettingsDirty(): boolean {
    return JSON.stringify(this.accountSettings) !== JSON.stringify(ProjectPortalComponent.settingsOf(this.project?.account));
  }

  /** @description Notifications need an e-mail - clearing it turns them all off in the form. */
  onAccountEmailChange(): void {
    if (!this.accountSettings.email.trim()) {
      for (const kind of PORTAL_NOTIFICATIONS) this.accountSettings[kind] = false;
    }
    this.accountSaveResult = null;
  }

  /**
   * @description Saves the own settings; the answer (project with the account) replaces the
   *   loaded one. A notification without an e-mail is refused already here.
   */
  saveAccountSettings(): void {
    if (!this.hasSession || this.accountSaving || !this.accountSettingsDirty) return;
    const settings = { ...this.accountSettings, email: this.accountSettings.email.trim() };
    if (!settings.email && PORTAL_NOTIFICATIONS.some(kind => settings[kind])) {
      this.accountSaveResult = 'email_required';
      this.cdr.markForCheck();
      return;
    }
    this.accountSaving = true;
    this.accountSaveResult = null;
    this.cdr.markForCheck();
    this.portalPost<PublicProject>(`projects/public/${this.token}/account`, settings)
      .pipe(finalize(() => { this.accountSaving = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (project) => {
          if (project) this.project = project;
          this.accountSettings = ProjectPortalComponent.settingsOf(this.project?.account);
          this.accountSaveResult = 'saved';
        },
        error: () => { this.accountSaveResult = 'error'; },
      });
  }

  /** @description Name of the signed-in account (header). */
  get accountName(): string {
    return this.project?.account?.display_name || this.project?.account?.username || '';
  }

  /** @description Initials of the signed-in account (avatar of the header). */
  get accountInitials(): string {
    const parts = this.accountName.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
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

  // ── Checkpoints ───────────────────────────────────────────────────────

  /**
   * @description Expands / collapses the description of a checkpoint.
   * @param id Checkpoint id.
   */
  toggleCheckpoint(id: number): void {
    if (this.expandedCheckpointIds.has(id)) this.expandedCheckpointIds.delete(id);
    else this.expandedCheckpointIds.add(id);
    this.cdr.markForCheck();
  }

  // ── Tabs ──────────────────────────────────────────────────────────────

  /**
   * @description Opens a section of the left menu: Contacts loads the company data once, Files
   *   loads the files fresh every time (their download links are signed and expire); on mobile the
   *   slid-in menu closes.
   * @param tab Section.
   */
  setActiveTab(tab: PortalTab): void {
    // Leaving the overview: its news have been seen (stored on the server), drop the highlight.
    if (this.activeTab === 'overview' && tab !== 'overview') this.clearNewHighlight();
    this.activeTab = tab;
    this.mobileNavOpen = false;
    if (tab === 'contacts' && !this.companySettings && !this.companySettingsLoading) {
      this.loadCompanySettings();
    }
    if (tab === 'files') {
      this.loadFiles();
    }
    if (tab === 'account') {
      this.resetAccountSettings();
    }
    if (tab === 'updates') {
      this.loadUpdates();
    }
    if (tab === 'approvals') {
      this.loadApprovals();
    }
    if (tab === 'overview') {
      this.markActivitySeen();
    }
    this.cdr.markForCheck();
  }

  /** @description Loads the files of all conversations (newest first, fresh signed links). */
  loadFiles(): void {
    if (!this.hasSession) return;
    this.filesLoading = true;
    this.filesError = false;
    this.cdr.markForCheck();
    this.portalGet<PortalFile[]>(`projects/public/${this.token}/files`)
      .pipe(finalize(() => { this.filesLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (files) => { this.files = Array.isArray(files) ? files : []; },
        error: () => { this.filesError = true; },
      });
  }

  /**
   * @description Opens the conversation of a file in the Communication section.
   * @param file File of the Files section.
   */
  /**
   * @description Text of the "where it comes from" link of a file in the Files section.
   * @param file File of the project.
   * @returns E.g. "Update: Design ready" or the subject of the thread.
   */
  fileSourceLabel(file: PortalFile): string {
    if (file.source === 'update') return `${this.t('file_source_update')}: ${file.source_title ?? ''}`;
    if (file.source === 'approval') return `${this.t('file_source_approval')}: ${file.source_title ?? ''}`;
    return file.thread_subject ?? file.source_title ?? '';
  }

  openFileThread(file: PortalFile): void {
    if (file.source === 'update' || file.source === 'approval') {
      this.setActiveTab(file.source === 'update' ? 'updates' : 'approvals');
      return;
    }
    const thread = this.threads.find(t => t.id === file.thread_id)
      ?? { id: file.thread_id ?? 0, subject: file.thread_subject ?? '', priority: 'medium', status: 'active', last_message_at: null };
    this.setActiveTab('threads');
    this.newThreadMode = false;
    this.openThread(thread);
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

  /** @description Active threads where the supplier waits for the client's answer. */
  get waitingOnYouCount(): number {
    return this.threads.filter(t => t.waiting_on === 'customer').length;
  }

  /** @description The step being worked on: the first one not done (null when all are done / none). */
  get currentCheckpoint(): ProjectCheckpoint | null {
    return this.project?.checkpoints?.find(c => c.status === 'active')
      ?? this.project?.checkpoints?.find(c => c.status !== 'done')
      ?? null;
  }

  // ── Labels of messages and threads ────────────────────────────────────

  /**
   * @description The message was written by the signed-in account.
   * @param msg Message.
   */
  isMine(msg: ProjectThreadMessage): boolean {
    const me = this.project?.account?.id;
    return msg.author_type === 'customer' && !!me && msg.author_account_id === me;
  }

  /**
   * @description Author shown above a message: "You", a colleague's name, the supplier's name.
   * @param msg Message.
   */
  authorName(msg: ProjectThreadMessage): string {
    if (msg.author_type === 'admin') return msg.author_label || this.t('author_supplier');
    if (this.isMine(msg)) return this.t('author_you');
    return msg.author_label || this.t('author_client');
  }

  /**
   * @description Translated priority of a thread.
   * @param priority low | medium | high | critic.
   */
  priorityLabel(priority: string): string {
    return this.t(`priority_${priority}`);
  }

  /**
   * @description "Waiting on you / on the supplier" of an active thread ('' when closed).
   * @param thread Thread.
   */
  waitingLabel(thread: ProjectThread): string {
    if (thread.waiting_on === 'customer') return this.t('waiting_on_you');
    if (thread.waiting_on === 'supplier') return this.t('waiting_on_supplier');
    return '';
  }

  /**
   * @description Date (Y-m-d) in the portal language, e.g. "24. prosince 2026" / "December 24, 2026".
   * @param iso Date.
   */
  formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString(
      this.portalI18n.getCurrentLanguage() === 'en' ? 'en-US' : 'cs-CZ',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
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
        next: (project) => this.enterPortal(project),
        error: () => {
          this.clearSession();
          this.state = 'login';
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * @description Shows the portal of a signed-in account: threads, news and approvals load, the
   *   thread list polling starts, a section asked for by the address opens.
   * @param project Project of the API (with the account).
   */
  private enterPortal(project: PublicProject): void {
    this.hasSession = true;
    this.project = project;
    this.state = 'portal';
    this.loginPassword = '';
    this.loginCode = '';
    this.loadThreads();
    this.loadActivity();
    this.loadApprovals();
    this.startGlobalThreadsPolling();
    if (this.requestedSection) {
      const section = this.requestedSection;
      this.requestedSection = null;
      this.setActiveTab(section);
    }
    this.cdr.markForCheck();
  }

  /**
   * @description Switches the login screen between password and e-mailed code.
   * @param mode Login mode.
   */
  setLoginMode(mode: PortalLoginMode): void {
    this.loginMode = mode;
    this.loginError = null;
    this.loginInfo = null;
    this.codeRequested = false;
    this.loginCode = '';
    this.cdr.markForCheck();
  }

  /**
   * @description Asks for a sign-in code to the e-mail of the login name / e-mail. The answer is
   *   the same whether the account exists or not.
   */
  requestCode(): void {
    if (!this.loginUsername.trim() || this.loginLoading) return;
    this.loginLoading = true;
    this.loginError = null;
    this.cdr.markForCheck();
    this.portalPost(`projects/public/${this.token}/login/code-request`, { identifier: this.loginUsername.trim() })
      .pipe(finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.codeRequested = true; this.loginInfo = 'login_code_sent'; },
        error: (err: any) => {
          this.loginError = err?.status === 404 ? 'error_project_not_found' : err?.status === 429 ? 'error_too_many_attempts' : 'error_code_request_failed';
        },
      });
  }

  /** @description Signs in with the code from the e-mail. */
  loginWithCode(): void {
    const code = this.loginCode.replace(/\s/g, '');
    if (!this.loginUsername.trim() || code.length < 6 || this.loginLoading) return;
    this.loginLoading = true;
    this.loginError = null;
    this.cdr.markForCheck();
    this.portalPost<{ project: PublicProject }>(`projects/public/${this.token}/login/code`, { identifier: this.loginUsername.trim(), code })
      .pipe(finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.loginInfo = null; this.enterPortal(res.project); },
        error: (err: any) => { this.loginError = err?.status === 429 ? 'error_too_many_attempts' : 'error_code_invalid'; },
      });
  }

  /**
   * @description Signs in with the one-time link of an e-mail and removes it from the address
   *   (it works once; a reload must not try it again).
   * @param link Link token of `?access=`.
   */
  private loginWithLink(link: string): void {
    this.state = 'loading';
    this.router.navigate([], { relativeTo: this.route, queryParams: { access: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.portalPost<{ project: PublicProject }>(`projects/public/${this.token}/login/link`, { link })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.enterPortal(res.project),
        error: (err: any) => {
          if (err?.status === 404) { this.state = 'invalid'; this.cdr.markForCheck(); return; }
          // A spent / expired link: an existing session still opens the portal, else the login with the reason.
          this.portalGet<PublicProject>(`projects/public/${this.token}`).pipe(takeUntil(this.destroy$)).subscribe({
            next: (project) => this.enterPortal(project),
            error: () => {
              this.clearSession();
              this.state = 'login';
              this.loginMode = 'code';
              this.loginError = 'error_link_invalid';
              this.cdr.markForCheck();
            },
          });
        },
      });
  }

  // ── What is new, updates, approvals ──────────────────────────────────

  /** @description Loads "What is new" with the number of unseen items. */
  loadActivity(): void {
    if (!this.hasSession) return;
    this.activityLoading = true;
    this.portalGetWithMeta<PortalActivityItem[], { unseen: number }>(`projects/public/${this.token}/activity`)
      .pipe(finalize(() => { this.activityLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.activity = Array.isArray(res.data) ? res.data : [];
          this.activityUnseen = res.meta?.unseen ?? 0;
          if (this.activeTab === 'overview' && this.activityUnseen > 0) this.markActivitySeen();
        },
        error: () => { /* the overview shows no news */ },
      });
  }

  /**
   * @description The client has seen the news (the overview is open): the badge goes away, the
   *   items stay highlighted while the overview stays open (a clicked one / leaving it clears them).
   */
  markActivitySeen(): void {
    if (!this.hasSession || this.activityUnseen === 0) return;
    this.activityUnseen = 0;
    this.portalPost(`projects/public/${this.token}/activity/seen`, {}).pipe(takeUntil(this.destroy$)).subscribe({ error: () => {} });
  }

  /** @description Removes the "new" highlight of all news items (new array - OnPush). */
  private clearNewHighlight(): void {
    if (!this.activity.some(item => item.is_new)) return;
    this.activity = this.activity.map(item => item.is_new ? { ...item, is_new: false } : item);
    this.cdr.markForCheck();
  }

  /**
   * @description Text of a news item ("New update", "Step changed to Done", …).
   * @param item News item.
   */
  activityLabel(item: PortalActivityItem): string {
    if (item.type === 'checkpoint') return this.t('news_checkpoint').replace('{status}', this.checkpointStatusLabels[item.detail ?? ''] ?? item.detail ?? '');
    if (item.type === 'approval_decided') return this.t('news_approval_' + item.detail);
    return this.t('news_' + item.type);
  }

  /**
   * @description Opens the section of a news item (a thread directly); the news count as seen and
   *   lose the "new" highlight right away, without a reload.
   * @param item News item.
   */
  openActivity(item: PortalActivityItem): void {
    this.markActivitySeen();
    const section = (['checkpoints', 'threads', 'approvals', 'updates'] as PortalTab[]).find(s => s === item.target.section) ?? 'overview';
    this.setActiveTab(section);
    if (section === 'threads' && item.target.id) {
      const thread = this.threads.find(t => t.id === item.target.id)
        ?? { id: item.target.id, subject: item.title, priority: 'medium', status: 'active', last_message_at: null };
      this.newThreadMode = false;
      this.openThread(thread);
    }
  }

  /** @description Loads the published updates of the supplier. */
  loadUpdates(): void {
    if (!this.hasSession) return;
    this.updatesLoading = true;
    this.cdr.markForCheck();
    this.portalGet<PortalUpdate[]>(`projects/public/${this.token}/updates`)
      .pipe(finalize(() => { this.updatesLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({ next: (rows) => { this.updates = Array.isArray(rows) ? rows : []; }, error: () => {} });
  }

  /** @description Loads the approval requests (pending first). */
  loadApprovals(): void {
    if (!this.hasSession) return;
    this.approvalsLoading = true;
    this.portalGet<PortalApproval[]>(`projects/public/${this.token}/approvals`)
      .pipe(finalize(() => { this.approvalsLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({ next: (rows) => { this.approvals = Array.isArray(rows) ? rows : []; }, error: () => {} });
  }

  /** @description Approval requests waiting for the client's decision (menu badge). */
  get pendingApprovalsCount(): number {
    return this.approvals.filter(a => a.status === 'pending').length;
  }

  /**
   * @description Opens / closes the "request changes" form of an approval.
   * @param approval Approval.
   */
  toggleChangesForm(approval: PortalApproval): void {
    this.changesFormId = this.changesFormId === approval.id ? null : approval.id;
    this.changesComment = '';
    this.decisionError = null;
    this.cdr.markForCheck();
  }

  /**
   * @description Sends the client's decision: approve, or request changes (a comment is required).
   * @param approval Pending approval.
   * @param decision approved | changes_requested
   */
  decide(approval: PortalApproval, decision: 'approved' | 'changes_requested'): void {
    if (!this.hasSession || this.decidingId !== null || approval.status !== 'pending') return;
    const comment = this.changesComment.trim();
    if (decision === 'changes_requested' && !comment) {
      this.decisionError = 'approval_comment_required';
      this.cdr.markForCheck();
      return;
    }
    this.decidingId = approval.id;
    this.decisionError = null;
    this.cdr.markForCheck();
    this.portalPost<PortalApproval>(`projects/public/${this.token}/approvals/${approval.id}/decision`, decision === 'approved' ? { decision } : { decision, comment })
      .pipe(finalize(() => { this.decidingId = null; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          this.approvals = this.approvals.map(a => (a.id === approval.id ? saved : a));
          this.changesFormId = null;
          this.changesComment = '';
        },
        error: () => {
          this.decisionError = 'approval_decision_failed';
          this.loadApprovals();
        },
      });
  }

  /** @description Translated state of an approval. */
  approvalStatusLabel(status: string): string {
    return this.t('approval_status_' + status);
  }

  login(): void {
    if (!this.loginUsername.trim() || !this.loginPassword.trim() || this.loginLoading) return;

    this.loginLoading = true;
    this.loginError = null;
    this.cdr.markForCheck();

    this.portalPost<{ project: PublicProject }>(
      `projects/public/${this.token}/login`,
      { username: this.loginUsername.trim(), password: this.loginPassword }
    ).pipe(
      finalize(() => { this.loginLoading = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => this.enterPortal(res.project),
      error: (err: any) => {
        this.loginError = err?.status === 404
          ? 'error_project_not_found'
          : err?.status === 429 ? 'error_too_many_attempts' : 'error_invalid_login';
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
    this.activeTab = 'overview';
    this.mobileNavOpen = false;
    this.expandedCheckpointIds.clear();
    this.companySettings = null;
    this.files = [];
    this.activity = [];
    this.activityUnseen = 0;
    this.updates = [];
    this.approvals = [];
    this.loginMode = 'password';
    this.codeRequested = false;
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
          this.loadActivity();
          this.loadApprovals();
          if (this.activeTab === 'files') this.loadFiles();
          if (this.activeTab === 'updates') this.loadUpdates();
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
        return this.portalGetWithMeta<ProjectThreadMessage[], { status: string; waiting_on?: ProjectThread['waiting_on'] }>(
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
        if (res.meta && 'waiting_on' in res.meta) this.selectedThread.waiting_on = res.meta.waiting_on;
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