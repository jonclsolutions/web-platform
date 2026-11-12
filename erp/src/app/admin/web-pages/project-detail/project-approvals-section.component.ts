/**
 * @file project-approvals-section.component.ts
 * @path src/app/admin/web-pages/project-detail/project-approvals-section.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sub-page "Approvals" of the project page: approval requests for the client with
 *   their state (waiting, approved, changes requested, cancelled), files, linked checkpoint, due
 *   date and the history of the client's decisions (who, when, comment). The team asks for an
 *   approval (title, description, files, checkpoint, due date - the client accounts that turned
 *   approval notifications on get an e-mail), changes a pending one, asks again after changes,
 *   cancels or deletes one without a decision.
 * @dependencies DataHandler (web/projects/:id/approvals), AdminLocalizationService, ConfirmDialogService,
 *   UploadRulesService (project_thread), project-files.util
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { UploadRulesService } from '../../../shared/services/upload-rules.service';
import { UploadRule } from '../../../shared/utils/upload-rules';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { formatProjectFileSize, pickProjectFiles } from './project-files.util';

/** @description Approval request (API WebProjectApprovalResource). */
export interface ProjectApproval {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'approved' | 'changes_requested' | 'cancelled';
  due_date: string | null;
  checkpoint_id: number | null;
  checkpoint_label?: string | null;
  requested_by_label: string | null;
  requested_at: string | null;
  decided_at: string | null;
  attachments?: { id: number; original_filename: string; size_bytes: number; download_url: string }[];
  decisions?: { id: number; decision: 'approved' | 'changes_requested'; comment: string | null; author_label: string | null; created_at: string }[];
}

/** @description Form of a new / changed request. */
export interface ApprovalDraft {
  title: string;
  description: string;
  checkpoint_id: string;
  due_date: string;
}

