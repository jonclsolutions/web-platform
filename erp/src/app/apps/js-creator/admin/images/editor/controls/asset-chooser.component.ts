/**
 * @file asset-chooser.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/controls/asset-chooser.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Popup choosing a library image for a fixed image of a template (logo, background,
 *   photo): grid of the own images with search and "load more", upload of a new image (one file,
 *   type, size and quota checked before sending). A click on an image chooses it.
 * @usage `@if (choosing) { <app-jc-asset-chooser (chosen)="use($event)" (dismissed)="choosing = false" /> }`
 * @dependencies AdminModalComponent, JsCreatorApiService, WorkspaceUsageService,
 *   UploadRulesService (js_creator_image), AlertDialogService, PermissionService,
 *   AdminLocalizationService (section `js-creator-editor`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../../../core/services/alert-dialog.service';
import { PermissionService } from '../../../../../../core/auth/services/permission.service';
import { AdminModalComponent } from '../../../../../../admin/components/admin-modal/admin-modal.component';
import { UploadRulesService } from '../../../../../../shared/services/upload-rules.service';
import { UploadRule, isExtensionAllowed } from '../../../../../../shared/utils/upload-rules';
import { JsCreatorApiService } from '../../../shared/js-creator-api.service';
import { WorkspaceUsageService } from '../../../shared/workspace-usage.service';
import { CreatorAsset } from '../../../shared/js-creator.models';
import { can } from '../../../shared/js-creator-sections';

@Component({
  selector: 'app-jc-asset-chooser',
  standalone: true,
  imports: [FormsModule, AdminModalComponent],
  template: `
    <app-admin-modal [heading]="t('choose_image')" size="lg" [closeDisabled]="uploading" (dismissed)="dismissed.emit()">
      <div class="jc-chooser-bar">
        <input class="jc-input jc-chooser-search" type="search" [placeholder]="t('search')" [attr.aria-label]="t('search')"
          [(ngModel)]="search" (ngModelChange)="onSearch()" />
        @if (canUpload) {
          <label class="jc-upload" [class.jc-upload--busy]="uploading">
            {{ uploading ? t('uploading') : t('upload_image') }}
            <input type="file" [accept]="accept" [disabled]="uploading" (change)="upload($event)" />
          </label>
        }
      </div>
      @if (items.length) {
        <div class="jc-chooser-grid">
          @for (asset of items; track asset.id) {
            <button type="button" class="jc-chooser-item" [title]="asset.name" (click)="chosen.emit(asset)">
              <img [src]="asset.thumb_url" [alt]="asset.name" loading="lazy" />
              <span>{{ asset.name }}</span>
            </button>
          }
        </div>
        @if (page < lastPage) {
          <div class="jc-chooser-more">
            <button type="button" class="am-btn am-btn--secondary" [disabled]="loading" (click)="load(page + 1)">{{ t('load_more') }}</button>
          </div>
        }
      } @else if (!loading) {
        <p class="jc-chooser-empty">{{ search ? t('nothing_found') : t('library_empty') }}</p>
      }
    </app-admin-modal>
  `,
  styleUrls: ['../../../../../../admin/shared-styles/modal.css', './controls.css', './chooser.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetChooserComponent implements OnInit, OnDestroy {
  private readonly api = inject(JsCreatorApiService);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly uploadRules = inject(UploadRulesService);
  private readonly alert = inject(AlertDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly cd = inject(ChangeDetectorRef);

  /** An image was chosen. */
  @Output() readonly chosen = new EventEmitter<CreatorAsset>();
  /** The popup was closed. */
  @Output() readonly dismissed = new EventEmitter<void>();

  /** Loaded images. */
  items: CreatorAsset[] = [];
  /** Last loaded page. */
  page = 1;
  /** Last page. */
  lastPage = 1;
  /** Search. */
  search = '';
  /** Loading. */
  loading = false;
  /** Upload running. */
  uploading = false;
  /** Rules of the upload. */
  rules: UploadRule | null = null;
  /** May upload. */
  readonly canUpload = can(this.permissions, 'create');

  private timer: ReturnType<typeof setTimeout> | null = null;
  private rulesSub?: Subscription;

  /** @description Loads the first page and the upload rules. */
  ngOnInit(): void {
    this.rulesSub = this.uploadRules.rules('js_creator_image').subscribe(rules => {
      this.rules = rules;
      this.cd.markForCheck();
    });
    this.load(1);
  }

  /** @description Stops the pending search. */
  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.rulesSub?.unsubscribe();
  }

  /**
   * @description Text of the editor.
   * @param key Key in `js-creator-editor`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-editor.${key}`);
  }

  /** @description Accept attribute of the file input. */
  get accept(): string {
    return (this.rules?.extensions ?? ['jpg', 'jpeg', 'png', 'webp']).map(e => `.${e}`).join(',');
  }

  /** @description Searches after a short pause. */
  onSearch(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(1), 300);
  }

  /**
   * @description Loads a page (1 replaces, others append).
   * @param page Page.
   */
  load(page: number): void {
    this.loading = true;
    this.cd.markForCheck();
    this.api.assets({ page, search: this.search.trim() }).subscribe({
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

  /**
   * @description Uploads the chosen file and chooses the new image.
   * @param event Change of the file input.
   */
  upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const rules = this.rules;
    if (rules && (!isExtensionAllowed(file.name, rules.extensions) || file.size > rules.max_file_size_mb * 1024 * 1024)) {
      this.alert.open(this.t('upload_refused_title'), `${this.t('upload_refused_text')} ${file.name}`, 'warning');
      return;
    }
    if (!this.usage.fits(file.size)) {
      this.alert.open(this.t('quota_full_title'), this.t('quota_full_text'), 'warning');
      return;
    }
    this.uploading = true;
    this.cd.markForCheck();
    this.api.uploadAsset(file).subscribe({
      next: assets => {
        this.uploading = false;
        this.usage.refresh();
        if (assets?.[0]) this.chosen.emit(assets[0]);
        this.cd.markForCheck();
      },
      error: () => {
        this.uploading = false;
        this.cd.markForCheck();
      },
    });
  }
}
