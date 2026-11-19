/**
 * @file knowledge-base-editor.component.ts
 * @path src/app/apps/web/admin/edit-website/content-editors/knowledge-base-editor/knowledge-base-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Editor of the public knowledge base (/knowledge-base; web/edit-website, tab
 *   Knowledge base; API web/knowledge-base): the introduction of the page (main heading + first
 *   text) and the blocks - heading, text, optional sub-blocks (smaller heading + text, added with
 *   a button) and an optional image shown at the end of the block on the website; every text per
 *   language; add, reorder, hide, remove - saved at once.
 * @usage `<app-knowledge-base-editor [hostLanguages]="languages" (dirtyChange)="setTabDirty('knowledge_base', $event)" />`
 * @note The introduction is always the first entry (the API refuses anything else): it cannot be
 *   moved, hidden or removed and has no sub-blocks and no image.
 * @note The image is uploaded / removed at once (POST / DELETE web/knowledge-base/{id}/image), not
 *   with "Save" - so only for a saved block (same reasons as the image of a reference). It is
 *   checked in the browser first (JPG / PNG / WebP only - no video, no SVG - at most 5 MB, the
 *   same limits as the API) and stored by the API re-encoded as WebP (scaled down, metadata
 *   dropped); a file that is not a readable image is refused by the API.
 * @dependencies
 * - I18nContentEditorBase (languages, save / discard, missing translations).
 * - RowButtonBuilderComponent: the language tabs.
 * - PublicDataService (URL of the image on the public storage), AlertDialogService.
 * - REFERENCE_IMAGE_TYPES / REFERENCE_IMAGE_MAX_BYTES (same image limits as the references).
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { StickyBarDirective } from '../../../../../../shared/directives/sticky-bar.directive';
import { I18nContentEditorBase } from '../i18n-content-editor.base';
import { CheckedText, KbItemDraft, KbSectionDraft } from '../content-editor.model';
import { PublicDataService } from '../../../../../../shared/services/public-data.service';
import { AlertDialogService } from '../../../../../../core/services/alert-dialog.service';
import { RowButtonBuilderComponent } from '../../../../../../admin/components/builders/row-button-builder/row-button-builder.component';
import { REFERENCE_IMAGE_MAX_BYTES, REFERENCE_IMAGE_TYPES } from '../references-editor/references-editor.component';

@Component({
  selector: 'app-knowledge-base-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, StickyBarDirective, RowButtonBuilderComponent],
  templateUrl: './knowledge-base-editor.component.html',
  styleUrl: '../content-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeBaseEditorComponent extends I18nContentEditorBase<KbSectionDraft> {
  protected readonly endpoint = 'web/knowledge-base';
  protected readonly payloadKey = 'sections';

  readonly imageAccept = REFERENCE_IMAGE_TYPES.join(',');

  /** Same limits as the API (WebKnowledgeBaseController). */
  readonly MAX_HEADING = 150;
  readonly MAX_TEXT = 5000;
  readonly MAX_ITEM_TITLE = 150;
  readonly MAX_ITEM_TEXT = 2000;
  readonly MAX_BLOCKS = 50;
  readonly MAX_ITEMS = 20;

  /** Image path (public storage) per saved block id - kept apart from the drafts (not saved with them). */
  private readonly images = new Map<number, string | null>();
  /** Block id whose image is being uploaded / removed (null = none). */
  imageBusy: number | null = null;

  private readonly publicData = inject(PublicDataService);
  private readonly alerts = inject(AlertDialogService);

  /** @description The introduction (always the first entry). */
  get intro(): KbSectionDraft | undefined {
    return this.entries[0]?.is_intro ? this.entries[0] : undefined;
  }

  /** @description Number of blocks (without the introduction). */
  get blockCount(): number {
    return this.entries.length - (this.intro ? 1 : 0);
  }

  protected fromApi(rows: any[]): KbSectionDraft[] {
    const drafts = rows.map(row => {
      const id = typeof row?.id === 'number' ? row.id : null;
      // Rows of the API carry the image; rows of the saved state (payload shape) do not.
      if (id !== null && row && 'image' in row) this.images.set(id, typeof row.image === 'string' ? row.image : null);
      const isIntro = row?.is_intro === true;
      return {
        key: this.newKey(),
        id,
        is_intro: isIntro,
        is_active: isIntro || row?.is_active !== false,
        heading_i18n: this.i18nOf(row?.heading_i18n),
        text_i18n: this.i18nOf(row?.text_i18n),
        items: isIntro ? [] : (Array.isArray(row?.items) ? row.items : []).map((item: any) => this.itemOf(item)),
        open: false,
      };
    });
    // The introduction always exists and is first (an empty one when the API has none).
    const intro = drafts.find(draft => draft.is_intro) ?? {
      key: this.newKey(), id: null, is_intro: true, is_active: true,
      heading_i18n: this.emptyText(), text_i18n: this.emptyText(), items: [], open: false,
    };
    return [intro, ...drafts.filter(draft => !draft.is_intro)];
  }

  protected toPayload(entries: KbSectionDraft[]): unknown[] {
    return entries.map(section => ({
      id: section.id,
      is_intro: section.is_intro,
      is_active: section.is_active,
      heading_i18n: section.heading_i18n,
      text_i18n: section.text_i18n,
      items: section.items.map(item => ({ id: item.id, title_i18n: item.title_i18n, text_i18n: item.text_i18n })),
    }));
  }

  protected checkedTexts(): CheckedText[] {
    return this.entries.flatMap(section => this.textsOf(section));
  }

  /** @description Texts of the introduction / a block checked for missing translations. */
  private textsOf(section: KbSectionDraft): CheckedText[] {
    return [
      { text: section.heading_i18n },
      { text: section.text_i18n },
      ...section.items.flatMap(item => [{ text: item.title_i18n }, { text: item.text_i18n }]),
    ];
  }

  /** @description Draft of an API sub-block. */
  private itemOf(item: any): KbItemDraft {
    return {
      key: this.newKey(),
      id: typeof item?.id === 'number' ? item.id : null,
      title_i18n: this.i18nOf(item?.title_i18n),
      text_i18n: this.i18nOf(item?.text_i18n),
    };
  }

  /** @description Adds an empty block at the end (expanded, hidden on the website until shown). */
  addBlock(): void {
    if (this.blockCount >= this.MAX_BLOCKS) return;
    this.entries.push({
      key: this.newKey(), id: null, is_intro: false, is_active: false,
      heading_i18n: this.emptyText(), text_i18n: this.emptyText(), items: [], open: true,
    });
    this.changed();
  }

  /**
   * @description Adds an empty sub-block at the end of a block.
   * @param block The block.
   */
  addItem(block: KbSectionDraft): void {
    if (block.is_intro || block.items.length >= this.MAX_ITEMS) return;
    block.items.push(this.itemOf({}));
    this.changed();
  }

  /**
   * @description Moves a block up / down - never in front of the introduction.
   * @param index Position of the block in `entries`.
   * @param delta -1 = up, 1 = down.
   */
  moveBlock(index: number, delta: number): void {
    if (this.entries[index]?.is_intro || this.entries[index + delta]?.is_intro) return;
    this.move(this.entries, index, delta);
  }

  /**
   * @description Removes a block (saved only with "Save"); the introduction stays.
   * @param index Position of the block in `entries`.
   */
  removeBlock(index: number): void {
    if (this.entries[index]?.is_intro) return;
    this.remove(this.entries, index);
  }

  /**
   * @description Expands / collapses a block.
   * @param block The block.
   */
  toggle(block: KbSectionDraft): void {
    block.open = !block.open;
    this.cd.markForCheck();
  }

  /**
   * @description How many texts of a block miss the edited language (badge of the block).
   * @param block The block.
   */
  missingIn(block: KbSectionDraft): number {
    return this.textsOf(block).filter(c => this.isMissing(c.text, !!c.optional)).length;
  }

  /**
   * @description Heading of a block in the edited language (header of its card).
   * @param block The block.
   */
  titleOf(block: KbSectionDraft): string {
    return block.heading_i18n[this.lang]?.trim() || this.strings.kb_untitled;
  }

  /**
   * @description URL of the image of a saved block (null = none / not saved yet).
   * @param block The block.
   */
  imageUrl(block: KbSectionDraft): string | null {
    const path = block.id !== null ? this.images.get(block.id) : null;
    return path ? this.publicData.getStorageUrl(path) : null;
  }

  /**
   * @description Uploads the chosen image of a saved block (replaces the previous one) after the
   *   checks of the browser (type, size).
   * @param block The block.
   * @param event Change event of the file input.
   */
  onImageSelected(block: KbSectionDraft, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || block.id === null || block.is_intro || !this.canUpdate) return;
    if (!REFERENCE_IMAGE_TYPES.includes(file.type)) {
      this.alerts.open(this.strings.kb_image_error_title, this.strings.kb_image_error_type, 'warning');
      return;
    }
    if (file.size > REFERENCE_IMAGE_MAX_BYTES) {
      this.alerts.open(this.strings.kb_image_error_title, this.strings.kb_image_error_size, 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    this.runImage(block.id, this.dataHandler.upload<{ image: string | null }>(`web/knowledge-base/${block.id}/image`, formData));
  }

  /**
   * @description Removes the image of a saved block.
   * @param block The block.
   */
  removeImage(block: KbSectionDraft): void {
    if (block.id === null || !this.canUpdate) return;
    this.runImage(block.id, this.dataHandler.delete<{ image: null }>(`web/knowledge-base/${block.id}/image`));
  }

  /**
   * @description Runs an image request of a block; the answer is its new image.
   * @param id Block id.
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
        // The reason is shown by DataHandler.handleError() (invalid file, missing block).
        this.imageBusy = null;
        this.cd.markForCheck();
      },
    });
  }
}
