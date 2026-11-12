/**
 * @file project-detail.component.ts
 * @path src/app/admin/web-pages/project-detail/project-detail.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page of one client project (web/projects/:id) - everything of the project in one
 *   place instead of the former full-screen "Manage" popup and the cross-project table of
 *   requests: back to the list, the project settings (name, lead, contacts, dates, visibility,
 *   status - editable inline with a floating save bar), access to the client portal (link,
 *   one-time password, regeneration), checkpoints, and the conversations with the client of THIS
 *   project (threads with unread badges, messages, reply with attachments, thread status). New client
 *   messages are shown as badges (header, thread list) and the list refreshes every minute.
 * @note The texts are the admin language (section `projects`) - the project data itself is one
 *   language. Opening a thread marks it read for the administration (API). The one-time password
 *   of a just created project comes from ProjectPasswordHandoffService (memory only, VT-08);
 *   leaving with an uncopied password or unsaved settings asks first.
 * @dependencies DataHandler (web/projects, web/project-threads), AdminLocalizationService,
 *   PermissionService (web-projects-update), AlertDialogService, ConfirmDialogService,
 *   UploadRulesService (profile project_thread), ProjectPasswordHandoffService, Router.
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, interval, map } from 'rxjs';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { UploadRulesService } from '../../../shared/services/upload-rules.service';
import { UploadRule, extensionsLabel, fileExtension, isExtensionAllowed } from '../../../shared/utils/upload-rules';
import { InputDefinition } from '../../../shared/interfaces/input-definiton';
import { StickyBarDirective } from '../../../shared/directives/sticky-bar.directive';
import { PageHelpComponent } from '../../components/page-help/page-help.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import * as Config from '../projects/projects.config';
import { ProjectPasswordHandoffService, RevealedProjectPassword } from '../projects/project-password-handoff.service';

/** @description Checkpoint of a project. */
export interface ProjectCheckpoint {
  id: number;
  /** Title of the checkpoint. */
  label: string;
  /** What the checkpoint covers - shown to the client in the portal when expanded. */
  description?: string | null;
  status: 'new' | 'active' | 'done';
  sort_order: number;
}

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
  has_more_older_messages?: boolean;
  messages?: ProjectThreadMessage[];
}

/** @description Thread list filter. */
export type ThreadFilter = 'active' | 'closed' | 'all';

