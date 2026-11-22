/**
 * @file pages-bar.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/pages-bar/pages-bar.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Slides of a carousel in the template editor: a small preview of every page
 *   (drawn by the renderer, again a moment after a change), a click shows the page; actions of
 *   the shown page - new empty slide, copy of the slide, move earlier / later, delete. A template
 *   has at most DOCUMENT_LIMITS.maxPages slides; read-only accounts only switch pages.
 * @usage `<app-jc-pages-bar [store]="store" [resources]="resources" [redraw]="redraw()" />`
 * @dependencies EditorStore, renderer.ts, RenderResourceStore, CreatorIconComponent,
 *   ConfirmDialogService, AdminLocalizationService (section `js-creator-editor`).
 */

import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, QueryList, ViewChildren, computed, effect, inject, input,
} from '@angular/core';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { ConfirmDialogService } from '../../../../../../core/services/confirm-dialog.service';
import { CreatorIconComponent } from '../../../shared/creator-icon/creator-icon.component';
import { DOCUMENT_LIMITS } from '../../../shared/render/document';
import { renderPage } from '../../../shared/render/renderer';
import { RenderResourceStore } from '../../../shared/render/resource-store';
import { UiIconName, uiIcon } from '../../../shared/ui-icons';
import { EditorStore } from '../editor-store';

/** Height of a preview (CSS px). */
const PREVIEW_HEIGHT = 56;

/** Pause after a change before the previews are drawn again (ms). */
const REDRAW_DELAY = 400;

