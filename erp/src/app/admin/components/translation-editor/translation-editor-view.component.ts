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
 * @dependencies BaseTranslationEditorComponent, PageTitlesEditorComponent, PageHelpComponent,
 *   AdminIconComponent, StickyBarDirective, FormsModule.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AsyncPipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BaseTranslationEditorComponent } from './base-translation-editor.component';
import { PageTitlesEditorComponent } from '../page-titles-editor/page-titles-editor.component';
import { PageHelpComponent } from '../page-help/page-help.component';
import { AdminIconComponent } from '../admin-icon/admin-icon.component';
import { StickyBarDirective } from '../../../shared/directives/sticky-bar.directive';

@Component({
  selector: 'app-translation-editor-view',
  standalone: true,
  imports: [AsyncPipe, UpperCasePipe, FormsModule, PageTitlesEditorComponent, PageHelpComponent, AdminIconComponent, StickyBarDirective],
  templateUrl: './translation-editor-view.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../../../shared/styles/base.css', '../../shared-styles/settings-page.css', './translation-editor-view.component.css'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TranslationEditorViewComponent {
  /** The editor shown (its state, texts and actions). */
  @Input({ required: true }) e!: BaseTranslationEditorComponent;
}