/** @description Seconds between two automatic refreshes of the thread list. */
export const THREAD_REFRESH_SECONDS = 60;

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StickyBarDirective, PageHelpComponent, IconComponent],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css'],
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
  private readonly passwordHandoff = inject(ProjectPasswordHandoffService);
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
  /** The form of a new checkpoint is open. */
  addingCheckpoint = false;
  checkpointBusyIds = new Set<number>();
  /** Checkpoint whose title / description is being edited (one at a time), with its draft. */
  editingCheckpointId: number | null = null;
  checkpointDraft = { label: '', description: '' };

  revealedPassword: RevealedProjectPassword | null = null;
  passwordVisible = false;
  passwordCopied = false;
  passwordRegenerating = false;

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

  attachmentRules: UploadRule | null = null;

  /** @description Text of the section `projects` in the admin language. */
  t(key: string): string {
    return this.i18n.getValue(`projects.${key}`);
  }

  /** @description May the user change the project (settings, checkpoints, password, replies)? */
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
    return this.threadFilter === 'all' ? this.threads : this.threads.filter(thread => thread.status === this.threadFilter);
  }

  /** @description Number of threads of a filter (filter chips). */
  threadCount(filter: ThreadFilter): number {
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
    this.i18n.translations$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.fields = Config.createProjectFormFields(this.i18n)
        .filter(field => field.show_in_edit !== false && field.column_name !== 'order_id');
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
    this.revealedPassword = this.passwordHandoff.take(this.projectId);
    this.passwordVisible = !!this.revealedPassword;
    this.loadProject();
    this.loadThreads();
    interval(THREAD_REFRESH_SECONDS * 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadThreads(true));
  }

  // ── Project + settings ────────────────────────────────────────────────

  /** @description Loads the project (settings, checkpoints, access). */
  loadProject(): void {
    this.dataHandler.get<any>(`web/projects/${this.projectId}`).subscribe({
      next: (project) => {
        this.applyProject(project);
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
      form[field.column_name] = project?.[field.column_name] ?? '';
    }
    this.form = form;
    this.original = { ...form };
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
    this.dataHandler.put<any>(`web/projects/${this.projectId}`, payload).subscribe({
      next: (project) => {
        this.saving = false;
        this.applyProject({ ...project, unread_messages_count: this.project?.unread_messages_count });
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
    this.router.navigate(['/admin/web/projects']);
  }

  /** @description Reloading / closing the tab with unsaved settings or an uncopied password asks the browser. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty || (this.revealedPassword && !this.passwordCopied)) {
      event.preventDefault();
    }
  }

  // ── Access (link + one-time password) ─────────────────────────────────

  copyPublicUrl(): void {
    const url = this.revealedPassword?.url ?? this.project?.public_url;
    if (!url) return;
    navigator.clipboard?.writeText(url);
    this.alert.open(this.t('copied_title'), this.t('url_copied_message'), 'success');
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

  async regeneratePassword(): Promise<void> {
    if (!this.project || this.passwordRegenerating || !this.canEdit) return;
    if (!(await this.confirm.open(this.t('regenerate_password_confirm_title'), this.t('regenerate_password_confirm_message')))) return;
    this.passwordRegenerating = true;
    this.cd.markForCheck();
    this.dataHandler.post<{ generated_password: string }>(`web/projects/${this.projectId}/regenerate-password`, {}).subscribe({
      next: (res) => {
        this.passwordRegenerating = false;
        this.revealedPassword = { password: res.generated_password, url: this.project.public_url, generatedAt: new Date().toISOString() };
        this.passwordCopied = false;
        this.passwordVisible = true;
        this.alert.open(this.t('password_regenerated_title'), this.t('password_regenerated_message'), 'success');
        this.cd.markForCheck();
      },
      error: () => { this.passwordRegenerating = false; this.cd.markForCheck(); },
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
  }

  /** @description Adds a checkpoint with its title and optional description (shown to the client). */
  addCheckpoint(): void {
    const label = this.newCheckpointLabel.trim();
    if (!label || !this.canEdit) return;
    const description = this.newCheckpointDescription.trim() || null;
    this.dataHandler.post<ProjectCheckpoint>(`web/projects/${this.projectId}/checkpoints`, { label, description }).subscribe({
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
    this.checkpointDraft = { label: checkpoint.label, description: checkpoint.description ?? '' };
  }

  /** @description Closes the checkpoint editor without saving. */
  cancelEditCheckpoint(): void {
    this.editingCheckpointId = null;
  }

  /**
   * @description Saves the edited title / description (only what changed; an empty description
   *   is stored as none). An empty title is not allowed.
   * @param checkpoint Checkpoint being edited.
   */
  saveCheckpoint(checkpoint: ProjectCheckpoint): void {
    const label = this.checkpointDraft.label.trim();
    const description = this.checkpointDraft.description.trim() || null;
    if (!label || !this.canEdit || this.checkpointBusyIds.has(checkpoint.id)) return;
    const payload: Record<string, string | null> = {};
    if (label !== checkpoint.label) payload['label'] = label;
    if (description !== (checkpoint.description ?? null)) payload['description'] = description;
    if (Object.keys(payload).length === 0) {
      this.editingCheckpointId = null;
      return;
    }
    this.checkpointBusyIds.add(checkpoint.id);
    this.dataHandler.put<ProjectCheckpoint>(`web/projects/${this.projectId}/checkpoints/${checkpoint.id}`, payload).subscribe({
      next: (updated) => {
        this.checkpoints = this.checkpoints.map(c => (c.id === checkpoint.id ? { ...c, label: updated.label, description: updated.description } : c));
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
    this.dataHandler.put<ProjectCheckpoint>(`web/projects/${this.projectId}/checkpoints/${checkpoint.id}`, { status }).subscribe({
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

  async deleteCheckpoint(checkpoint: ProjectCheckpoint): Promise<void> {
    if (!this.canEdit) return;
    const confirmed = await this.confirm.open(
      this.t('delete_checkpoint_confirm_title'),
      this.t('delete_checkpoint_confirm_message').replace('{label}', checkpoint.label),
    );
    if (!confirmed) return;
    this.dataHandler.delete(`web/projects/${this.projectId}/checkpoints/${checkpoint.id}`).subscribe({
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
    this.dataHandler.getCollection<ProjectThread>('web/project-threads', { project_id: this.projectId, no_pagination: 'true' }).subscribe({
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
    return this.dataHandler.getWithMeta<ProjectThread, { has_more_older_messages: boolean }>(`web/project-threads/${id}`)
      .pipe(map(res => ({ ...res.data, has_more_older_messages: !!res.meta?.has_more_older_messages })));
  }

  changeThreadStatus(status: string): void {
    if (!this.selectedThread || !this.canEdit) return;
    const id = this.selectedThread.id;
    this.dataHandler.put<ProjectThread>(`web/project-threads/${id}/status`, { status }).subscribe({
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
      `web/project-threads/${thread.id}/messages?before_message_id=${oldestId}`,
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
    const payload = this.replyFiles.length > 0 ? this.buildReplyFormData(body, this.replyFiles) : { body };
    try {
      await firstValueFrom(this.dataHandler.post(`web/project-threads/${thread.id}/reply`, payload));
      this.replyBody = '';
      this.replyFiles = [];
      this.openThread(thread);
      this.loadThreads(true);
    } catch {
      // DataHandler.handleError() already showed the reason.
    } finally {
      this.replySending = false;
      this.cd.markForCheck();
    }
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

  private buildReplyFormData(body: string, files: File[]): FormData {
    const formData = new FormData();
    formData.append('body', body);
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
