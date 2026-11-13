/**
 * @file project-templates.component.ts
 * @path src/app/admin/web-pages/project-templates/project-templates.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Project templates" (web/projects/templates): named lists of checkpoints a
 *   new project starts with (create form of a project) or that are added to a project (its
 *   Progress). Each checkpoint has a title, a description and its due date as days after the
 *   start. Add, edit (rows added, removed, moved), delete. A template can also be saved from a
 *   project (Progress → "Save as a template").
 * @dependencies DataHandler (project-portal/projects/templates), AdminLocalizationService, ConfirmDialogService,
 *   AlertDialogService, PermissionService (web-projects-update)
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

/** @description Checkpoint of a template. */
export interface TemplateCheckpoint {
  label: string;
  description: string | null;
  /** Due date as days after the start (null = no date). */
  offset_days: number | null;
}

/** @description Project template (API). */
export interface ProjectTemplate {
  id: number;
  name: string;
  description: string | null;
  checkpoints: TemplateCheckpoint[];
  updated_at?: string;
}

/** @description Form of a template (offset as text of the number input). */
export interface TemplateDraft {
  name: string;
  description: string;
  checkpoints: { label: string; description: string; offset_days: string }[];
}

@Component({
  selector: 'app-project-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, PageHelpComponent],
  templateUrl: './project-templates.component.html',
  styleUrls: ['../project-detail/project-detail.component.css', '../project-detail/project-sections.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTemplatesComponent implements OnInit {
  private readonly dataHandler = inject(DataHandler);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly alert = inject(AlertDialogService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly cd = inject(ChangeDetectorRef);

  templates: ProjectTemplate[] = [];
  loading = false;
  /** Edited template: 'new' or its id; null = closed. */
  editing: 'new' | number | null = null;
  draft: TemplateDraft = ProjectTemplatesComponent.emptyDraft();
  saving = false;

  /** @description Empty form with one checkpoint row. */
  static emptyDraft(): TemplateDraft {
    return { name: '', description: '', checkpoints: [{ label: '', description: '', offset_days: '' }] };
  }

  t(key: string): string {
    return this.i18n.getValue(`projects.${key}`);
  }

  /** @description May the user change templates? */
  get canEdit(): boolean {
    return this.permissions.hasPermission('web-projects-update');
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.cd.markForCheck();
    this.dataHandler.getCollection<ProjectTemplate>('project-portal/projects/templates').subscribe({
      next: (rows) => { this.templates = Array.isArray(rows) ? rows : []; this.loading = false; this.cd.markForCheck(); },
      error: () => { this.loading = false; this.cd.markForCheck(); },
    });
  }

  openNew(): void {
    if (!this.canEdit) return;
    this.editing = 'new';
    this.draft = ProjectTemplatesComponent.emptyDraft();
  }

  /**
   * @description Opens the form of a template.
   * @param template Template of the list.
   */
  openEdit(template: ProjectTemplate): void {
    if (!this.canEdit) return;
    this.editing = template.id;
    this.draft = {
      name: template.name,
      description: template.description ?? '',
      checkpoints: template.checkpoints.map(c => ({
        label: c.label, description: c.description ?? '', offset_days: c.offset_days === null ? '' : String(c.offset_days),
      })),
    };
  }

  cancel(): void {
    this.editing = null;
  }

  addRow(): void {
    this.draft.checkpoints = [...this.draft.checkpoints, { label: '', description: '', offset_days: '' }];
  }

  /**
   * @description Removes a checkpoint row (at least one stays).
   * @param index Row.
   */
  removeRow(index: number): void {
    if (this.draft.checkpoints.length <= 1) return;
    this.draft.checkpoints = this.draft.checkpoints.filter((_, i) => i !== index);
  }

  /**
   * @description Moves a checkpoint row up / down.
   * @param index Row.
   * @param delta -1 up, +1 down.
   */
  moveRow(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= this.draft.checkpoints.length) return;
    const rows = [...this.draft.checkpoints];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    this.draft.checkpoints = rows;
  }

  /** @description Name and every checkpoint title are filled; days are whole numbers 0–3650. */
  get draftValid(): boolean {
    return this.draft.name.trim() !== '' && this.draft.checkpoints.length > 0
      && this.draft.checkpoints.every(c => c.label.trim() !== '' && (c.offset_days === '' || /^\d{1,4}$/.test(String(c.offset_days)) && Number(c.offset_days) <= 3650));
  }

  /** @description Saves the form (the checkpoints replace the stored ones). */
  save(): void {
    if (!this.canEdit || !this.draftValid || this.saving) return;
    const payload = {
      name: this.draft.name.trim(),
      description: this.draft.description.trim() || null,
      checkpoints: this.draft.checkpoints.map(c => ({
        label: c.label.trim(),
        description: c.description.trim() || null,
        offset_days: c.offset_days === '' ? null : Number(c.offset_days),
      })),
    };
    const isNew = this.editing === 'new';
    const request = isNew
      ? this.dataHandler.post<ProjectTemplate>('project-portal/projects/templates', payload)
      : this.dataHandler.put<ProjectTemplate>(`project-portal/projects/templates/${this.editing}`, payload);
    this.saving = true;
    this.cd.markForCheck();
    request.subscribe({
      next: (saved) => {
        this.saving = false;
        this.templates = isNew ? [...this.templates, saved] : this.templates.map(t => (t.id === saved.id ? saved : t));
        this.templates.sort((a, b) => a.name.localeCompare(b.name));
        this.editing = null;
        this.alert.open(this.i18n.getValue('shared.success'), this.t('template_saved').replace('{name}', saved.name), 'success');
        this.cd.markForCheck();
      },
      error: () => { this.saving = false; this.cd.markForCheck(); },
    });
  }

  /**
   * @description Deletes a template after a confirmation (projects made from it keep their checkpoints).
   * @param template Template.
   */
  async remove(template: ProjectTemplate): Promise<void> {
    if (!this.canEdit) return;
    if (!(await this.confirm.open(this.t('template_delete_confirm_title'), this.t('template_delete_confirm_message').replace('{name}', template.name)))) return;
    this.dataHandler.delete(`project-portal/projects/templates/${template.id}`).subscribe({
      next: () => {
        this.templates = this.templates.filter(t => t.id !== template.id);
        if (this.editing === template.id) this.editing = null;
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description "+ N days" label of a checkpoint.
   * @param days Offset (null = none).
   */
  offsetLabel(days: number | null): string {
    return days === null ? this.t('template_no_date') : this.t('template_offset').replace('{days}', String(days));
  }
}
