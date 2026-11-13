/**
 * @file project-detail.component.ts
 * @path src/app/apps/project-portal/admin/project-detail/project-detail.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page of one client project (project-portal/projects/:id/:section) split into sub-pages with
 *   their own address and tabs: Overview (key numbers + what happened lately), Conversations,
 *   Progress (checkpoints, templates), Approvals, Updates, Access, Files and Settings. Contents:
 *   back to the list, the project settings (name, assignee, lead, contacts, dates,
 *   visibility, status - editable inline with a floating save bar), access to the client portal
 *   (link + client accounts: add with a typed-in or generated password, edit, password reset,
 *   removal, e-mail notifications), checkpoints (due date, internal note, order), the files of all
 *   conversations, and the conversations with the client of THIS project (threads with unread
 *   badges and "waiting on us / on the client", assignee of a thread, messages with "read by the
 *   client", reply or internal note with attachments, thread status), client accounts with
 *   invitations, approvals and updates (child components). New client messages are shown as badges
 *   (header, thread list) and the list refreshes every minute.
 * @note The texts are the admin language (section `projects`) - the project data itself is one
 *   language. Opening a thread marks it read for the administration (API). A password of a client
 *   account is shown once after it was set (memory only, VT-08); leaving with an uncopied password
 *   or unsaved settings asks first. Internal notes and checkpoint notes never reach the client.
 * @dependencies DataHandler (project-portal/projects, …/projects/:id/accounts, …/projects/:id/files,
 *   …/projects/assignees, project-portal/project-threads), AdminLocalizationService, PermissionService
 *   (web-projects-update), AlertDialogService, ConfirmDialogService, UploadRulesService (profile
 *   project_thread), Router.
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, interval, map } from 'rxjs';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../../core/auth/services/permission.service';
import { UploadRulesService } from '../../../../shared/services/upload-rules.service';
import { UploadRule, extensionsLabel, fileExtension, isExtensionAllowed } from '../../../../shared/utils/upload-rules';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { StickyBarDirective } from '../../../../shared/directives/sticky-bar.directive';
import { PageHelpComponent } from '../../../../admin/components/page-help/page-help.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import * as Config from '../projects/projects.config';
import { ProjectApprovalsSectionComponent } from './project-approvals-section.component';
import { ProjectUpdatesSectionComponent } from './project-updates-section.component';

/** @description Checkpoint of a project. */
export interface ProjectCheckpoint {
  id: number;
  /** Title of the checkpoint. */
  label: string;
  /** What the checkpoint covers - shown to the client in the portal when expanded. */
  description?: string | null;
  /** Planned date (Y-m-d) - shown to the client. */
  due_date?: string | null;
  /** Note of the team - never shown to the client. */
  internal_note?: string | null;
  status: 'new' | 'active' | 'done';
  sort_order: number;
}

/** @description Client account of the project portal (login name + password set by the administration). */
export interface ProjectAccount {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  /** Notifications the client chose in the portal (read-only here, all off by default). */
  notify_replies: boolean;
  notify_checkpoint_status: boolean;
  notify_checkpoint_dates: boolean;
  notify_updates?: boolean;
  notify_approvals?: boolean;
  /** The account can sign in with a password (else only by an e-mailed code / link). */
  has_password?: boolean;
  /** The e-mail was proven by a code / link. */
  email_verified_at?: string | null;
  /** Last invitation e-mail. */
  invited_at?: string | null;
  /** Language of those e-mails. */
  language: 'cz' | 'en';
  password_set_at: string | null;
  last_login_at: string | null;
  /** Signed-in devices. */
  active_sessions?: number;
}

/** @description Draft of the account form (add / edit). */
export interface ProjectAccountDraft {
  username: string;
  display_name: string;
  /** Prefilled for the client (who confirms it by turning notifications on in the portal). */
  email: string;
  language: 'cz' | 'en';
  /** Typed-in password of a new account; empty = generated by the API. */
  password: string;
  /** New account: set a password (typed in or generated). */
  with_password?: boolean;
  /** New account: e-mail an invitation with a one-time sign-in link. */
  send_invitation?: boolean;
}

/** @description Password of a client account shown once after it was set (memory only, VT-08). */
export interface RevealedAccountPassword {
  accountId: number;
  username: string;
  password: string;
}

/** @description File of a conversation (Files card). */
export interface ProjectFile {
  id: number;
  original_filename: string;
  size_bytes: number;
  download_url: string;
  /** Where the file comes from: a thread message, an update, an approval request. */
  source?: 'thread' | 'update' | 'approval';
  source_id?: number | null;
  source_title?: string | null;
  thread_id: number | null;
  thread_subject: string | null;
  author_type: 'customer' | 'admin';
  author_label: string | null;
  /** Attachment of an internal note (never shown to the client). */
  is_internal: boolean;
  created_at: string;
}

/** @description Item of the activity of a project (overview). */
export interface ProjectActivityItem {
  type: 'client_message' | 'approval_decided' | 'approval_requested' | 'update' | 'checkpoint' | 'reply';
  at: string;
  title: string;
  detail: string | null;
  actor?: string | null;
  target: { section: string; id: number | null };
}

/** @description Template of a project (Progress: add its checkpoints). */
export interface ProjectTemplateOption {
  id: number;
  name: string;
  checkpoints: { label: string }[];
}

/** @description Sub-pages of the project page (own address project-portal/projects/:id/:section). */
export type ProjectSection = 'overview' | 'conversations' | 'progress' | 'approvals' | 'updates' | 'access' | 'files' | 'settings';

/** @description Sub-pages in the order of the tabs. */
export const PROJECT_SECTIONS: ProjectSection[] = ['overview', 'conversations', 'progress', 'approvals', 'updates', 'access', 'files', 'settings'];

/** @description Attachment of a thread message. */
export interface ProjectAttachment {
  id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number;
  download_url: string;
  view_url: string | null;
}

/** @description Message of a thread. */
export interface ProjectThreadMessage {
  id: number;
  author_type: 'customer' | 'admin';
  author_label: string | null;
  /** Client account that wrote the message. */
  author_account_id?: number | null;
  /** Internal note of the team - never shown to the client. */
  is_internal?: boolean;
  body: string;
  attachments?: ProjectAttachment[];
  created_at: string;
}

/** @description Thread (request) of the client. */
export interface ProjectThread {
  id: number;
  project_id?: number;
  subject: string;
  priority: string;
  status: string;
  last_message_at: string | null;
  /** Client messages the administration has not read yet. */
  admin_unread_count?: number;
  /** Whose turn it is in an active thread: 'supplier' (us) | 'customer' | null (closed). */
  waiting_on?: 'supplier' | 'customer' | null;
  /** Administrator responsible for the thread. */
  assignee_id?: number | null;
  assignee_name?: string | null;
  /** When the client last read the thread ("read by the client" of our messages). */
  customer_last_read_at?: string | null;
  has_more_older_messages?: boolean;
  messages?: ProjectThreadMessage[];
}

