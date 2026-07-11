import {
  Component,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '../../../shared/imports/web-providers';
import { BasePublicComponent } from '../../base-public.component';
import { FaqItem, FaqCategory } from './';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqComponent extends BasePublicComponent {

  protected readonly translationKey = 'faq';
  protected override readonly loadSiteSettings = true;

  activeCategory: string = 'obecne';
  filteredItems: FaqItem[] = [];

  get categories(): FaqCategory[] {
    if (!this.t?.categories) return [];
    return Object.entries(this.t.categories).map(([id, label]) => ({
      id,
      label: label as string
    }));
  }

  private get categoryItems(): Record<string, FaqItem[]> {
    if (!this.t?.items) return {};
    const result: Record<string, FaqItem[]> = {};
    for (const [cat, items] of Object.entries(this.t.items)) {
      result[cat] = (items as Array<{ question: string; answer: string }>).map(i => ({
        question: i.question,
        answer: i.answer,
        isActive: false
      }));
    }
    return result;
  }

  // Hook volaný po načtení překladů z báze
  protected override onTranslationsLoaded(): void {
    this.setCategory(this.activeCategory);
  }

  setCategory(id: string): void {
    this.activeCategory = id;
    this.filteredItems = (this.categoryItems[id] ?? []).map(item => ({ ...item, isActive: false }));
    this.cdr.markForCheck();
  }

  toggleFaq(item: FaqItem): void {
    item.isActive = !item.isActive;
    this.cdr.markForCheck();
  }
}