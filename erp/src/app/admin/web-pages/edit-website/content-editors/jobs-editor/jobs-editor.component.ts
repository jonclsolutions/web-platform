/**
 * @file jobs-editor.component.ts
 * @path src/app/admin/web-pages/edit-website/content-editors/jobs-editor/jobs-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Editor of the open positions of the public website (web/edit-website, tab Jobs;
 *   API web/jobs): the preview of the list (title, short description), the URL, shown / hidden,
 *   type and place of work and the blocks of the detail (optional heading + text), every text per
 *   language; add, reorder, remove - saved at once.
 * @usage `<app-jobs-editor (dirtyChange)="jobsDirty = $event"></app-jobs-editor>`
 * @note The URL (slug) of a new position is made from its title when left empty; it must be
 *   unique and contain lower-case letters, digits and hyphens only (checked before saving and by
 *   the API).
 * @dependencies
 * - I18nContentEditorBase (languages, save / discard, missing translations).
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nContentEditorBase } from '../i18n-content-editor.base';
import { CheckedText, JobDraft, JobSectionDraft } from '../content-editor.model';

/** @description Allowed URL of a position - same rule as the API (WebJobController::SLUG_PATTERN). */
export const JOB_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Component({
  selector: 'app-jobs-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jobs-editor.component.html',
  styleUrl: '../content-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobsEditorComponent extends I18nContentEditorBase<JobDraft> {
  protected readonly endpoint = 'web/jobs';
  protected readonly payloadKey = 'jobs';

  /** Same limits as the API (WebJobController). */
  readonly MAX_SLUG = 80;
  readonly MAX_TITLE = 150;
  readonly MAX_SUMMARY = 500;
  readonly MAX_META = 80;
  readonly MAX_HEADING = 150;
  readonly MAX_BODY = 5000;

  protected fromApi(rows: any[]): JobDraft[] {
    return rows.map(row => ({
      key: this.newKey(),
      id: typeof row?.id === 'number' ? row.id : null,
      slug: typeof row?.slug === 'string' ? row.slug : '',
      is_active: row?.is_active !== false,
      title_i18n: this.i18nOf(row?.title_i18n),
      summary_i18n: this.i18nOf(row?.summary_i18n),
      type_i18n: this.i18nOf(row?.type_i18n),
      location_i18n: this.i18nOf(row?.location_i18n),
      sections: (Array.isArray(row?.sections) ? row.sections : []).map((section: any) => this.sectionOf(section)),
      open: false,
    }));
  }

  protected toPayload(entries: JobDraft[]): unknown[] {
    return entries.map(job => ({
      id: job.id,
      slug: job.slug,
      is_active: job.is_active,
      title_i18n: job.title_i18n,
      summary_i18n: job.summary_i18n,
      type_i18n: job.type_i18n,
      location_i18n: job.location_i18n,
      sections: job.sections.map(section => ({ id: section.id, heading_i18n: section.heading_i18n, body_i18n: section.body_i18n })),
    }));
  }

  protected checkedTexts(): CheckedText[] {
    return this.entries.flatMap(job => this.textsOf(job));
  }

  /** @description Texts of a position checked for missing translations. */
  private textsOf(job: JobDraft): CheckedText[] {
    return [
      { text: job.title_i18n },
      { text: job.summary_i18n },
      { text: job.type_i18n, optional: true },
      { text: job.location_i18n, optional: true },
      ...job.sections.flatMap(section => [{ text: section.heading_i18n, optional: true }, { text: section.body_i18n }]),
    ];
  }

  /** @description Every URL valid and unique; otherwise the message of the problem. */
  protected override validate(): string {
    const slugs = this.entries.map(job => job.slug.trim());
    if (slugs.some(slug => !JOB_SLUG_PATTERN.test(slug))) return this.strings.jobs_slug_invalid;
    if (new Set(slugs).size !== slugs.length) return this.strings.jobs_slug_duplicate;
    return '';
  }

  /** @description Draft of an API block. */
  private sectionOf(section: any): JobSectionDraft {
    return {
      key: this.newKey(),
      id: typeof section?.id === 'number' ? section.id : null,
      heading_i18n: this.i18nOf(section?.heading_i18n),
      body_i18n: this.i18nOf(section?.body_i18n),
    };
  }

  /** @description Adds an empty position at the end (expanded, hidden on the website until shown). */
  addJob(): void {
    this.entries.push({
      key: this.newKey(), id: null, slug: '', is_active: false,
      title_i18n: this.emptyText(), summary_i18n: this.emptyText(), type_i18n: this.emptyText(), location_i18n: this.emptyText(),
      sections: [this.sectionOf({})], open: true,
    });
    this.changed();
  }

  /**
   * @description Adds an empty block at the end of a position.
   * @param job The position.
   */
  addSection(job: JobDraft): void {
    job.sections.push(this.sectionOf({}));
    this.changed();
  }

  /**
   * @description Expands / collapses a position.
   * @param job The position.
   */
  toggle(job: JobDraft): void {
    job.open = !job.open;
    this.cd.markForCheck();
  }

  /**
   * @description Makes the URL of a position without one from its title (when leaving the title).
   * @param job The position.
   */
  suggestSlug(job: JobDraft): void {
    if (job.slug.trim()) return;
    const title = job.title_i18n[this.lang] || Object.values(job.title_i18n).find(t => t.trim()) || '';
    const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, this.MAX_SLUG).replace(/-+$/, '');
    if (slug) {
      job.slug = slug;
      this.changed();
    }
  }

  /**
   * @description Whether the URL of a position is invalid or used by another one.
   * @param job The position.
   */
  slugProblem(job: JobDraft): string {
    const slug = job.slug.trim();
    if (!JOB_SLUG_PATTERN.test(slug)) return this.strings.jobs_slug_invalid;
    if (this.entries.some(other => other !== job && other.slug.trim() === slug)) return this.strings.jobs_slug_duplicate;
    return '';
  }

  /**
   * @description How many texts of a position miss the edited language (badge of the position).
   * @param job The position.
   */
  missingIn(job: JobDraft): number {
    return this.textsOf(job).filter(c => this.isMissing(c.text, !!c.optional)).length;
  }

  /**
   * @description Title of a position in the edited language (header of its card).
   * @param job The position.
   */
  titleOf(job: JobDraft): string {
    return job.title_i18n[this.lang]?.trim() || job.slug || this.strings.jobs_untitled;
  }
}
