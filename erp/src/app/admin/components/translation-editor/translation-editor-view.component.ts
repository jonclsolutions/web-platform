/**
 * @file translation-editor-view.component.ts
 * @path src/app/admin/components/translation-editor/translation-editor-view.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page of a translation editor of an application (texts of its module, its
 *   browser page titles, its extra tabs). The editor (BaseTranslationEditorComponent) keeps the
 *   state and logic and passes itself in; the panels of its extra tabs are its content.
 * @usage `<app-translation-editor-view [e]="this"> …panels of extraTabs… </app-translation-editor-view>`
 * @dependencies BaseTranslationEditorComponent, PageTitlesEditorComponent, PageHeaderComponent,
 *   RowButtonBuilderComponent (page tabs), StickyBarDirective, FormsModule, AdminModalComponent
 *   (frame of the add language / upload JSON / delete language popups).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AsyncPipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BaseTranslationEditorComponent } from './base-translation-editor.component';
import { PageTitlesEditorComponent } from '../page-titles-editor/page-titles-editor.component';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { RowButtonBuilderComponent } from '../builders/row-button-builder/row-button-builder.component';
import { StickyBarDirective } from '../../../shared/directives/sticky-bar.directive';
import { AdminModalComponent } from '../admin-modal/admin-modal.component';
import { ActionMenuBuilderComponent } from '../builders/action-menu-builder/action-menu-builder.component';
import { Button } from '../../../shared/interfaces/button';

@Component({
  selector: 'app-translation-editor-view',
  standalone: true,
  imports: [AsyncPipe, UpperCasePipe, FormsModule, PageTitlesEditorComponent, PageHeaderComponent, RowButtonBuilderComponent, StickyBarDirective, AdminModalComponent, ActionMenuBuilderComponent],
  templateUrl: './translation-editor-view.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../../../shared/styles/base.css', '../../shared-styles/settings-page.css', '../../shared-styles/modal.css', './translation-editor-view.component.css'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TranslationEditorViewComponent {
  /** The editor shown (its state, texts and actions). */
  @Input({ required: true }) e!: BaseTranslationEditorComponent;

  /**
   * Calmer actions (2026-11, pilot on the texts of the website): the rare JSON download / upload
   * move to the "⋯ Akce" menu of the page header, the sticky bar keeps only "Uložit změny (n)";
   * on a phone the save button is a bar at the bottom, shown only with unsaved changes.
   */
  @Input() compactActions = false;

  /** Cache of `menuActions` (stable array for the OnPush action menu). */
  private menuCache: { key: string; buttons: Button[] } | null = null;

  /** @description Items of the "⋯ Akce" menu: download JSON; upload JSON with the edit permission. */
  get menuActions(): Button[] {
    const key = `${this.e.t('download_json_button')}|${this.e.t('upload_json_button')}|${this.e.canUpdate}`;
    if (this.menuCache?.key !== key) {
      this.menuCache = {
        key,
        buttons: [
          { action: 'downloadJson', label: this.e.t('download_json_button'), class: 'btn-neutral' },
          { action: 'uploadJson', label: this.e.t('upload_json_button'), class: 'btn-neutral', showIf: this.e.canUpdate },
        ],
      };
    }
    return this.menuCache.buttons;
  }

  /**
   * @description An item of the "⋯ Akce" menu: download the JSON of the active language, or
   *   open the upload of a JSON for it.
   * @param action 'downloadJson' or 'uploadJson'.
   */
  onMenuAction(action: string): void {
    if (action === 'downloadJson') this.e.downloadJson();
    else if (action === 'uploadJson') this.e.openUploadModal(this.e.currentLang);
  }

  /** @description Label of the save button - with the count of the changed texts when there are any. */
  get saveLabel(): string {
    const count = this.e.changedPaths.size;
    return count > 0 ? this.e.t('save_changes_count').replace('{count}', String(count)) : this.e.t('save_changes_button');
  }
}