@Component({
  selector: 'app-project-approvals-section',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './project-approvals-section.component.html',
  styleUrls: ['./project-detail.component.css', './project-sections.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectApprovalsSectionComponent implements OnInit {
  private readonly dataHandler = inject(DataHandler);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly uploadRules = inject(UploadRulesService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Project of the page. */
  @Input({ required: true }) projectId!: number;
  /** May the user change approvals (web-projects-update)? */
  @Input() canEdit = false;
  /** Checkpoints of the project (link of a request). */
  @Input() checkpoints: { id: number; label: string }[] = [];
  /** Something changed (the page refreshes its counts / files). */
  @Output() changed = new EventEmitter<void>();

  approvals: ProjectApproval[] = [];
  loading = false;
  /** Form: 'add', 'edit' (editingId) or closed. */
  formMode: 'add' | 'edit' | null = null;
  editingId: number | null = null;
  draft: ApprovalDraft = ProjectApprovalsSectionComponent.emptyDraft();
  files: File[] = [];
  /** Saved files of the edited request marked for removal. */
  removeIds = new Set<number>();
  fileError: string | null = null;
  saving = false;
  busyId: number | null = null;
  /** Filter of the list. */
  filter: 'open' | 'all' = 'open';
  private rules: UploadRule | null = null;

  /** @description Empty form. */
  static emptyDraft(): ApprovalDraft {
    return { title: '', description: '', checkpoint_id: '', due_date: '' };
  }

  t(key: string): string {
    return this.i18n.getValue(`projects.${key}`);
  }

  ngOnInit(): void {
    this.uploadRules.rules('project_thread').pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(rules => { this.rules = rules; this.cd.markForCheck(); });
    this.load();
  }

  /** @description Requests shown by the filter: open = waiting + changes requested. */
  get visibleApprovals(): ProjectApproval[] {
    return this.filter === 'all' ? this.approvals : this.approvals.filter(a => a.status === 'pending' || a.status === 'changes_requested');
  }

  /** @description Number of open requests (filter label). */
  get openCount(): number {
    return this.approvals.filter(a => a.status === 'pending' || a.status === 'changes_requested').length;
  }

  /** @description Loads the requests (newest first). */
  load(): void {
    this.loading = true;
    this.cd.markForCheck();
    this.dataHandler.getCollection<ProjectApproval>(`web/projects/${this.projectId}/approvals`).subscribe({
      next: (rows) => { this.approvals = Array.isArray(rows) ? rows : []; this.loading = false; this.cd.markForCheck(); },
      error: () => { this.loading = false; this.cd.markForCheck(); },
    });
  }

  /** @description Opens the form of a new request. */
  openAdd(): void {
    if (!this.canEdit) return;
    this.formMode = 'add';
    this.editingId = null;
    this.draft = ProjectApprovalsSectionComponent.emptyDraft();
    this.resetFiles();
  }

  /**
   * @description Opens the form of a pending request.
   * @param approval Request of the list.
   */
  openEdit(approval: ProjectApproval): void {
    if (!this.canEdit || approval.status !== 'pending') return;
    this.formMode = 'edit';
    this.editingId = approval.id;
    this.draft = {
      title: approval.title, description: approval.description ?? '',
      checkpoint_id: approval.checkpoint_id ? String(approval.checkpoint_id) : '', due_date: approval.due_date ?? '',
    };
    this.resetFiles();
  }

  /** @description Closes the form. */
  cancelForm(): void {
    this.formMode = null;
    this.editingId = null;
    this.resetFiles();
  }

  private resetFiles(): void {
    this.files = [];
    this.removeIds = new Set();
    this.fileError = null;
  }

  /** @description The request being edited. */
  get editing(): ProjectApproval | undefined {
    return this.approvals.find(a => a.id === this.editingId);
  }

  /**
   * @description Adds picked files (checked against the upload rules).
   * @param event Change of the file input.
   */
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = pickProjectFiles(this.files, Array.from(input.files ?? []), this.rules, key => this.t(key));
    this.files = picked.files;
    this.fileError = picked.error;
    input.value = '';
    this.cd.markForCheck();
  }

  removeFile(index: number): void {
    this.files = this.files.filter((_, i) => i !== index);
    this.fileError = null;
  }

  /**
   * @description Marks / unmarks a saved file of the edited request for removal.
   * @param id Attachment id.
   */
  toggleRemove(id: number): void {
    const next = new Set(this.removeIds);
    next.has(id) ? next.delete(id) : next.add(id);
    this.removeIds = next;
  }

  /** @description Saves the form (multipart with the files). */
  save(): void {
    const title = this.draft.title.trim();
    if (!this.canEdit || !title || this.saving) return;
    const form = new FormData();
    form.append('title', title);
    form.append('description', this.draft.description.trim());
    form.append('checkpoint_id', this.draft.checkpoint_id);
    form.append('due_date', this.draft.due_date);
    this.files.forEach(file => form.append('attachments[]', file, file.name));
    this.removeIds.forEach(id => form.append('remove_attachment_ids[]', String(id)));
    const url = this.formMode === 'edit' ? `web/projects/${this.projectId}/approvals/${this.editingId}` : `web/projects/${this.projectId}/approvals`;

    this.saving = true;
    this.cd.markForCheck();
    this.dataHandler.post<ProjectApproval>(url, form).subscribe({
      next: (saved) => {
        this.saving = false;
        this.approvals = this.formMode === 'edit'
          ? this.approvals.map(a => (a.id === saved.id ? saved : a))
          : [saved, ...this.approvals];
        this.cancelForm();
        this.changed.emit();
        this.cd.markForCheck();
      },
      error: () => { this.saving = false; this.cd.markForCheck(); },
    });
  }

  /**
   * @description Asks again / cancels / deletes after a confirmation.
   * @param approval Request.
   * @param action reopen | cancel | delete
   */
  async act(approval: ProjectApproval, action: 'reopen' | 'cancel' | 'delete'): Promise<void> {
    if (!this.canEdit || this.busyId !== null) return;
    const confirmed = await this.confirm.open(this.t(`approval_${action}_confirm_title`),
      this.t(`approval_${action}_confirm_message`).replace('{title}', approval.title));
    if (!confirmed) return;
    this.busyId = approval.id;
    this.cd.markForCheck();
    const base = `web/projects/${this.projectId}/approvals/${approval.id}`;
    const request: Observable<unknown> = action === 'delete' ? this.dataHandler.delete(base) : this.dataHandler.post<ProjectApproval>(`${base}/${action}`, {});
    request.subscribe({
      next: (saved: any) => {
        this.busyId = null;
        this.approvals = action === 'delete'
          ? this.approvals.filter(a => a.id !== approval.id)
          : this.approvals.map(a => (a.id === approval.id ? saved : a));
        this.changed.emit();
        this.cd.markForCheck();
      },
      error: () => { this.busyId = null; this.cd.markForCheck(); },
    });
  }

  /** @description Translated state of a request. */
  statusLabel(status: ProjectApproval['status']): string {
    return this.t('approval_status_' + status);
  }

  /** @description Translated decision. */
  decisionLabel(decision: string): string {
    return this.t('approval_decision_' + decision);
  }

  formatFileSize(bytes: number): string {
    return formatProjectFileSize(bytes);
  }
}