@Component({
  selector: 'app-jc-pages-bar',
  standalone: true,
  imports: [CreatorIconComponent],
  template: `
    <div class="pb" role="toolbar" [attr.aria-label]="t('slides')">
      <span class="pb-label">{{ t('slides') }} {{ store().pageIndex() + 1 }} / {{ store().pageCount() }}</span>
      <div class="pb-list">
        @for (page of pages(); track $index; let i = $index) {
          <button type="button" class="pb-page" [class.pb-page--on]="i === store().pageIndex()" [title]="t('slide') + ' ' + (i + 1)"
            [attr.aria-label]="t('slide') + ' ' + (i + 1)" [attr.aria-current]="i === store().pageIndex() ? 'true' : null" (click)="store().setPage(i)">
            <canvas #preview class="pb-canvas" [style.height.px]="previewHeight" [style.width.px]="previewWidth()"></canvas>
            <span class="pb-number">{{ i + 1 }}</span>
          </button>
        }
      </div>
      @if (store().editable && store().kind === 'template') {
        <span class="pb-actions">
          <button type="button" class="pb-btn" [disabled]="!store().canAddPage()" [title]="t('slide_add') + ' (' + store().pageCount() + ' / ' + maxPages + ')'"
            [attr.aria-label]="t('slide_add')" (click)="store().addPage()"><app-creator-icon [nodes]="icon('plus')" [size]="15" /></button>
          <button type="button" class="pb-btn" [disabled]="!store().canAddPage()" [title]="t('slide_copy')" [attr.aria-label]="t('slide_copy')"
            (click)="store().addPage(true)"><app-creator-icon [nodes]="icon('copy')" [size]="15" /></button>
          <button type="button" class="pb-btn" [disabled]="store().pageIndex() === 0" [title]="t('slide_earlier')" [attr.aria-label]="t('slide_earlier')"
            (click)="store().movePage(-1)"><app-creator-icon [nodes]="icon('arrow-left')" [size]="15" /></button>
          <button type="button" class="pb-btn" [disabled]="store().pageIndex() >= store().pageCount() - 1" [title]="t('slide_later')"
            [attr.aria-label]="t('slide_later')" (click)="store().movePage(1)"><app-creator-icon [nodes]="icon('arrow-right')" [size]="15" /></button>
          <button type="button" class="pb-btn pb-btn--danger" [disabled]="store().pageCount() < 2" [title]="t('slide_delete')" [attr.aria-label]="t('slide_delete')"
            (click)="remove()"><app-creator-icon [nodes]="icon('trash')" [size]="15" /></button>
        </span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pb { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--color-zinc-200); background: #fff; }
    .pb-label { flex: 0 0 auto; font-size: 0.74rem; font-weight: 600; color: var(--color-zinc-600); white-space: nowrap; }
    .pb-list { display: flex; gap: 6px; flex: 1 1 auto; min-width: 0; overflow-x: auto; padding: 2px; }
    .pb-page { position: relative; flex: 0 0 auto; padding: 0; border: 2px solid transparent; border-radius: 6px; background: var(--color-zinc-100); cursor: pointer; line-height: 0; }
    .pb-page--on { border-color: var(--color-amber-500); }
    .pb-page:focus-visible { outline: 2px solid var(--color-amber-500); outline-offset: 1px; }
    .pb-canvas { display: block; border-radius: 4px; }
    .pb-number { position: absolute; left: 3px; bottom: 3px; padding: 1px 5px; border-radius: 999px; background: rgba(24, 24, 27, 0.75); color: #fff; font-size: 0.65rem; line-height: 1.4; }
    .pb-actions { display: flex; gap: 2px; flex: 0 0 auto; }
    .pb-btn { display: inline-flex; padding: 6px; border: 0; border-radius: 6px; background: none; color: var(--color-zinc-700); cursor: pointer; }
    .pb-btn:disabled { opacity: 0.35; cursor: default; }
    .pb-btn--danger { color: var(--color-rose-600); }
    .pb-btn:focus-visible { outline: 2px solid var(--color-amber-500); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagesBarComponent implements OnDestroy {
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);

  /** State of the editor. */
  readonly store = input.required<EditorStore>();
  /** Images, fonts, icons of the renderer. */
  readonly resources = input.required<RenderResourceStore>();
  /** Changes when a resource finished loading. */
  readonly redraw = input(0);

  @ViewChildren('preview') private previews?: QueryList<ElementRef<HTMLCanvasElement>>;

  /** Height of a preview (CSS px). */
  readonly previewHeight = PREVIEW_HEIGHT;
  /** Most slides. */
  readonly maxPages = DOCUMENT_LIMITS.maxPages;
  /** Pages of the document. */
  readonly pages = computed(() => this.store().doc().pages);
  /** Width of a preview (CSS px, the aspect of the template). */
  readonly previewWidth = computed(() => {
    const size = this.store().size();
    return Math.max(16, Math.round(PREVIEW_HEIGHT * size.width / size.height));
  });

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.store().state();
      this.redraw();
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.draw(), REDRAW_DELAY);
    });
  }

  /** @description Stops the pending drawing. */
  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  /**
   * @description Text of the editor.
   * @param key Key in `js-creator-editor`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-editor.${key}`);
  }

  /**
   * @description Icon of a button.
   * @param name Icon.
   */
  icon(name: UiIconName) {
    return uiIcon(name);
  }

  /** @description Deletes the shown slide after a confirmation. */
  async remove(): Promise<void> {
    const store = this.store();
    if (store.pageCount() < 2) return;
    if (!(await this.confirm.open(this.t('slide_delete'), `${this.t('slide_delete_text')} ${store.pageIndex() + 1}`))) return;
    store.removePage();
  }

  /** @description Draws the previews of every page (editor mode - samples of the fields). */
  private draw(): void {
    const canvases = this.previews?.toArray() ?? [];
    const store = this.store();
    const size = store.size();
    const doc = store.doc();
    const width = this.previewWidth();
    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    canvases.forEach((ref, index) => {
      const canvas = ref.nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx || !doc.pages[index]) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(PREVIEW_HEIGHT * dpr);
      ctx.setTransform(canvas.width / size.width, 0, 0, canvas.height / size.height, 0, 0);
      try {
        renderPage(ctx, doc, size, this.resources(), { mode: 'editor', page: index });
      } catch {
        // A preview is only a help - the canvas of the editor shows the real state.
      }
    });
  }
}
