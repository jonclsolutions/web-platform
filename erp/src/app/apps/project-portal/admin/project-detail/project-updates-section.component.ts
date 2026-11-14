/**
 * @file project-updates-section.component.ts
 * @path src/app/apps/project-portal/admin/project-detail/project-updates-section.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sub-page "Updates" of the project page: updates from the team to the client (what
 *   was done, a release, a planned outage) with title, text and files. A draft is seen only by the
 *   team; publishing shows it in the portal and - the first time only - e-mails the client accounts
 *   that turned update notifications on. An update can be taken back to a draft, changed (files
 *   added / removed) and deleted.
 * @dependencies DataHandler (project-portal/projects/:id/updates), AdminLocalizationService, AlertDialogService,
 *   ConfirmDialogService, UploadRulesService (project_thread), project-files.util
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { UploadRulesService } from '../../../../shared/services/upload-rules.service';
import { UploadRule } from '../../../../shared/utils/upload-rules';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatProjectFileSize, pickProjectFiles } from './project-files.util';

/** @description Update (API WebProjectUpdateResource). */
export interface ProjectUpdate {
  id: number;
  title: string;
  body: string;
  author_label: string | null;
  is_published: boolean;
  published_at: string | null;
  attachments?: { id: number; original_filename: string; size_bytes: number; download_url: string }[];
  created_at: string;
  updated_at?: string;
}

