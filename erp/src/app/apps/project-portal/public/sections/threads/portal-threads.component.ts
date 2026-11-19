/**
 * @file portal-threads.component.ts
 * @path src/app/apps/project-portal/public/sections/threads/portal-threads.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Communication of the project portal (/projects/:token/threads): search and the
 *   thread list (priority, "waiting on you / on the supplier", unread badge, status), a new
 *   thread with attachments, and the open thread - messages (older ones on demand, new ones
 *   polled every 15 s), status (the client can close and reopen it) and the reply box.
 *   Several accounts of one client share the conversations - messages show who wrote them
 *   ("You" for the own ones).
 * @note A thread asked for by another section (a news item, a file) opens at once
 *   (PortalSessionService.requestedThread).
 * @dependencies PortalSessionService (provided by PortalLayoutComponent), UploadRulesService
 *   (attachment rules, profile project_thread), shared/utils/upload-rules
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, catchError, filter, finalize, switchMap, takeUntil, timer } from 'rxjs';
import { PORTAL_POLL_INTERVAL_MS, PortalSessionService } from '../../portal-session.service';
import { ProjectThread, ProjectThreadMessage } from '../../portal.models';
import { formatFileSize, portalTexts } from '../../portal-ui';
import { UploadRulesService } from '../../../../../shared/services/upload-rules.service';
import { UploadRule, extensionsLabel, fileExtension, isExtensionAllowed } from '../../../../../shared/utils/upload-rules';

/** Fallback limits of the thread attachments while the rules of the API (`GET upload-rules`, profile project_thread) are not loaded. */
const DEFAULT_MAX_ATTACHMENTS = 5;
const DEFAULT_MAX_ATTACHMENT_SIZE_MB = 15;

