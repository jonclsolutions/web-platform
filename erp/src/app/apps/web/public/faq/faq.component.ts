/**
 * @file faq.component.ts
 * @path src/app/apps/web/public/faq/faq.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description FAQ page: category tabs and the questions of the chosen category (accordion),
 * a contact card. The categories and questions come from the database (admin: web/edit-website,
 * tab FAQ) in all languages; the static texts of the page from the `faq` translations.
 * @note A text missing in the current language shows 'Cannot load text' (WebContentService).
 * Answers are plain text - their line breaks are kept (CSS `white-space: pre-line`), never HTML.
 * @dependencies
 * - BasePublicComponent (translations, site settings, current language), WebContentService.
 */

import {
  Component,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '../web-providers';
import { BasePublicComponent } from '../../../../public/base-public.component';
import { FaqItem, FaqCategory } from './';
import { combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PublicFaqCategory, WebContentService, localizedText } from '../web-content.service';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './faq.component.html',
  styleUrls: ['../shared-styles/theme.css', '../shared-styles/animations.css', '../shared-styles/cta.css', '../../../../shared/styles/base.css', '../shared-styles/faq-list.css', '../shared-styles/content-page.css', './faq.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqComponent extends BasePublicComponent {

  protected readonly translationKey = 'faq';
  protected override readonly loadSiteSettings = true;

  /** Category shown (id of the tab); the first one when none / an unknown one is chosen. */
  activeCategory = '';
  filteredItems: FaqItem[] = [];
  /** Category tabs in the current language. */
  categories: FaqCategory[] = [];

  private readonly webContent = inject(WebContentService);
  /** FAQ of the database (all languages). */
  private faq: PublicFaqCategory[] = [];
  private lang = 'cz';

  /** @description Loads the FAQ and follows the current language. */
  protected override onInit(): void {
    combineLatest([this.webContent.faq(), this.currentLanguage$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([faq, lang]) => {
        this.faq = Array.isArray(faq) ? faq : [];
        this.lang = lang;
        this.categories = this.faq.map(category => ({ id: String(category.id), label: localizedText(category.name, lang) }));
        this.setCategory(this.categories.some(c => c.id === this.activeCategory) ? this.activeCategory : (this.categories[0]?.id ?? ''));
      });
  }

  /**
   * @description Shows the questions of a category (all collapsed).
   * @param id Id of the category tab.
   */
  setCategory(id: string): void {
    this.activeCategory = id;
    const category = this.faq.find(c => String(c.id) === id);
    this.filteredItems = (category?.items ?? []).map(item => ({
      id: item.id,
      question: localizedText(item.question, this.lang),
      answer: localizedText(item.answer, this.lang),
      isActive: false,
    }));
    this.cdr.markForCheck();
  }

  toggleFaq(item: FaqItem): void {
    item.isActive = !item.isActive;
    this.cdr.markForCheck();
  }
}