@Component({
  selector: 'app-project-updates-section',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './project-updates-section.component.html',
  styleUrls: ['./project-detail.component.css', './project-sections.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectUpdatesSectionComponent implements OnInit {
  private readonly dataHandler = inject(DataHandler);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly alert = inject(AlertDialogService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly uploadRules = inject(UploadRulesService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Project of the page. */
  @Input({ required: true }) projectId!: number;
  /** May the user change updates (project-portal-projects-update)? */
  @Input() canEdit = false;
  /** Something changed (the page refreshes its counts / files). */
  @Output() changed = new EventEmitter<void>();

  updates: ProjectUpdate[] = [];
  loading = false;
  formMode: 'add' | 'edit' | null = null;
  editingId: number | null = null;
  draft = { title: '', body: '' };
  files: File[] = [];
  removeIds = new Set<number>();
  fileError: string | null = null;
  saving = false;
  busyId: number | null = null;
  private rules: UploadRule | null = null;

  t(key: string): string {
    return this.i18n.getValue(`projects.${key}`);
  }

  ngOnInit(): void {
    this.uploadRules.rules('project_thread').pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(rules => { this.rules = rules; this.cd.markForCheck(); });
    this.load();
  }

  /** @description Loads the updates (drafts too), newest first. */
  load(): void {
    this.loading = true;
    this.cd.markForCheck();
    this.dataHandler.getCollection<ProjectUpdate>(`project-portal/projects/${this.projectId}/updates`).subscribe({
      next: (rows) => { this.updates = Array.isArray(rows) ? rows : []; this.loading = false; this.cd.markForCheck(); },
      error: () => { this.loading = false; this.cd.markForCheck(); },
    });
  }

  openAdd(): void {
    if (!this.canEdit) return;
    this.formMode = 'add';
    this.editingId = null;
    this.draft = { title: '', body: '' };
    this.resetFiles();
  }

  /**
   * @description Opens the form of an update.
   * @param update Update of the list.
   */
  openEdit(update: ProjectUpdate): void {
    if (!this.canEdit) return;
    this.formMode = 'edit';
    this.editingId = update.id;
    this.draft = { title: update.title, body: update.body };
    this.resetFiles();
  }

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

  /** @description The update being edited. */
  get editing(): ProjectUpdate | undefined {
    return this.updates.find(u => u.id === this.editingId);
  }

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

  toggleRemove(id: number): void {
    const next = new Set(this.removeIds);
    next.has(id) ? next.delete(id) : next.add(id);
    this.removeIds = next;
  }

  /**
   * @description Saves the form; `publish` true publishes (a new one / a draft), false keeps a
   *   draft (a published one stays published when only edited).
   * @param publish Publish now.
   */
  save(publish: boolean): void {
    const title = this.draft.title.trim();
    const body = this.draft.body.trim();
    if (!this.canEdit || !title || !body || this.saving) return;
    const form = new FormData();
    form.append('title', title);
    form.append('body', body);
    if (publish || this.formMode === 'add') form.append('publish', publish ? '1' : '0');
    this.files.forEach(file => form.append('attachments[]', file, file.name));
    this.removeIds.forEach(id => form.append('remove_attachment_ids[]', String(id)));
    const url = this.formMode === 'edit' ? `project-portal/projects/${this.projectId}/updates/${this.editingId}` : `project-portal/projects/${this.projectId}/updates`;
    this.submit(url, form, this.formMode === 'add');
  }

  /**
   * @description Publishes a draft / takes a published update back to a draft.
   * @param update Update.
   * @param publish Publish (true) or back to a draft (false).
   */
  async setPublished(update: ProjectUpdate, publish: boolean): Promise<void> {
    if (!this.canEdit || this.busyId !== null) return;
    const key = publish ? 'update_publish' : 'update_unpublish';
    if (!(await this.confirm.open(this.t(`${key}_confirm_title`), this.t(`${key}_confirm_message`).replace('{title}', update.title)))) return;
    this.busyId = update.id;
    this.cd.markForCheck();
    this.dataHandler.postWithMeta<ProjectUpdate, { notified: number }>(`project-portal/projects/${this.projectId}/updates/${update.id}`, { publish }).subscribe({
      next: (res) => {
        this.busyId = null;
        this.updates = this.updates.map(u => (u.id === update.id ? res.data : u));
        this.notifyResult(res.meta?.notified ?? 0, publish);
        this.changed.emit();
        this.cd.markForCheck();
      },
      error: () => { this.busyId = null; this.cd.markForCheck(); },
    });
  }

  /**
   * @description Deletes an update after a confirmation.
   * @param update Update.
   */
  async remove(update: ProjectUpdate): Promise<void> {
    if (!this.canEdit || this.busyId !== null) return;
    if (!(await this.confirm.open(this.t('update_delete_confirm_title'), this.t('update_delete_confirm_message').replace('{title}', update.title)))) return;
    this.busyId = update.id;
    this.cd.markForCheck();
    this.dataHandler.delete(`project-portal/projects/${this.projectId}/updates/${update.id}`).subscribe({
      next: () => {
        this.busyId = null;
        this.updates = this.updates.filter(u => u.id !== update.id);
        this.changed.emit();
        this.cd.markForCheck();
      },
      error: () => { this.busyId = null; this.cd.markForCheck(); },
    });
  }

  /** @description Sends the form (multipart). */
  private submit(url: string, form: FormData, isNew: boolean): void {
    this.saving = true;
    this.cd.markForCheck();
    this.dataHandler.postWithMeta<ProjectUpdate, { notified: number }>(url, form).subscribe({
      next: (res) => {
        this.saving = false;
        const saved = res.data;
        this.updates = isNew ? [saved, ...this.updates] : this.updates.map(u => (u.id === saved.id ? saved : u));
        if (form.get('publish') === '1') this.notifyResult(res.meta?.notified ?? 0, true);
        this.cancelForm();
        this.changed.emit();
        this.cd.markForCheck();
      },
      error: () => { this.saving = false; this.cd.markForCheck(); },
    });
  }

  /** @description Tells how many client e-mails a publication sent. */
  private notifyResult(notified: number, published: boolean): void {
    if (!published) return;
    this.alert.open(this.i18n.getValue('shared.success'), this.t('update_published_message').replace('{count}', String(notified)), 'success');
  }

  formatFileSize(bytes: number): string {
    return formatProjectFileSize(bytes);
  }
}
