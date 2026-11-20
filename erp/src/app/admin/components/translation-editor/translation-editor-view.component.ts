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
}
