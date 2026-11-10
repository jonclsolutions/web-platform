/**
 * @file references-editor.component.ts
 * @path src/app/admin/web-pages/edit-website/content-editors/references-editor/references-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Editor of the references of the public website (web/edit-website, tab References;
 *   API web/references): the row of the list (name, year, client), shown / hidden, category
 *   (free text, e.g. "Audit"), scope, role, description, key features, technology stack, result and an optional image -
 *   every text per language; add, reorder, remove - saved at once.
 * @usage `<app-references-editor [hostLanguages]="languages" (dirtyChange)="referencesDirty = $event"></app-references-editor>`
 * @note The image is uploaded / removed at once (POST / DELETE web/references/{id}/image), not
 *   with "Save" - so only for a saved reference. Why at once: "Save" sends all references as one
 *   JSON request (texts only); with files in it every save would be a large multipart request and
 *   one bad image would refuse all text changes. Alone, the upload is small, checked and stored
 *   on its own (an error concerns one image only) and the preview shows the stored image at once.
 *   The image lives apart from the drafts, so it is neither "unsaved" nor undone by "Discard".
 *   It is checked in the browser first (type, at most 5 MB - the same limits as the API) and
 *   stored by the API as WebP (scaled down, metadata dropped). With an image the website shows the key features in one column and the image next
 *   to them.
 * @dependencies
 * - I18nContentEditorBase (languages, save / discard, missing translations).
 * - PublicDataService (URL of the image on the public storage), AlertDialogService.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { I18nContentEditorBase } from '../i18n-content-editor.base';
import { CheckedText, ReferenceDraft, ReferenceFeatureDraft, ReferenceStackDraft } from '../content-editor.model';
import { PublicDataService } from '../../../../../shared/services/public-data.service';
import { AlertDialogService } from '../../../../../core/services/alert-dialog.service';

/** @description Accepted image types (WebReferenceController: mimes jpg, jpeg, png, webp). */
export const REFERENCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** @description Largest accepted image (WebReferenceController: max 5120 kB). */
export const REFERENCE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-references-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './references-editor.component.html',
  styleUrl: '../content-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferencesEditorComponent extends I18nContentEditorBase<ReferenceDraft> {
  protected readonly endpoint = 'web/references';
  protected readonly payloadKey = 'references';

  readonly imageAccept = REFERENCE_IMAGE_TYPES.join(',');

  /** Same limits as the API (WebReferenceController). */
  readonly MAX_DURATION = 50;
  readonly MAX_CLIENT = 150;
  readonly MAX_NAME = 150;
  readonly MAX_CATEGORY = 80;
  readonly MAX_META = 200;
  readonly MAX_DESCRIPTION = 3000;
  readonly MAX_RESULT = 1000;
  readonly MAX_FEATURE = 300;
  readonly MAX_STACK_LABEL = 80;
  readonly MAX_STACK_VALUE = 300;

  /** Image path (public storage) per saved reference id - kept apart from the drafts (not saved with them). */
  private readonly images = new Map<number, string | null>();
  /** Reference id whose image is being uploaded / removed (null = none). */
  imageBusy: number | null = null;

  private readonly publicData = inject(PublicDataService);
  private readonly alerts = inject(AlertDialogService);

  protected fromApi(rows: any[]): ReferenceDraft[] {
    return rows.map(row => {
      const id = typeof row?.id === 'number' ? row.id : null;
      // Rows of the API carry the image; rows of the saved state (payload shape) do not.
      if (id !== null && row && 'image' in row) this.images.set(id, typeof row.image === 'string' ? row.image : null);
      return {
        key: this.newKey(),
        id,
        duration: typeof row?.duration === 'string' ? row.duration : '',
        client: typeof row?.client === 'string' ? row.client : '',
        is_active: row?.is_active !== false,
        category_i18n: this.i18nOf(row?.category_i18n),
        name_i18n: this.i18nOf(row?.name_i18n),
        size_i18n: this.i18nOf(row?.size_i18n),
        role_i18n: this.i18nOf(row?.role_i18n),
        description_i18n: this.i18nOf(row?.description_i18n),
        result_i18n: this.i18nOf(row?.result_i18n),
        features: (Array.isArray(row?.features) ? row.features : []).map((feature: any) => this.featureOf(feature)),
        stack: (Array.isArray(row?.stack) ? row.stack : []).map((layer: any) => this.stackOf(layer)),
        open: false,
      };
    });
  }

  protected toPayload(entries: ReferenceDraft[]): unknown[] {
    return entries.map(reference => ({
      id: reference.id,
      category_i18n: reference.category_i18n,
      duration: reference.duration,
      client: reference.client,
      is_active: reference.is_active,
      name_i18n: reference.name_i18n,
      size_i18n: reference.size_i18n,
      role_i18n: reference.role_i18n,
      description_i18n: reference.description_i18n,
      result_i18n: reference.result_i18n,
      features: reference.features.map(feature => ({ id: feature.id, text_i18n: feature.text_i18n })),
      stack: reference.stack.map(layer => ({ id: layer.id, label_i18n: layer.label_i18n, value_i18n: layer.value_i18n })),
    }));
  }

  protected checkedTexts(): CheckedText[] {
    return this.entries.flatMap(reference => this.textsOf(reference));
  }

  /** @description Texts of a reference checked for missing translations. */
  private textsOf(reference: ReferenceDraft): CheckedText[] {
    return [
      { text: reference.name_i18n },
      { text: reference.category_i18n, optional: true },
      { text: reference.size_i18n, optional: true },
      { text: reference.role_i18n, optional: true },
      { text: reference.description_i18n },
      { text: reference.result_i18n, optional: true },
      ...reference.features.map(feature => ({ text: feature.text_i18n })),
      ...reference.stack.flatMap(layer => [{ text: layer.label_i18n }, { text: layer.value_i18n }]),
    ];
  }

  /** @description Draft of an API feature. */
  private featureOf(feature: any): ReferenceFeatureDraft {
    return { key: this.newKey(), id: typeof feature?.id === 'number' ? feature.id : null, text_i18n: this.i18nOf(feature?.text_i18n) };
  }

  /** @description Draft of an API stack row. */
  private stackOf(layer: any): ReferenceStackDraft {
    return {
      key: this.newKey(),
      id: typeof layer?.id === 'number' ? layer.id : null,
      label_i18n: this.i18nOf(layer?.label_i18n),
      value_i18n: this.i18nOf(layer?.value_i18n),
    };
  }

  /** @description Adds an empty reference at the end (expanded, hidden on the website until shown). */
  addReference(): void {
    this.entries.push({
      key: this.newKey(), id: null, duration: '', client: '', is_active: false,
      category_i18n: this.emptyText(), name_i18n: this.emptyText(), size_i18n: this.emptyText(), role_i18n: this.emptyText(),
      description_i18n: this.emptyText(), result_i18n: this.emptyText(),
      features: [this.featureOf({})], stack: [], open: true,
    });
    this.changed();
  }

  /**
   * @description Adds an empty key feature at the end of a reference.
   * @param reference The reference.
   */
  addFeature(reference: ReferenceDraft): void {
    reference.features.push(this.featureOf({}));
    this.changed();
  }

  /**
   * @description Adds an empty stack row at the end of a reference.
   * @param reference The reference.
   */
  addStack(reference: ReferenceDraft): void {
    reference.stack.push(this.stackOf({}));
    this.changed();
  }

  /**
   * @description Expands / collapses a reference.
   * @param reference The reference.
   */
  toggle(reference: ReferenceDraft): void {
    reference.open = !reference.open;
    this.cd.markForCheck();
  }

  /**
   * @description How many texts of a reference miss the edited language (badge of the reference).
   * @param reference The reference.
   */
  missingIn(reference: ReferenceDraft): number {
    return this.textsOf(reference).filter(c => this.isMissing(c.text, !!c.optional)).length;
  }

  /**
   * @description Name of a reference in the edited language (header of its card).
   * @param reference The reference.
   */
  titleOf(reference: ReferenceDraft): string {
    return reference.name_i18n[this.lang]?.trim() || this.strings.refs_untitled;
  }

  /**
   * @description URL of the image of a saved reference (null = none / not saved yet).
   * @param reference The reference.
   */
  imageUrl(reference: ReferenceDraft): string | null {
    const path = reference.id !== null ? this.images.get(reference.id) : null;
    return path ? this.publicData.getStorageUrl(path) : null;
  }

  /**
   * @description Uploads the chosen image of a saved reference (replaces the previous one).
   * @param reference The reference.
   * @param event Change event of the file input.
   */
  onImageSelected(reference: ReferenceDraft, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || reference.id === null || !this.canUpdate) return;
    if (!REFERENCE_IMAGE_TYPES.includes(file.type)) {
      this.alerts.open(this.strings.refs_image_error_title, this.strings.refs_image_error_type, 'warning');
      return;
    }
    if (file.size > REFERENCE_IMAGE_MAX_BYTES) {
      this.alerts.open(this.strings.refs_image_error_title, this.strings.refs_image_error_size, 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    this.runImage(reference.id, this.dataHandler.upload<{ image: string | null }>(`web/references/${reference.id}/image`, formData));
  }

  /**
   * @description Removes the image of a saved reference.
   * @param reference The reference.
   */
  removeImage(reference: ReferenceDraft): void {
    if (reference.id === null || !this.canUpdate) return;
    this.runImage(reference.id, this.dataHandler.delete<{ image: null }>(`web/references/${reference.id}/image`));
  }

  /**
   * @description Runs an image request of a reference; the answer is its new image.
   * @param id Reference id.
   * @param request$ Upload / removal.
   */
  private runImage(id: number, request$: Observable<{ image: string | null } | null>): void {
    this.imageBusy = id;
    this.cd.markForCheck();
    request$.subscribe({
      next: res => {
        this.images.set(id, res?.image ?? null);
        this.imageBusy = null;
        this.cd.markForCheck();
      },
      error: () => {
        // The reason is shown by DataHandler.handleError() (invalid file, missing reference).
        this.imageBusy = null;
        this.cd.markForCheck();
      },
    });
  }
}
