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
import { LangMeta } from './base-translation-editor.component';

@Component({
  selector: 'app-translation-editor-view',
  standalone: true,
  imports: [AsyncPipe, UpperCasePipe, FormsModule, PageTitlesEditorComponent, PageHeaderComponent, RowButtonBuilderComponent, StickyBarDirective, AdminModalComponent],
  templateUrl: './translation-editor-view.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../../../shared/styles/base.css', '../../shared-styles/settings-page.css', '../../shared-styles/modal.css', './translation-editor-view.component.css'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TranslationEditorViewComponent {
  /** The editor shown (its state, texts and actions). */
  @Input({ required: true }) e!: BaseTranslationEditorComponent;

  /**
   * Calmer actions (2026-11, pilot on the texts of the website): everything about the languages -
   * on / off, JSON download / upload per language, delete, a new language - is in one window
   * behind the "Jazyky" button of the page header; the language tabs only switch the language
   * (no small action icons, no "+ Přidat jazyk" - that is in the window); the sticky bar keeps only
   * "Uložit změny (n)" and shows the edited language only while it floats; on a phone the save
   * button is a bar at the bottom, shown only with unsaved changes; next to the save button
   * "Zrušit změny" (after a confirmation back to the saved texts); the statistics of the language
   * are one line and the search row has the "Chybí" toggle (only the missing texts).
   */
  @Input() compactActions = false;

  /** The window "Spravovat jazyky" is open. */
  manageOpen = false;

  /** @description The "Jazyky" button of the page header opens the window "Spravovat jazyky". */
  openManage(): void {
    this.manageOpen = true;
  }

  /**
   * @description Downloads the saved JSON of a language from its row.
   * @param lang The language.
   */
  manageDownload(lang: LangMeta): void {
    this.e.downloadSavedJson(lang.code);
  }

  /**
   * @description The row of the open language warns that its unsaved edits are not in the download.
   * @param lang The language.
   */
  hasUnsavedEdits(lang: LangMeta): boolean {
    return this.e.isDirty && lang.code === this.e.currentLang;
  }

  /** @description Closes the window "Spravovat jazyky". */
  closeManage(): void {
    this.manageOpen = false;
  }

  /**
   * @description Turns a language on / off - the window stays open (its state changes in place).
   * @param lang The language.
   */
  manageToggle(lang: LangMeta): void {
    this.e.toggleLangActive(lang);
  }

  /**
   * @description Opens the upload of a JSON for a language (its own window - this one closes).
   * @param lang The language.
   */
  manageUpload(lang: LangMeta): void {
    this.manageOpen = false;
    this.e.openUploadModal(lang.code);
  }

  /**
   * @description Asks to delete a language (its own confirmation window - this one closes).
   * @param lang The language.
   */
  manageDelete(lang: LangMeta): void {
    this.manageOpen = false;
    this.e.askDeleteLang(lang);
  }

  /** @description Opens the form of a new language (its own window - this one closes). */
  manageAdd(): void {
    this.manageOpen = false;
    this.e.openAddForm();
  }

  /** The confirmation of throwing away the unsaved edits is open. */
  discardOpen = false;

  /** @description "Zrušit změny" (sticky bar / bottom bar) asks first - the edits cannot be brought back. */
  askDiscard(): void {
    this.discardOpen = true;
  }

  /** @description Closes the confirmation, the edits stay. */
  closeDiscard(): void {
    this.discardOpen = false;
  }

  /** @description Throws the edits away - the open language is loaded again in the saved version. */
  confirmDiscard(): void {
    this.discardOpen = false;
    this.e.discardChanges();
  }

  /** @description Text of the confirmation - how many edits of which language are thrown away. */
  get discardMessage(): string {
    const lang = this.e.getCurrentLangMeta()?.name ?? this.e.currentLang.toUpperCase();
    return this.e.t('discard_confirm_message')
      .replace('{count}', String(this.e.changedPaths.size))
      .replace('{lang}', lang);
  }

  /** @description Label of the save button - with the count of the changed texts when there are any. */
  get saveLabel(): string {
    const count = this.e.changedPaths.size;
    return count > 0 ? this.e.t('save_changes_count').replace('{count}', String(count)) : this.e.t('save_changes_button');
  }
}
