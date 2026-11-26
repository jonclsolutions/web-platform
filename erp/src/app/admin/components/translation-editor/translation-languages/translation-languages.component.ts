/**
 * @file translation-languages.component.ts
 * @path src/app/admin/components/translation-editor/translation-languages/translation-languages.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The languages of a translation editor in one place: the window "Jazyky" (turn a
 *   language on / off, download / upload its JSON, delete it, add a new one) and the windows of a
 *   new language, of the JSON upload and of deleting a language. Used by the list of the texts
 *   (TranslationEditorViewComponent) and by the visual text editor - the same behaviour on both.
 * @usage `<app-translation-languages [e]="editor" [open]="manageOpen" (closed)="…" (changed)="…" />`
 * @dependencies BaseTranslationEditorComponent (state and actions of the languages), AdminModalComponent
 * @note The windows of a new language / upload / delete open above the window "Jazyky", which
 *   stays open (prompt level); without the window they are ordinary windows (old language tabs).
 */

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseTranslationEditorComponent, LangMeta } from '../base-translation-editor.component';
import { AdminModalComponent } from '../../admin-modal/admin-modal.component';

@Component({
  selector: 'app-translation-languages',
  standalone: true,
  imports: [UpperCasePipe, FormsModule, AdminModalComponent],
  templateUrl: './translation-languages.component.html',
  styleUrls: ['../../../shared-styles/theme.css', '../../../../shared/styles/base.css', '../../../shared-styles/settings-page.css', '../../../shared-styles/modal.css', './translation-languages.component.css'],
})
export class TranslationLanguagesComponent {
  /** Translation editor of the module (languages and their actions). */
  @Input({ required: true }) e!: BaseTranslationEditorComponent;
  /** The window "Jazyky" is open. */
  /** The window "Jazyky" is shown - opening it asks again what the languages lack (their switch-on). */
  @Input() set open(value: boolean) {
    if (value && !this.isOpen) this.e?.loadCompleteness();
    this.isOpen = value;
  }
  get open(): boolean {
    return this.isOpen;
  }
  private isOpen = false;
  /** The window "Jazyky" was closed. */
  @Output() closed = new EventEmitter<void>();
  /** A language was turned on / off, uploaded, deleted or added (the texts / languages may differ). */
  @Output() changed = new EventEmitter<void>();

  /** @description Closes the window "Jazyky". */
  closeManage(): void {
    this.closed.emit();
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

  /**
   * @description Turns a language on / off - the window stays open (its state changes in place).
   * @param lang The language.
   */
  manageToggle(lang: LangMeta): void {
    this.changed.emit();
    this.e.toggleLangActive(lang);
  }

  /**
   * @description Opens a language with only its missing texts (the window closes) - what it lacks
   *   for its switch-on.
   * @param lang Language.
   */
  showMissing(lang: LangMeta): void {
    this.closeManage();
    this.e.showMissingIn(lang.code);
  }

  /**
   * @description Opens the upload of a JSON for a language - its window opens above this one,
   *   which stays open under it (closing / finishing the upload comes back here).
   * @param lang The language.
   */
  manageUpload(lang: LangMeta): void {
    this.changed.emit();
    this.e.openUploadModal(lang.code);
  }

  /**
   * @description Asks to delete a language - the confirmation opens above this window, which
   *   stays open (a "Zrušit" by mistake comes back to the list, a delete updates it in place).
   * @param lang The language.
   */
  manageDelete(lang: LangMeta): void {
    this.changed.emit();
    this.e.askDeleteLang(lang);
  }

  /**
   * @description Opens the form of a new language above this window, which stays open - the
   *   added language appears in its list.
   */
  manageAdd(): void {
    this.changed.emit();
    this.e.openAddForm();
  }
}
