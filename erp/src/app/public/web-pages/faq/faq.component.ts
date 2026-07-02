import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '../../../shared/imports/web-providers';
import * as Web from '../../../shared/imports/web-providers';
import { FaqItem } from '../components/interfaces/faq-item';
import { PublicDataService } from '../../../shared/services/public-data.service';

export interface FaqCategory {
  id: string;
  label: string;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqComponent implements Web.OnInit, Web.OnDestroy {
  t: any = null;
  settings: any = null;
  socialLinks: any[] = [];

  private destroy$ = new Web.Subject<void>();

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

  constructor(
    private localizationService: Web.LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.faq) {
          this.t = translations.faq;
          // Refresh items whenever translations change (e.g. language switch)
          this.setCategory(this.activeCategory);
          this.cdr.markForCheck();
        }
      });

    this.publicDataService.getSiteSettings()
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });
  }

  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}