@Component({
  selector: 'app-portal-threads',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './portal-threads.component.html',
  styleUrls: ['../portal-section.css', './portal-threads.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalThreadsComponent implements OnInit, OnDestroy {
  readonly session = inject(PortalSessionService);
  private readonly uploadRulesService = inject(UploadRulesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly stopPolling$ = new Subject<void>();
  readonly t = portalTexts();
  readonly formatFileSize = formatFileSize;

  @ViewChild('ppMessageListEl') ppMessageListEl?: ElementRef<HTMLDivElement>;

  threadSearch = '';
  selectedThread: ProjectThread | null = null;
  threadDetailLoading = false;
  olderMessagesLoading = false;
  /** The status of the open thread is being changed. */
  threadStatusChanging = false;

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

  /** Attachment rules of the API (profile project_thread) - null until loaded / when unavailable. */
  attachmentRules: UploadRule | null = null;

  ngOnInit(): void {
    this.uploadRulesService.rules('project_thread')
      .pipe(takeUntil(this.destroy$))
      .subscribe(rules => { this.attachmentRules = rules; this.cdr.markForCheck(); });

    // A refresh of the header reloads the open thread.
    this.session.refreshed$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.selectedThread) this.openThread(this.selectedThread);
    });

    const requested = this.session.requestedThread();
    if (requested) {
      this.session.requestedThread.set(null);
      this.openThread(requested);
    }
  }

  ngOnDestroy(): void {
    this.session.openThreadId = null;
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling$.next();
    this.stopPolling$.complete();
  }

  // ── Thread list ───────────────────────────────────────────────────────

  /** @description Threads matching the search (subject or a loaded message). */
  get filteredThreads(): ProjectThread[] {
    const threads = this.session.threads();
    const q = this.threadSearch.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(thread => {
      if (thread.subject?.toLowerCase().includes(q)) return true;
      return (thread.messages || []).some(msg => msg.body?.toLowerCase().includes(q));
    });
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
   * @description The message was written by the signed-in account.
   * @param msg Message.
   */
  isMine(msg: ProjectThreadMessage): boolean {
    const me = this.session.project()?.account?.id;
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

  // ── Open thread ───────────────────────────────────────────────────────

  /**
   * @description Opens a thread: loads its detail, clears its unread badge and starts polling its
   *   new messages.
   * @param thread Thread of the list (or a stub with its id).
   */
  openThread(thread: ProjectThread): void {
    this.newThreadMode = false;
    this.selectedThread = thread;
    this.session.openThreadId = thread.id;
    this.threadDetailLoading = true;
    this.replyBody = '';
    this.replyFiles = [];
    this.replyFileError = null;
    this.cdr.markForCheck();

    this.session.getWithMeta<ProjectThread, { has_more_older_messages: boolean }>(this.session.path(`threads/${thread.id}`))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          // `has_more_older_messages` comes in meta, kept on the thread for the template.
          this.selectedThread = { ...res.data, has_more_older_messages: !!res.meta?.has_more_older_messages };
          this.threadDetailLoading = false;
          this.session.markThreadRead(thread.id);
          this.cdr.markForCheck();
          this.scrollMessagesToBottom();
          this.startPollingNewMessages();
        },
        error: () => { this.threadDetailLoading = false; this.cdr.markForCheck(); },
      });
  }

  /** @description Back to the thread list (the polling of the thread stops). */
  closeThread(): void {
    this.stopPolling$.next();
    this.selectedThread = null;
    this.session.openThreadId = null;
    this.replyBody = '';
    this.replyFiles = [];
    this.replyFileError = null;
  }

  /**
   * @description While the thread is open, asks every 15 s only for messages newer than the last
   *   locally known one (`after_id`); new messages are APPENDED and the view scrolls down; a
   *   failed poll is logged and skipped. Stopped in `closeThread()` / `ngOnDestroy()`.
   */
  private startPollingNewMessages(): void {
    this.stopPolling$.next();
    timer(0, PORTAL_POLL_INTERVAL_MS).pipe(
      filter(() => !!this.selectedThread),
      switchMap(() => {
        const lastId = this.selectedThread?.messages?.[this.selectedThread.messages.length - 1]?.id ?? 0;
        return this.session.getWithMeta<ProjectThreadMessage[], { status: string; waiting_on?: ProjectThread['waiting_on'] }>(
          this.session.path(`threads/${this.selectedThread!.id}/new-messages?after_id=${lastId}`)
        ).pipe(catchError(err => {
          // Logged and skipped - the next poll tries again.
          console.error('[ProjectPortal] Polling new messages failed:', err);
          return EMPTY;
        }));
      }),
      takeUntil(this.stopPolling$),
      takeUntil(this.destroy$)
    ).subscribe(res => {
      if (!this.selectedThread || res.data.length === 0) return;
      this.selectedThread.messages = [...this.selectedThread.messages!, ...res.data];
      this.selectedThread.status = res.meta?.status ?? this.selectedThread.status;
      if (res.meta && 'waiting_on' in res.meta) this.selectedThread.waiting_on = res.meta.waiting_on;
      this.cdr.markForCheck();
      this.scrollMessagesToBottom();
    });
  }

  /**
   * @description Prepends an older batch of messages and keeps the scroll position (the client
   *   stays on the same message): the difference of `scrollHeight` before / after becomes the
   *   new `scrollTop`.
   */
  loadOlderMessages(): void {
    if (!this.selectedThread || this.olderMessagesLoading || !this.selectedThread.has_more_older_messages) return;
    const oldestId = this.selectedThread.messages?.[0]?.id;
    if (!oldestId) return;

    const container = this.ppMessageListEl?.nativeElement;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    this.olderMessagesLoading = true;
    this.cdr.markForCheck();

    this.session.getWithMeta<ProjectThreadMessage[], { has_more_older_messages: boolean }>(
      this.session.path(`threads/${this.selectedThread.id}/messages?before_message_id=${oldestId}`)
    ).pipe(finalize(() => { this.olderMessagesLoading = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.selectedThread!.messages = [...res.data, ...(this.selectedThread!.messages || [])];
          this.selectedThread!.has_more_older_messages = !!res.meta?.has_more_older_messages;
          this.cdr.markForCheck();
          setTimeout(() => {
            if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
          });
        },
      });
  }

  private scrollMessagesToBottom(): void {
    setTimeout(() => {
      const el = this.ppMessageListEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  /**
   * @description The client closes or reopens the open thread (both directions, so a thread
   *   closed by mistake can be reopened without waiting for the supplier); a thread that no
   *   longer exists (404) closes and the list reloads.
   * @param status active | closed.
   */
  updateThreadStatus(status: string): void {
    if (!this.selectedThread || this.threadStatusChanging || this.selectedThread.status === status) return;
    const id = this.selectedThread.id;
    this.threadStatusChanging = true;
    this.cdr.markForCheck();

    this.session.post<ProjectThread>(this.session.path(`threads/${id}/status`), { status }).pipe(
      finalize(() => { this.threadStatusChanging = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (updated) => {
        if (this.selectedThread) this.selectedThread.status = updated.status;
        this.session.setThreadStatus(id, updated.status);
      },
      error: (err) => {
        if (err?.status === 404) {
          this.closeThread();
          this.session.loadThreads();
        }
      },
    });
  }

  // ── Attachments - chosen files validated at once ──────────────────────

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

  /**
   * @description Validates newly chosen files AGAINST the current selection - type (extension),
   *   size and total count at once, with the same rules as the API. Refused files never get into
   *   the result; `onError` gets the first error hit (one message at a time is enough).
   * @param existing Files chosen already.
   * @param incoming Newly chosen files.
   * @param onError Receives the error text.
   * @returns The new selection.
   */
  private validateAndAddFiles(existing: File[], incoming: FileList, onError: (msg: string) => void): File[] {
    const result = [...existing];
    let errorSet = false;

    for (const file of Array.from(incoming)) {
      if (result.length >= this.maxAttachments) {
        if (!errorSet) { onError(this.t('attachment_error_too_many').replace('{max}', String(this.maxAttachments))); errorSet = true; }
        break;
      }
      if (!isExtensionAllowed(file.name, this.attachmentRules?.extensions ?? [])) {
        const ext = fileExtension(file.name);
        // The allowed types are listed only now, together with the refusal (not up front).
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

  // ── Sending ───────────────────────────────────────────────────────────

  /** @description Sends the reply (with attachments as multipart), reloads the thread and the list. */
  sendReply(): void {
    const body = this.replyBody.trim();
    if (!body || !this.selectedThread || this.replySending) return;

    this.replySending = true;
    this.replySendError = null;
    this.cdr.markForCheck();

    const payload: FormData | { body: string } = this.replyFiles.length > 0 ? this.buildFormData({ body }, this.replyFiles) : { body };
    this.session.post(this.session.path(`threads/${this.selectedThread.id}/messages`), payload).pipe(
      finalize(() => { this.replySending = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.replyBody = '';
        this.replyFiles = [];
        this.openThread(this.selectedThread!);
        this.session.loadThreads();
      },
      error: () => { this.replySendError = this.t('error_send_failed'); },
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

  /** @description Creates a thread (subject, priority, first message, attachments) and reloads the list. */
  submitNewThread(): void {
    if (!this.newThreadSubject.trim() || !this.newThreadBody.trim() || this.newThreadSending) return;

    this.newThreadSending = true;
    this.newThreadSendError = null;
    this.cdr.markForCheck();

    const base = { subject: this.newThreadSubject, priority: this.newThreadPriority, body: this.newThreadBody };
    const payload: FormData | typeof base = this.newThreadFiles.length > 0 ? this.buildFormData(base, this.newThreadFiles) : base;
    this.session.post<ProjectThread>(this.session.path('threads'), payload).pipe(
      finalize(() => { this.newThreadSending = false; this.cdr.markForCheck(); }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.newThreadMode = false;
        this.newThreadFiles = [];
        this.session.loadThreads();
      },
      error: () => { this.newThreadSendError = this.t('error_send_failed'); },
    });
  }

  private buildFormData(fields: Record<string, string>, files: File[]): FormData {
    const fd = new FormData();
    Object.entries(fields).forEach(([key, value]) => fd.append(key, value));
    files.forEach(file => fd.append('attachments[]', file, file.name));
    return fd;
  }
}
