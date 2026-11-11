/**
 * @file faq-editor.component.ts
 * @path src/app/admin/web-pages/edit-website/content-editors/faq-editor/faq-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Editor of the FAQ of the public website (web/edit-website, tab FAQ; API web/faq):
 *   categories (the tabs of the FAQ page) with their questions and answers, every text per
 *   language; add, reorder, move a question to another category, remove - saved at once.
 * @usage `<app-faq-editor (dirtyChange)="faqDirty = $event"></app-faq-editor>`
 * @dependencies
 * - I18nContentEditorBase (languages, save / discard, missing translations).
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StickyBarDirective } from '../../../../../shared/directives/sticky-bar.directive';
import { I18nContentEditorBase } from '../i18n-content-editor.base';
import { CheckedText, FaqCategoryDraft, FaqItemDraft } from '../content-editor.model';

@Component({
  selector: 'app-faq-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, StickyBarDirective],
  templateUrl: './faq-editor.component.html',
  styleUrl: '../content-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqEditorComponent extends I18nContentEditorBase<FaqCategoryDraft> {
  protected readonly endpoint = 'web/faq';
  protected readonly payloadKey = 'categories';

  /** Same limits as the API (WebFaqController). */
  readonly MAX_NAME = 120;
  readonly MAX_QUESTION = 500;
  readonly MAX_ANSWER = 5000;

  protected fromApi(rows: any[]): FaqCategoryDraft[] {
    return rows.map((row, index) => ({
      key: this.newKey(),
      id: typeof row?.id === 'number' ? row.id : null,
      name_i18n: this.i18nOf(row?.name_i18n),
      items: (Array.isArray(row?.items) ? row.items : []).map((item: any) => this.itemOf(item)),
      open: index === 0,
    }));
  }

  protected toPayload(entries: FaqCategoryDraft[]): unknown[] {
    return entries.map(category => ({
      id: category.id,
      name_i18n: category.name_i18n,
      items: category.items.map(item => ({ id: item.id, question_i18n: item.question_i18n, answer_i18n: item.answer_i18n })),
    }));
  }

  protected checkedTexts(): CheckedText[] {
    return this.entries.flatMap(category => [
      { text: category.name_i18n },
      ...category.items.flatMap(item => [{ text: item.question_i18n }, { text: item.answer_i18n }]),
    ]);
  }

  /** @description Draft of an API question. */
  private itemOf(item: any): FaqItemDraft {
    return {
      key: this.newKey(),
      id: typeof item?.id === 'number' ? item.id : null,
      question_i18n: this.i18nOf(item?.question_i18n),
      answer_i18n: this.i18nOf(item?.answer_i18n),
    };
  }

  /** @description Adds an empty category at the end (expanded). */
  addCategory(): void {
    this.entries.push({ key: this.newKey(), id: null, name_i18n: this.emptyText(), items: [], open: true });
    this.changed();
  }

  /**
   * @description Adds an empty question at the end of a category.
   * @param category The category (expanded).
   */
  addItem(category: FaqCategoryDraft): void {
    category.items.push(this.itemOf({}));
    category.open = true;
    this.changed();
  }

  /**
   * @description Moves a question to another category (at its end).
   * @param from Current category.
   * @param index Position of the question.
   * @param targetKey Key of the target category.
   */
  moveItemTo(from: FaqCategoryDraft, index: number, targetKey: number | string): void {
    const target = this.entries.find(c => c.key === Number(targetKey));
    if (!target || target === from) return;
    target.items.push(...from.items.splice(index, 1));
    target.open = true;
    this.changed();
  }

  /**
   * @description Expands / collapses a category.
   * @param category The category.
   */
  toggle(category: FaqCategoryDraft): void {
    category.open = !category.open;
    this.cd.markForCheck();
  }

  /**
   * @description How many texts of a category miss the edited language (badge of the category).
   * @param category The category.
   */
  missingIn(category: FaqCategoryDraft): number {
    return [category.name_i18n, ...category.items.flatMap(i => [i.question_i18n, i.answer_i18n])]
      .filter(text => this.isMissing(text)).length;
  }

  /**
   * @description "Questions: 3" of a category header.
   * @param category The category.
   */
  questionCount(category: FaqCategoryDraft): string {
    return (this.strings.faq_question_count ?? '').replace('{count}', String(category.items.length));
  }

  /**
   * @description Name of a category in the edited language (header of its card).
   * @param category The category.
   */
  nameOf(category: FaqCategoryDraft): string {
    return category.name_i18n[this.lang]?.trim() || this.strings.faq_unnamed_category;
  }
}
