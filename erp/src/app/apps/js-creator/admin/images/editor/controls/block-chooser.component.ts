/**
 * @file block-chooser.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/controls/block-chooser.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Popup choosing a block of the section to insert into a template: grid of the own
 *   blocks (thumbnail, name, size) with search and "load more". A click chooses the block; the
 *   editor loads its document and inserts an instance. New blocks are made on the page Blocks or
 *   by "Block from the selection".
 * @usage `@if (choosing) { <app-jc-block-chooser section="images" (chosen)="insert($event)" (dismissed)="choosing = false" /> }`
 * @dependencies AdminModalComponent, BlocksApiService, AdminLocalizationService (section `js-creator-editor`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { AdminModalComponent } from '../../../../../../admin/components/admin-modal/admin-modal.component';
import { BlocksApiService } from '../../../shared/blocks-api.service';
import { CreatorBlock } from '../../../shared/js-creator.models';
import { JsCreatorSectionId } from '../../../shared/js-creator-sections';

@Component({
  selector: 'app-jc-block-chooser',
  standalone: true,
  imports: [FormsModule, AdminModalComponent],
  template: `
    <app-admin-modal [heading]="t('choose_block')" size="lg" (dismissed)="dismissed.emit()">
      <div class="jc-chooser-bar">
        <input class="jc-input jc-chooser-search" type="search" [placeholder]="t('search')" [attr.aria-label]="t('search')"
          [(ngModel)]="search" (ngModelChange)="onSearch()" />
      </div>
      @if (items.length) {
        <div class="jc-chooser-grid">
          @for (block of items; track block.id) {
            <button type="button" class="jc-chooser-item" [title]="block.name" (click)="chosen.emit(block)">
              @if (block.thumb_url) {
                <img [src]="block.thumb_url" [alt]="block.name" loading="lazy" />
              } @else {
                <span class="jc-chooser-size">{{ block.width }} × {{ block.height }}</span>
              }
              <span>{{ block.name }}</span>
            </button>
          }
        </div>
        @if (page < lastPage) {
          <div class="jc-chooser-more">
            <button type="button" class="am-btn am-btn--secondary" [disabled]="loading" (click)="load(page + 1)">{{ t('load_more') }}</button>
          </div>
        }
      } @else if (!loading) {
        <p class="jc-chooser-empty">{{ search ? t('nothing_found') : t('blocks_empty') }}</p>
      }
    </app-admin-modal>
  `,
  styleUrls: ['../../../../../../admin/shared-styles/modal.css', './controls.css', './chooser.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockChooserComponent implements OnInit, OnDestroy {
  private readonly api = inject(BlocksApiService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Section of the blocks. */
  @Input() section: JsCreatorSectionId = 'images';
  /** A block was chosen. */
  @Output() readonly chosen = new EventEmitter<CreatorBlock>();
  /** The popup was closed. */
  @Output() readonly dismissed = new EventEmitter<void>();

  /** Loaded blocks. */
  items: CreatorBlock[] = [];
  /** Last loaded page. */
  page = 1;
  /** Last page. */
  lastPage = 1;
  /** Search. */
  search = '';
  /** Loading. */
  loading = false;

  private timer: ReturnType<typeof setTimeout> | null = null;

  /** @description Loads the first page. */
  ngOnInit(): void {
    this.load(1);
  }

  /** @description Stops the pending search. */
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

  /** @description Searches after a short pause. */
  onSearch(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(1), 300);
  }

  /**
   * @description Loads a page (1 replaces, others append), recently changed first.
   * @param page Page.
   */
  load(page: number): void {
    this.loading = true;
    this.cd.markForCheck();
    this.api.blocks(this.section, { page, search: this.search.trim(), sortBy: 'updated_at', sortDirection: 'desc' }).subscribe({
      next: result => {
        this.items = page === 1 ? result.data : [...this.items, ...result.data];
        this.page = result.meta.current_page;
        this.lastPage = result.meta.last_page;
        this.loading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cd.markForCheck();
      },
    });
  }
}