/** @description Thread list filter. */
export type ThreadFilter = 'active' | 'closed' | 'all' | 'mine';

/** @description Seconds between two automatic refreshes of the thread list. */
export const THREAD_REFRESH_SECONDS = 60;

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, StickyBarDirective, PageHelpComponent, IconComponent,
    ProjectApprovalsSectionComponent, ProjectUpdatesSectionComponent,
  ],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css', './project-sections.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailComponent implements OnInit {
  @ViewChild('messageList') messageList?: ElementRef<HTMLDivElement>;

  private readonly dataHandler = inject(DataHandler);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly alert = inject(AlertDialogService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly uploadRulesService = inject(UploadRulesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  projectId = 0;
  project: any | null = null;
  loading = true;
  notFound = false;

  /** Editable fields of the project (the edit fields of the table form, no realisation link). */
  fields: InputDefinition[] = [];
  form: Record<string, any> = {};
  private original: Record<string, any> = {};
  saving = false;

  checkpoints: ProjectCheckpoint[] = [];
  checkpointStatusLabels: Record<string, string> = {};
  /** Statuses offered in the checkpoint dropdown, in their natural order. */
  readonly checkpointStatuses = Config.CHECKPOINT_STATUS_VALUES;
  newCheckpointLabel = '';
  newCheckpointDescription = '';
  newCheckpointDueDate = '';
  newCheckpointNote = '';
  /** The form of a new checkpoint is open. */
  addingCheckpoint = false;
  checkpointBusyIds = new Set<number>();
  /** Checkpoint whose title / description is being edited (one at a time), with its draft. */
  editingCheckpointId: number | null = null;
  checkpointDraft = { label: '', description: '', due_date: '', internal_note: '' };
  /** A new checkpoint order is being saved. */
  checkpointsReordering = false;

  /** Administrators who can be responsible for the project (assignee select). */
  private assignees: { id: number; full_name: string }[] = [];

  accounts: ProjectAccount[] = [];
  accountsLoading = false;
  /** Account form: 'add' a new one, 'edit' the account `editingAccountId`, null closed. */
  accountFormMode: 'add' | 'edit' | null = null;
  editingAccountId: number | null = null;
  accountDraft: ProjectAccountDraft = ProjectDetailComponent.emptyAccountDraft();
  accountSaving = false;
  /** Account whose password is being reset / which is being removed. */
  accountBusyId: number | null = null;
  /** Languages of the notification e-mails. */
  readonly accountLanguages: ProjectAccount['language'][] = ['cz', 'en'];

  revealedPassword: RevealedAccountPassword | null = null;
  passwordVisible = false;
  passwordCopied = false;

  files: ProjectFile[] = [];
  filesLoading = false;

  threads: ProjectThread[] = [];
  threadsLoading = false;
  threadFilter: ThreadFilter = 'active';
  selectedThread: ProjectThread | null = null;
  threadLoading = false;
  olderMessagesLoading = false;
  replyBody = '';
  replySending = false;
  replyFiles: File[] = [];
  replyFileError: string | null = null;
  /** The reply is an internal note of the team (never shown to the client, no e-mail). */
  replyInternal = false;

  attachmentRules: UploadRule | null = null;

  /** Sub-pages in the order of the tabs. */
  readonly sections = PROJECT_SECTIONS;
  /** The sub-page shown (from the address). */
  section: ProjectSection = 'overview';
  /** Activity of the project (Overview). */
  activity: ProjectActivityItem[] = [];
  activityLoading = false;
  /** Threads assigned to the signed-in administrator (filter "Mine"). */
  myThreadIds = new Set<number>();
  /** Account whose invitation is being sent. */
  invitingAccountId: number | null = null;
  /** Templates offered in Progress ("add checkpoints from a template"). */
  templates: ProjectTemplateOption[] = [];
  /** Progress: the form "add from a template" / "save as a template" is open. */
  templateAction: 'apply' | 'save' | null = null;
  templateDraft = { template_id: '', start_date: '', name: '' };
  templateBusy = false;

  /** @description Text of the section `projects` in the admin language. */
  t(key: string): string {
    return this.i18n.getValue(`projects.${key}`);
  }

  /** @description Empty draft of the account form (Czech e-mails, notifications off, generated password). */
  static emptyAccountDraft(): ProjectAccountDraft {
    return { username: '', display_name: '', email: '', language: 'cz', password: '', with_password: true, send_invitation: false };
  }

  /** @description May the user change the project (settings, accounts, checkpoints, replies)? */
  get canEdit(): boolean {
    return this.permissions.hasPermission('web-projects-update');
  }

  /** @description Settings changed and not saved yet. */
  get dirty(): boolean {
    return JSON.stringify(this.form) !== JSON.stringify(this.original);
  }

  /** @description Client messages not read by the administration over all threads. */
  get unreadTotal(): number {
    return this.threads.reduce((sum, thread) => sum + (thread.admin_unread_count ?? 0), 0);
  }

  /** @description Threads of the selected filter (active first by the API order: newest activity). */
  get visibleThreads(): ProjectThread[] {
    if (this.threadFilter === 'mine') return this.threads.filter(thread => this.myThreadIds.has(thread.id));
    return this.threadFilter === 'all' ? this.threads : this.threads.filter(thread => thread.status === this.threadFilter);
  }

  /** @description Number of threads of a filter (filter chips). */
  threadCount(filter: ThreadFilter): number {
    if (filter === 'mine') return this.threads.filter(thread => this.myThreadIds.has(thread.id)).length;
    return filter === 'all' ? this.threads.length : this.threads.filter(thread => thread.status === filter).length;
  }

  /** @description Maximum number of attachments of one reply (fallback 5 while not loaded). */
  get maxAttachments(): number {
    return this.attachmentRules?.max_files ?? 5;
  }

  /** @description Maximum size of one attachment in MB (fallback 15). */
  get maxAttachmentSizeMb(): number {
    return this.attachmentRules?.max_file_size_mb ?? 15;
  }

  ngOnInit(): void {
    this.projectId = Number(this.route.snapshot.paramMap.get('id'));
    // The sub-page changes without a new component (same project) - follow the address.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => this.showSection(params.get('section')));
    this.i18n.translations$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.fields = Config.createProjectFormFields(this.i18n)
        .filter(field => field.show_in_edit !== false && field.column_name !== 'order_id');
      this.applyAssigneeOptions();
      this.checkpointStatusLabels = Config.createCheckpointStatusLabels(this.i18n);
      this.cd.markForCheck();
    });
    this.uploadRulesService.rules('project_thread')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(rules => { this.attachmentRules = rules; this.cd.markForCheck(); });

    if (!Number.isInteger(this.projectId) || this.projectId <= 0) {
      this.loading = false;
      this.notFound = true;
      return;
    }
    this.loadProject();
    this.loadAccounts();
    this.loadAssignees();
    this.loadFiles();
    this.loadThreads();
    this.loadMyThreads();
    interval(THREAD_REFRESH_SECONDS * 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadThreads(true));
  }

  // ── Sub-pages ─────────────────────────────────────────────────────────

  /**
   * @description Shows the sub-page of the address (unknown / none = overview) and loads what
   *   it needs fresh (activity of the overview, templates of the progress).
   * @param section Section of the address.
   */
  showSection(section: string | null): void {
    this.section = (PROJECT_SECTIONS as string[]).includes(section ?? '') ? section as ProjectSection : 'overview';
    if (this.projectId > 0) {
      if (this.section === 'overview') this.loadActivity();
      if (this.section === 'progress' && this.templates.length === 0) this.loadTemplates();
      if (this.section === 'files') this.loadFiles();
    }
    this.cd.markForCheck();
  }

  /** @description Label of a tab. */
  sectionLabel(section: ProjectSection): string {
    return this.t('section_' + section);
  }

  /**
   * @description Number shown on a tab (unread messages, pending approvals, accounts) - 0 = none.
   * @param section Tab.
   */
  sectionBadge(section: ProjectSection): number {
    if (section === 'conversations') return this.unreadTotal;
    if (section === 'approvals') return this.project?.pending_approvals_count ?? 0;
    return 0;
  }

  /** @description Loads what happened lately (team view). */
  loadActivity(): void {
    this.activityLoading = true;
    this.cd.markForCheck();
    this.dataHandler.getCollection<ProjectActivityItem>(`project-portal/projects/${this.projectId}/activity`).subscribe({
      next: (items) => { this.activity = Array.isArray(items) ? items : []; this.activityLoading = false; this.cd.markForCheck(); },
      error: () => { this.activityLoading = false; this.cd.markForCheck(); },
    });
  }

  /**
   * @description Text of an activity item ("Client wrote in …", "Approved: …").
   * @param item Activity item.
   */
  activityLabel(item: ProjectActivityItem): string {
    const key = item.type === 'approval_decided' ? `activity_approval_${item.detail}` : `activity_${item.type}`;
    return this.t(key);
  }

  /**
   * @description Opens the sub-page of an activity item (a thread directly).
   * @param item Activity item.
   */
  openActivity(item: ProjectActivityItem): void {
    const section = ({ threads: 'conversations', checkpoints: 'progress', approvals: 'approvals', updates: 'updates' } as Record<string, ProjectSection>)[item.target.section] ?? 'overview';
    this.router.navigate(['/admin/project-portal/projects', this.projectId, section]);
    if (section === 'conversations' && item.target.id) {
      const thread = this.threads.find(t => t.id === item.target.id);
      if (thread) this.openThread(thread);
    }
  }

  // ── Project + settings ────────────────────────────────────────────────

  /** @description Loads the project (settings, checkpoints, access). */
  loadProject(): void {
    this.dataHandler.get<any>(`project-portal/projects/${this.projectId}`).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.applyAssigneeOptions();
        this.loading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.notFound = true;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Takes the project of the API and resets the form to it. */
  private applyProject(project: any): void {
    this.project = project;
    this.checkpoints = project?.checkpoints ?? this.checkpoints;
    const form: Record<string, any> = {};
    for (const field of Config.createProjectFormFields(this.i18n)) {
      if (field.column_name === 'order_id') continue;
      const value = project?.[field.column_name] ?? '';
      // Select options are strings - an id (assignee) must match its option.
      form[field.column_name] = field.type === 'select' && typeof value === 'number' ? String(value) : value;
    }
    this.form = form;
    this.original = { ...form };
  }

  /** @description Loads the possible assignees once (GET project-portal/projects/assignees). */
  private loadAssignees(): void {
    this.dataHandler.getCollection<{ id: number; full_name: string }>('project-portal/projects/assignees').subscribe({
      next: (users) => {
        this.assignees = users ?? [];
        this.applyAssigneeOptions();
        this.cd.markForCheck();
      },
      error: () => { /* the select offers only "—" */ },
    });
  }

  /**
   * @description Puts the assignees into the assignee select of the settings (the empty "—"
   *   option is added by the template). A saved assignee who cannot be picked any more (blocked,
   *   lost the permission) stays visible under the stored name.
   */
  private applyAssigneeOptions(): void {
    const field = this.fields.find(f => f.column_name === 'assignee_id');
    if (!field) return;
    const options = this.assignees.map(user => ({ value: String(user.id), label: user.full_name }));
    const current = this.project?.assignee_id;
    if (current && !this.assignees.some(user => user.id === current)) {
      options.push({ value: String(current), label: this.project?.assignee_name ?? `#${current}` });
    }
    field.options = options;
  }

  /** @description Restores the saved settings. */
  discardChanges(): void {
    this.form = { ...this.original };
    this.cd.markForCheck();
  }

  /** @description Saves the changed settings (empty values as null; only the changed fields). */
  saveSettings(): void {
    if (!this.canEdit || !this.dirty || this.saving) return;
    // Required fields (name, visibility) must not be cleared - the API would refuse it anyway.
    if (this.fields.some(field => field.required && String(this.form[field.column_name] ?? '').trim() === '')) return;
    const payload: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.form)) {
      if (value !== this.original[key]) payload[key] = typeof value === 'string' && value.trim() === '' ? null : value;
    }
    this.saving = true;
    this.cd.markForCheck();
    this.dataHandler.put<any>(`project-portal/projects/${this.projectId}`, payload).subscribe({
      next: (project) => {
        this.saving = false;
        this.applyProject({ ...project, unread_messages_count: this.project?.unread_messages_count });
        this.applyAssigneeOptions();
        this.alert.open(this.i18n.getValue('shared.success'), this.t('project_updated_message'), 'success');
        this.cd.markForCheck();
      },
      error: () => {
        // DataHandler.handleError() already showed the reason.
        this.saving = false;
        this.cd.markForCheck();
      },
    });
  }

  // ── Leaving the page ──────────────────────────────────────────────────

  /**
   * @description Back to the project list - asks first when the settings are not saved or a
   *   one-time password was not copied (it is stored nowhere).
   */
  async goBack(): Promise<void> {
    if (this.dirty && !(await this.confirm.open(this.t('detail_unsaved_title'), this.t('detail_unsaved_message')))) return;
    if (this.revealedPassword && !this.passwordCopied
      && !(await this.confirm.open(this.t('close_uncopied_password_title'), this.t('close_uncopied_password_message')))) return;
    this.revealedPassword = null;
    this.router.navigate(['/admin/project-portal/projects']);
  }

  /** @description Reloading / closing the tab with unsaved settings or an uncopied password asks the browser. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty || (this.revealedPassword && !this.passwordCopied)) {
      event.preventDefault();
    }
  }

  // ── Access: link + client accounts ───────────────────────────────────

  copyPublicUrl(): void {
    const url = this.project?.public_url;
    if (!url) return;
    navigator.clipboard?.writeText(url);
    this.alert.open(this.t('copied_title'), this.t('url_copied_message'), 'success');
  }

  /** @description Loads the client accounts of the project (oldest first). */
  loadAccounts(): void {
    this.accountsLoading = true;
    this.dataHandler.getCollection<ProjectAccount>(`project-portal/projects/${this.projectId}/accounts`).subscribe({
      next: (accounts) => {
        this.accounts = Array.isArray(accounts) ? accounts : [];
        this.accountsLoading = false;
        this.cd.markForCheck();
      },
      error: () => { this.accountsLoading = false; this.cd.markForCheck(); },
    });
  }

  /** @description Opens the form of a new account (password generated unless one is typed in). */
  openAddAccount(): void {
    if (!this.canEdit) return;
    this.accountFormMode = 'add';
    this.editingAccountId = null;
    this.accountDraft = ProjectDetailComponent.emptyAccountDraft();
  }

  /**
   * @description Opens the form of an existing account (its password is not part of it - a new
   *   one is set by "Reset password").
   * @param account Account of the row.
   */
  openEditAccount(account: ProjectAccount): void {
    if (!this.canEdit) return;
    this.accountFormMode = 'edit';
    this.editingAccountId = account.id;
    this.accountDraft = {
      username: account.username, display_name: account.display_name, email: account.email ?? '',
      language: account.language, password: '',
    };
  }

  /** @description Closes the account form without saving. */
  cancelAccountForm(): void {
    this.accountFormMode = null;
    this.editingAccountId = null;
    this.accountDraft = ProjectDetailComponent.emptyAccountDraft();
  }

  /**
   * @description Login name (3+) and display name are filled; a new account has a way to sign in
   *   (a password, or an invitation to its e-mail).
   */
  get accountDraftValid(): boolean {
    const draft = this.accountDraft;
    const basics = draft.username.trim().length >= 3 && draft.display_name.trim() !== '';
    if (!basics || this.accountFormMode !== 'add') return basics;
    const invite = !!draft.send_invitation && draft.email.trim() !== '';
    return !!draft.with_password || invite;
  }

  /** @description E-mail cleared - an invitation is not possible any more. */
  onAccountEmailChange(): void {
    if (!this.accountDraft.email.trim()) this.accountDraft.send_invitation = false;
  }

  /**
   * @description Notifications the client turned on in the portal (labels for the account row).
   * @param account Account of the row.
   * @return Translated kinds; empty when none is on.
   */
  accountNotifications(account: ProjectAccount): string[] {
    const kinds: [keyof ProjectAccount, string][] = [
      ['notify_replies', 'account_notify_replies'],
      ['notify_checkpoint_status', 'account_notify_checkpoint_status'],
      ['notify_checkpoint_dates', 'account_notify_checkpoint_dates'],
      ['notify_updates', 'account_notify_updates'],
      ['notify_approvals', 'account_notify_approvals'],
    ];
    return kinds.filter(([flag]) => !!account[flag]).map(([, key]) => this.t(key));
  }

  /**
   * @description Saves the account form: a new account shows its password once (typed in or
   *   generated); a change sends only the changed fields. The API validates (login name format and
   *   uniqueness, password policy) and DataHandler shows its reason.
   */
  saveAccount(): void {
    if (!this.canEdit || this.accountSaving || !this.accountDraftValid) return;
    const draft = this.accountDraft;
    const fields: Record<string, string | boolean | null> = {
      username: draft.username.trim().toLowerCase(),
      display_name: draft.display_name.trim(),
      email: draft.email.trim() || null,
      language: draft.language,
    };
    this.accountSaving = true;
    this.cd.markForCheck();

    if (this.accountFormMode === 'add') {
      fields['with_password'] = !!draft.with_password;
      fields['send_invitation'] = !!draft.send_invitation && !!fields['email'];
      if (draft.with_password && draft.password) fields['password'] = draft.password;
      this.dataHandler.postWithMeta<ProjectAccount, { password: string | null; invited: boolean }>(`project-portal/projects/${this.projectId}/accounts`, fields).subscribe({
        next: (res) => {
          this.accounts = [...this.accounts, res.data];
          this.revealPassword(res.data, res.meta?.password ?? undefined);
          if (res.meta?.invited) {
            this.alert.open(this.i18n.getValue('shared.success'), this.t('account_invite_sent').replace('{email}', res.data.email ?? ''), 'success');
          } else if (fields['send_invitation']) {
            this.alert.open(this.t('account_invite_failed_title'), this.t('account_invite_failed_message'), 'danger');
          }
          this.finishAccountSave();
        },
        error: () => { this.accountSaving = false; this.cd.markForCheck(); },
      });
      return;
    }

    const account = this.accounts.find(a => a.id === this.editingAccountId);
    if (!account) { this.finishAccountSave(); return; }
    const changed: Record<string, string | boolean | null> = {};
    for (const [key, value] of Object.entries(fields)) {
      const saved = (account as any)[key] ?? null;
      if (value !== saved) changed[key] = value;
    }
    if (Object.keys(changed).length === 0) { this.finishAccountSave(); return; }
    this.dataHandler.put<ProjectAccount>(`project-portal/projects/${this.projectId}/accounts/${account.id}`, changed).subscribe({
      next: (updated) => {
        this.accounts = this.accounts.map(a => (a.id === account.id ? { ...a, ...updated } : a));
        this.finishAccountSave();
      },
      error: () => { this.accountSaving = false; this.cd.markForCheck(); },
    });
  }

  /** @description Closes the account form after a successful save. */
  private finishAccountSave(): void {
    this.accountSaving = false;
    this.cancelAccountForm();
    this.cd.markForCheck();
  }

  /**
   * @description Sets a new (generated) password of an account after a confirmation - the client
   *   is signed out everywhere; the new password is shown once to be sent to the client.
   * @param account Account of the row.
   */
  async resetAccountPassword(account: ProjectAccount): Promise<void> {
    if (!this.canEdit || this.accountBusyId !== null) return;
    const confirmed = await this.confirm.open(this.t('account_reset_confirm_title'),
      this.t('account_reset_confirm_message').replace('{name}', account.display_name));
    if (!confirmed) return;
    this.accountBusyId = account.id;
    this.cd.markForCheck();
    this.dataHandler.postWithMeta<ProjectAccount, { password: string; ended_sessions: number }>(
      `project-portal/projects/${this.projectId}/accounts/${account.id}/password`, {},
    ).subscribe({
      next: (res) => {
        this.accountBusyId = null;
        this.accounts = this.accounts.map(a => (a.id === account.id ? { ...a, ...res.data, active_sessions: 0 } : a));
        this.revealPassword(res.data ?? account, res.meta?.password);
        this.cd.markForCheck();
      },
      error: () => { this.accountBusyId = null; this.cd.markForCheck(); },
    });
  }

  /**
   * @description Removes an account after a confirmation; its messages stay in the conversations.
   * @param account Account of the row.
   */
  async removeAccount(account: ProjectAccount): Promise<void> {
    if (!this.canEdit || this.accountBusyId !== null) return;
    const confirmed = await this.confirm.open(this.t('account_remove_confirm_title'),
      this.t('account_remove_confirm_message').replace('{name}', account.display_name));
    if (!confirmed) return;
    this.accountBusyId = account.id;
    this.cd.markForCheck();
    this.dataHandler.delete(`project-portal/projects/${this.projectId}/accounts/${account.id}`).subscribe({
      next: () => {
        this.accountBusyId = null;
        this.accounts = this.accounts.filter(a => a.id !== account.id);
        if (this.revealedPassword?.accountId === account.id) this.revealedPassword = null;
        this.cd.markForCheck();
      },
      error: () => { this.accountBusyId = null; this.cd.markForCheck(); },
    });
  }

  /**
   * @description Shows a just set password once (replaces any previous one).
   * @param account Account of the password.
   * @param password Plaintext password of the API answer.
   */
  private revealPassword(account: ProjectAccount, password: string | undefined): void {
    if (!password) return;
    this.revealedPassword = { accountId: account.id, username: account.username, password };
    this.passwordVisible = true;
    this.passwordCopied = false;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  copyPassword(): void {
    if (!this.revealedPassword) return;
    navigator.clipboard?.writeText(this.revealedPassword.password);
    this.passwordCopied = true;
    this.alert.open(this.t('copied_title'), this.t('password_copied_message'), 'success');
  }

  /**
   * @description Copies everything the client needs to sign in (link, login name, password) as one
   *   text to paste into a message for the client.
   */
  copyAccessDetails(): void {
    if (!this.revealedPassword) return;
    const text = this.t('access_details_text')
      .replace('{url}', this.project?.public_url ?? '')
      .replace('{username}', this.revealedPassword.username)
      .replace('{password}', this.revealedPassword.password);
    navigator.clipboard?.writeText(text);
    this.passwordCopied = true;
    this.alert.open(this.t('copied_title'), this.t('access_details_copied_message'), 'success');
  }

  /** @description Hides the shown password (asks first when it was not copied - it is stored nowhere). */
  async dismissPassword(): Promise<void> {
    if (!this.revealedPassword) return;
    if (!this.passwordCopied
      && !(await this.confirm.open(this.t('close_uncopied_password_title'), this.t('close_uncopied_password_message')))) return;
    this.revealedPassword = null;
    this.cd.markForCheck();
  }

  /**
   * @description (Re)sends the invitation e-mail with a one-time sign-in link (7 days).
   * @param account Account with an e-mail.
   */
  async inviteAccount(account: ProjectAccount): Promise<void> {
    if (!this.canEdit || !account.email || this.invitingAccountId !== null) return;
    const confirmed = await this.confirm.open(this.t('account_invite_confirm_title'),
      this.t('account_invite_confirm_message').replace('{name}', account.display_name).replace('{email}', account.email));
    if (!confirmed) return;
    this.invitingAccountId = account.id;
    this.cd.markForCheck();
    this.dataHandler.post<ProjectAccount>(`project-portal/projects/${this.projectId}/accounts/${account.id}/invite`, {}).subscribe({
      next: (updated) => {
        this.invitingAccountId = null;
        this.accounts = this.accounts.map(a => (a.id === account.id ? { ...a, ...updated } : a));
        this.alert.open(this.i18n.getValue('shared.success'), this.t('account_invite_sent').replace('{email}', account.email ?? ''), 'success');
        this.cd.markForCheck();
      },
      error: () => { this.invitingAccountId = null; this.cd.markForCheck(); },
    });
  }

  /**
   * @description How an account signs in (chips of the row): password, invitation, verified e-mail.
   * @param account Account of the row.
   */
  accountAccess(account: ProjectAccount): string[] {
    const chips: string[] = [];
    chips.push(account.has_password === false ? this.t('account_no_password') : this.t('account_with_password'));
    if (account.email_verified_at) chips.push(this.t('account_email_verified'));
    else if (account.invited_at) chips.push(this.t('account_invited'));
    return chips;
  }

  // ── Files of the conversations ────────────────────────────────────────

  /** @description Loads every file of the project's conversations (signed links, newest first). */
  loadFiles(): void {
    this.filesLoading = true;
    this.cd.markForCheck();
    this.dataHandler.getCollection<ProjectFile>(`project-portal/projects/${this.projectId}/files`).subscribe({
      next: (files) => {
        this.files = Array.isArray(files) ? files : [];
        this.filesLoading = false;
        this.cd.markForCheck();
      },
      error: () => { this.filesLoading = false; this.cd.markForCheck(); },
    });
  }

  /**
   * @description Opens the thread of a file.
   * @param file File of the Files card.
   */
  openFileThread(file: ProjectFile): void {
    if (file.source === 'update' || file.source === 'approval') {
      this.router.navigate(['/admin/project-portal/projects', this.projectId, file.source === 'update' ? 'updates' : 'approvals']);
      return;
    }
    const thread = this.threads.find(t => t.id === file.thread_id);
    if (!thread) return;
    if (thread.status !== this.threadFilter && this.threadFilter !== 'all') this.threadFilter = 'all';
    this.router.navigate(['/admin/project-portal/projects', this.projectId, 'conversations']);
    this.openThread(thread);
  }

  /**
   * @description Title of the source of a file (thread subject / update / approval title).
   * @param file File of the Files sub-page.
   */
  fileSourceLabel(file: ProjectFile): string {
    const title = file.source_title ?? file.thread_subject ?? '';
    if (file.source === 'update') return this.t('file_source_update') + ': ' + title;
    if (file.source === 'approval') return this.t('file_source_approval') + ': ' + title;
    return title;
  }

  // ── Templates (Progress) ──────────────────────────────────────────────

  /** @description Loads the templates offered in Progress. */
  loadTemplates(): void {
    this.dataHandler.getCollection<ProjectTemplateOption>('project-portal/projects/templates').subscribe({
      next: (templates) => { this.templates = Array.isArray(templates) ? templates : []; this.cd.markForCheck(); },
      error: () => { /* the action shows "no templates" */ },
    });
  }

  /**
   * @description Opens / closes the template form of Progress.
   * @param action 'apply' (add checkpoints of a template) | 'save' (save the checkpoints as a template) | null.
   */
  openTemplateAction(action: 'apply' | 'save' | null): void {
    if (action !== null && !this.canEdit) return;
    this.templateAction = action;
    this.templateDraft = { template_id: '', start_date: ProjectDetailComponent.localToday(), name: this.project?.name ?? '' };
    this.cd.markForCheck();
  }

  /** @description Adds the checkpoints of the picked template (due dates from the start date). */
  applyTemplate(): void {
    const templateId = Number(this.templateDraft.template_id);
    if (!this.canEdit || !templateId || this.templateBusy) return;
    this.templateBusy = true;
    this.cd.markForCheck();
    this.dataHandler.postWithMeta<ProjectCheckpoint[], { added: number }>(`project-portal/projects/${this.projectId}/apply-template`, {
      template_id: templateId, start_date: this.templateDraft.start_date || null,
    }).subscribe({
      next: (res) => {
        this.templateBusy = false;
        this.checkpoints = Array.isArray(res.data) ? res.data : this.checkpoints;
        this.templateAction = null;
        this.alert.open(this.i18n.getValue('shared.success'), this.t('template_applied').replace('{count}', String(res.meta?.added ?? 0)), 'success');
        this.cd.markForCheck();
      },
      error: () => { this.templateBusy = false; this.cd.markForCheck(); },
    });
  }

  /** @description Saves the checkpoints of the project as a new template. */
  saveAsTemplate(): void {
    const name = this.templateDraft.name.trim();
    if (!this.canEdit || !name || this.templateBusy || this.checkpoints.length === 0) return;
    this.templateBusy = true;
    this.cd.markForCheck();
    this.dataHandler.post<ProjectTemplateOption>(`project-portal/projects/${this.projectId}/template`, { name }).subscribe({
      next: (template) => {
        this.templateBusy = false;
        this.templateAction = null;
        if (template) this.templates = [...this.templates, template];
        this.alert.open(this.i18n.getValue('shared.success'), this.t('template_saved').replace('{name}', name), 'success');
        this.cd.markForCheck();
      },
      error: () => { this.templateBusy = false; this.cd.markForCheck(); },
    });
  }

  /**
   * @description Approvals / updates changed in a child component - refresh the counts and files.
   */
  onChildChanged(): void {
    this.loadProjectCounts();
    this.loadFiles();
  }

  /** @description Reloads the counts of the project (tabs) without touching the settings form. */
  private loadProjectCounts(): void {
    this.dataHandler.get<any>(`project-portal/projects/${this.projectId}`).subscribe({
      next: (project) => {
        if (!project || !this.project) return;
        this.project = { ...this.project, pending_approvals_count: project.pending_approvals_count, published_updates_count: project.published_updates_count };
        this.cd.markForCheck();
      },
      error: () => { /* counts stay */ },
    });
  }

  // ── Checkpoints ───────────────────────────────────────────────────────

  /** @description Number of finished checkpoints (progress in the card header). */
  get checkpointsDone(): number {
    return this.checkpoints.filter(c => c.status === 'done').length;
  }

  /** @description Opens the form of a new checkpoint (closes an open editor). */
  openAddCheckpoint(): void {
    if (!this.canEdit) return;
    this.editingCheckpointId = null;
    this.addingCheckpoint = true;
  }

  /** @description Closes the form of a new checkpoint and forgets what was typed. */
  cancelAddCheckpoint(): void {
    this.addingCheckpoint = false;
    this.newCheckpointLabel = '';
    this.newCheckpointDescription = '';
    this.newCheckpointDueDate = '';
    this.newCheckpointNote = '';
  }

  /**
   * @description Adds a checkpoint with its title, optional description and due date (shown to the
   *   client) and an optional internal note (team only).
   */
  addCheckpoint(): void {
    const label = this.newCheckpointLabel.trim();
    if (!label || !this.canEdit) return;
    const payload = {
      label,
      description: this.newCheckpointDescription.trim() || null,
      due_date: this.newCheckpointDueDate || null,
      internal_note: this.newCheckpointNote.trim() || null,
    };
    this.dataHandler.post<ProjectCheckpoint>(`project-portal/projects/${this.projectId}/checkpoints`, payload).subscribe({
      next: (checkpoint) => {
        this.checkpoints = [...this.checkpoints, checkpoint];
        this.cancelAddCheckpoint();
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Opens the editor of a checkpoint's title and description (closes any other).
   * @param checkpoint Checkpoint of the row.
   */
  startEditCheckpoint(checkpoint: ProjectCheckpoint): void {
    if (!this.canEdit) return;
    this.addingCheckpoint = false;
    this.editingCheckpointId = checkpoint.id;
    this.checkpointDraft = {
      label: checkpoint.label,
      description: checkpoint.description ?? '',
      due_date: checkpoint.due_date ?? '',
      internal_note: checkpoint.internal_note ?? '',
    };
  }

  /** @description Closes the checkpoint editor without saving. */
  cancelEditCheckpoint(): void {
    this.editingCheckpointId = null;
  }

  /**
   * @description Saves the edited title / description / due date / internal note (only what
   *   changed; empty values are stored as none). An empty title is not allowed.
   * @param checkpoint Checkpoint being edited.
   */
  saveCheckpoint(checkpoint: ProjectCheckpoint): void {
    const label = this.checkpointDraft.label.trim();
    const description = this.checkpointDraft.description.trim() || null;
    const dueDate = this.checkpointDraft.due_date || null;
    const internalNote = this.checkpointDraft.internal_note.trim() || null;
    if (!label || !this.canEdit || this.checkpointBusyIds.has(checkpoint.id)) return;
    const payload: Record<string, string | null> = {};
    if (label !== checkpoint.label) payload['label'] = label;
    if (description !== (checkpoint.description ?? null)) payload['description'] = description;
    if (dueDate !== (checkpoint.due_date ?? null)) payload['due_date'] = dueDate;
    if (internalNote !== (checkpoint.internal_note ?? null)) payload['internal_note'] = internalNote;
    if (Object.keys(payload).length === 0) {
      this.editingCheckpointId = null;
      return;
    }
    this.checkpointBusyIds.add(checkpoint.id);
    this.dataHandler.put<ProjectCheckpoint>(`project-portal/projects/${this.projectId}/checkpoints/${checkpoint.id}`, payload).subscribe({
      next: (updated) => {
        this.checkpoints = this.checkpoints.map(c => (c.id === checkpoint.id ? {
          ...c, label: updated.label, description: updated.description, due_date: updated.due_date, internal_note: updated.internal_note,
        } : c));
        this.checkpointBusyIds.delete(checkpoint.id);
        this.editingCheckpointId = null;
        this.cd.markForCheck();
      },
      error: () => {
        this.checkpointBusyIds.delete(checkpoint.id);
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Sets the status picked in the checkpoint's dropdown; a failed save puts the
   *   dropdown back to the saved status.
   * @param checkpoint Checkpoint of the row.
   * @param select The dropdown with the picked status.
   */
  setCheckpointStatus(checkpoint: ProjectCheckpoint, select: HTMLSelectElement): void {
    const status = select.value as ProjectCheckpoint['status'];
    if (status === checkpoint.status) return;
    if (this.checkpointBusyIds.has(checkpoint.id) || !this.canEdit) {
      select.value = checkpoint.status;
      return;
    }
    this.checkpointBusyIds.add(checkpoint.id);
    this.dataHandler.put<ProjectCheckpoint>(`project-portal/projects/${this.projectId}/checkpoints/${checkpoint.id}`, { status }).subscribe({
      next: (updated) => {
        this.checkpoints = this.checkpoints.map(c => (c.id === checkpoint.id ? { ...c, status: updated.status } : c));
        this.checkpointBusyIds.delete(checkpoint.id);
        this.cd.markForCheck();
      },
      error: () => {
        select.value = checkpoint.status;
        this.checkpointBusyIds.delete(checkpoint.id);
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description A checkpoint is overdue when its due date passed and it is not done.
   * @param checkpoint Checkpoint of the row.
   * @param today Today as Y-m-d (local date; for tests).
   */
  isOverdue(checkpoint: ProjectCheckpoint, today: string = ProjectDetailComponent.localToday()): boolean {
    return !!checkpoint.due_date && checkpoint.status !== 'done' && checkpoint.due_date < today;
  }

  /** @description Today's local date as Y-m-d. */
  static localToday(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * @description Moves a checkpoint one place up / down and saves the whole order (PUT
   *   checkpoints/order); the list changes at once and goes back when saving fails.
   * @param index Position of the checkpoint.
   * @param delta -1 up, +1 down.
   */
  moveCheckpoint(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (!this.canEdit || this.checkpointsReordering || target < 0 || target >= this.checkpoints.length) return;
    const previous = this.checkpoints;
    const reordered = [...previous];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    this.checkpoints = reordered.map((c, i) => ({ ...c, sort_order: i }));
    this.checkpointsReordering = true;
    this.cd.markForCheck();
    this.dataHandler.put<ProjectCheckpoint[]>(`project-portal/projects/${this.projectId}/checkpoints/order`, { ids: reordered.map(c => c.id) }).subscribe({
      next: () => { this.checkpointsReordering = false; this.cd.markForCheck(); },
      error: () => {
        this.checkpoints = previous;
        this.checkpointsReordering = false;
        this.cd.markForCheck();
      },
    });
  }

  async deleteCheckpoint(checkpoint: ProjectCheckpoint): Promise<void> {
    if (!this.canEdit) return;
    const confirmed = await this.confirm.open(
      this.t('delete_checkpoint_confirm_title'),
      this.t('delete_checkpoint_confirm_message').replace('{label}', checkpoint.label),
    );
    if (!confirmed) return;
    this.dataHandler.delete(`project-portal/projects/${this.projectId}/checkpoints/${checkpoint.id}`).subscribe({
      next: () => {
        this.checkpoints = this.checkpoints.filter(c => c.id !== checkpoint.id);
        this.cd.markForCheck();
      },
    });
  }

  // ── Conversations ─────────────────────────────────────────────────────

  /**
   * @description Loads the threads of the project (newest activity first) with their unread
   *   counts; the open thread keeps its loaded messages.
   * @param silent Automatic refresh - no loading state.
   */
  loadThreads(silent = false): void {
    if (!silent) {
      this.threadsLoading = true;
      this.cd.markForCheck();
    }
    this.dataHandler.getCollection<ProjectThread>('project-portal/project-threads', { project_id: this.projectId, no_pagination: 'true' }).subscribe({
      next: (threads) => {
        this.threads = Array.isArray(threads) ? threads : [];
        if (this.selectedThread) {
          const fresh = this.threads.find(thread => thread.id === this.selectedThread!.id);
          if (fresh) this.selectedThread = { ...this.selectedThread, status: fresh.status, last_message_at: fresh.last_message_at };
        }
        this.threadsLoading = false;
        this.cd.markForCheck();
      },
      error: () => { this.threadsLoading = false; this.cd.markForCheck(); },
    });
  }

  setThreadFilter(filter: ThreadFilter): void {
    this.threadFilter = filter;
    this.cd.markForCheck();
  }

  /**
   * @description Opens a thread with its newest messages; the API marks it read for the
   *   administration, so its unread badge goes away.
   */
  openThread(thread: ProjectThread): void {
    this.selectedThread = thread;
    this.threadLoading = true;
    this.replyBody = '';
    this.replyFiles = [];
    this.replyFileError = null;
    this.replyInternal = false;
    this.cd.markForCheck();
    this.fetchThread(thread.id).subscribe({
      next: (full) => {
        this.selectedThread = full;
        this.threads = this.threads.map(t => (t.id === thread.id ? { ...t, admin_unread_count: 0 } : t));
        this.threadLoading = false;
        this.cd.markForCheck();
        this.scrollMessagesToBottom();
      },
      error: () => { this.threadLoading = false; this.cd.markForCheck(); },
    });
  }

  closeThread(): void {
    this.selectedThread = null;
    this.cd.markForCheck();
  }

  /** @description Thread with its newest messages and the `has_more_older_messages` flag of the answer. */
  private fetchThread(id: number) {
    return this.dataHandler.getWithMeta<ProjectThread, { has_more_older_messages: boolean }>(`project-portal/project-threads/${id}`)
      .pipe(map(res => ({ ...res.data, has_more_older_messages: !!res.meta?.has_more_older_messages })));
  }

  changeThreadStatus(status: string): void {
    if (!this.selectedThread || !this.canEdit) return;
    const id = this.selectedThread.id;
    this.dataHandler.put<ProjectThread>(`project-portal/project-threads/${id}/status`, { status }).subscribe({
      next: (updated) => {
        if (this.selectedThread?.id === id) this.selectedThread = { ...this.selectedThread, status: updated.status };
        this.threads = this.threads.map(t => (t.id === id ? { ...t, status: updated.status } : t));
        this.cd.markForCheck();
      },
    });
  }

  loadOlderMessages(): void {
    const thread = this.selectedThread;
    if (!thread || this.olderMessagesLoading || !thread.has_more_older_messages) return;
    const oldestId = thread.messages?.[0]?.id;
    if (!oldestId) return;
    const container = this.messageList?.nativeElement;
    const previousHeight = container?.scrollHeight ?? 0;
    this.olderMessagesLoading = true;
    this.cd.markForCheck();
    this.dataHandler.getWithMeta<ProjectThreadMessage[], { has_more_older_messages: boolean }>(
      `project-portal/project-threads/${thread.id}/messages?before_message_id=${oldestId}`,
    ).subscribe({
      next: (res) => {
        this.selectedThread = { ...thread, messages: [...res.data, ...(thread.messages ?? [])], has_more_older_messages: !!res.meta?.has_more_older_messages };
        this.olderMessagesLoading = false;
        this.cd.markForCheck();
        setTimeout(() => { if (container) container.scrollTop = container.scrollHeight - previousHeight; });
      },
      error: () => { this.olderMessagesLoading = false; this.cd.markForCheck(); },
    });
  }

  async sendReply(): Promise<void> {
    const body = this.replyBody.trim();
    const thread = this.selectedThread;
    if (!body || !thread || this.replySending || !this.canEdit) return;
    this.replySending = true;
    this.cd.markForCheck();
    const internal = this.replyInternal;
    const payload = this.replyFiles.length > 0
      ? this.buildReplyFormData(body, this.replyFiles, internal)
      : { body, is_internal: internal };
    const hadFiles = this.replyFiles.length > 0;
    try {
      await firstValueFrom(this.dataHandler.post(`project-portal/project-threads/${thread.id}/reply`, payload));
      this.replyBody = '';
      this.replyFiles = [];
      this.openThread(thread);
      this.loadThreads(true);
      if (hadFiles) this.loadFiles();
    } catch {
      // DataHandler.handleError() already showed the reason.
    } finally {
      this.replySending = false;
      this.cd.markForCheck();
    }
  }

  /** @description Loads the ids of the threads of this project assigned to the signed-in administrator. */
  loadMyThreads(): void {
    this.dataHandler.getCollection<ProjectThread>('project-portal/project-threads', { project_id: this.projectId, no_pagination: 'true', assigned_to_me: '1' }).subscribe({
      next: (threads) => { this.myThreadIds = new Set((Array.isArray(threads) ? threads : []).map(t => t.id)); this.cd.markForCheck(); },
      error: () => { /* the filter "Mine" stays empty */ },
    });
  }

  /**
   * @description Assigns the open thread to an administrator (or nobody); the API e-mails them.
   * @param value Picked user id ('' = nobody).
   */
  assignThread(value: string): void {
    const thread = this.selectedThread;
    if (!thread || !this.canEdit) return;
    const assigneeId = value ? Number(value) : null;
    this.dataHandler.put<ProjectThread>(`project-portal/project-threads/${thread.id}/assignee`, { assignee_id: assigneeId }).subscribe({
      next: (updated) => {
        const patch = { assignee_id: updated?.assignee_id ?? assigneeId, assignee_name: updated?.assignee_name ?? null };
        if (this.selectedThread?.id === thread.id) this.selectedThread = { ...this.selectedThread, ...patch };
        this.threads = this.threads.map(t => (t.id === thread.id ? { ...t, ...patch } : t));
        this.loadMyThreads();
        this.cd.markForCheck();
      },
    });
  }

  /** @description Administrators offered as thread assignees (the loaded project assignees). */
  get assigneeOptions(): { id: number; full_name: string }[] {
    return this.assignees;
  }

  threadStatusLabel(status: string): string {
    return status === 'closed' ? this.t('thread_status_closed') : this.t('thread_status_active');
  }

  threadPriorityLabel(priority: string): string {
    return this.t(`thread_priority_${priority}`);
  }

  threadAuthorLabel(authorType: 'customer' | 'admin'): string {
    return authorType === 'admin' ? this.t('thread_author_admin') : this.t('thread_author_customer');
  }

  /**
   * @description "Waiting on us / on the client" of an active thread.
   * @param thread Thread of the list.
   * @return Label, or '' for a closed thread.
   */
  waitingLabel(thread: ProjectThread): string {
    if (thread.waiting_on === 'supplier') return this.t('thread_waiting_on_us');
    if (thread.waiting_on === 'customer') return this.t('thread_waiting_on_client');
    return '';
  }

  /**
   * @description Our public message was read by the client (its thread was opened in the portal
   *   after the message was written).
   * @param message Message of the open thread.
   */
  isReadByClient(message: ProjectThreadMessage): boolean {
    const readAt = this.selectedThread?.customer_last_read_at;
    if (message.author_type !== 'admin' || message.is_internal || !readAt) return false;
    return new Date(readAt).getTime() >= new Date(message.created_at).getTime();
  }

  // ── Attachments of a reply ────────────────────────────────────────────

  formatFileSize(bytes: number): string {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  onReplyFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.replyFileError = null;
    const files = [...this.replyFiles];
    for (const file of Array.from(input.files)) {
      if (files.length >= this.maxAttachments) {
        this.replyFileError ??= this.t('attachment_error_too_many').replace('{max}', String(this.maxAttachments));
        break;
      }
      if (!isExtensionAllowed(file.name, this.attachmentRules?.extensions ?? [])) {
        const ext = fileExtension(file.name);
        const types = this.attachmentRules?.extensions?.length
          ? ' ' + this.t('attachment_allowed_types').replace('{types}', extensionsLabel(this.attachmentRules.extensions)) : '';
        this.replyFileError ??= this.t('attachment_error_type').replace('{name}', file.name).replace('{ext}', ext ? '.' + ext : '?') + types;
        continue;
      }
      if (file.size > this.maxAttachmentSizeMb * 1024 * 1024) {
        this.replyFileError ??= this.t('attachment_error_size').replace('{name}', file.name).replace('{maxMb}', String(this.maxAttachmentSizeMb));
        continue;
      }
      files.push(file);
    }
    this.replyFiles = files;
    input.value = '';
    this.cd.markForCheck();
  }

  removeReplyFile(index: number): void {
    this.replyFiles = this.replyFiles.filter((_, i) => i !== index);
    this.replyFileError = null;
    this.cd.markForCheck();
  }

  private buildReplyFormData(body: string, files: File[], internal: boolean): FormData {
    const formData = new FormData();
    formData.append('body', body);
    formData.append('is_internal', internal ? '1' : '0');
    files.forEach(file => formData.append('attachments[]', file, file.name));
    return formData;
  }

  private scrollMessagesToBottom(): void {
    setTimeout(() => {
      const el = this.messageList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
