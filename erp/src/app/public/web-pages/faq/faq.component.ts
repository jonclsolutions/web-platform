/**
 * @file faq.component.ts
 * @path src/app/public/web-pages/faq/faq.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages the FAQ page, handling category filtering, localized question-answer toggling, and site-wide metadata integration.
 * @dependencies
 * - LocalizationService: Supplies translated content for categories and FAQ items.
 * - PublicDataService: Provides access to dynamic site configuration and asset URLs.
 * - Angular Core/Common: Manages component state, DOM rendering, and lifecycle.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '../../../shared/imports/web-providers';
import * as Web from '../../../shared/imports/web-providers';
import { FaqItem } from '../components/interfaces/faq-item';
import { PublicDataService } from '../../../shared/services/public-data.service';

export interface FaqCategory {
  id: string;
  label: string;
}

/**
 * @description Component for displaying Frequently Asked Questions organized by category.
 * @usage Users can switch between categories to view relevant question-answer sets.
 * @note Uses OnPush change detection to maintain high performance when toggling numerous FAQ items.
 */
@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqComponent implements Web.OnInit, Web.OnDestroy {
  /** Translation object container */
  t: any = null;
  /** Global site settings */
  settings: any = null;
  /** Footer/Social link metadata */
  socialLinks: any[] = [];

  private destroy$ = new Web.Subject<void>();

  activeCategory: string = 'obecne';
  filteredItems: FaqItem[] = [];

  /**
   * @description Derives available categories from translation files.
   * @returns Array of category IDs and labels; returns an empty array if no categories are defined.
   */
  get categories(): FaqCategory[] {
    if (!this.t?.categories) return [];
    return Object.entries(this.t.categories).map(([id, label]) => ({
      id,
      label: label as string
    }));
  }

  /**
   * @description Maps raw translation items to structured FaqItem objects.
   * @returns A dictionary of category IDs mapped to their respective FAQ item lists.
   */
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

  /**
   * @description Initializes data streams for translations and site configuration.
   */
  ngOnInit(): void {
    // 1. Translations stream: Triggers category set refresh on language change
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.faq) {
          this.t = translations.faq;
          this.setCategory(this.activeCategory);
          this.cdr.markForCheck();
        }
      });

    // 2. Settings stream: Fetches global settings for site branding/socials
    this.publicDataService.getSiteSettings()
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });
  }

  /**
   * @description Resolves storage asset URLs.
   * @param path The relative path to the asset.
   */
  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  /**
   * @description Filters FAQ items based on the selected category ID.
   * @param id The selected category identifier.
   */
  setCategory(id: string): void {
    this.activeCategory = id;
    this.filteredItems = (this.categoryItems[id] ?? []).map(item => ({ ...item, isActive: false }));
    this.cdr.markForCheck();
  }

  /**
   * @description Toggles the expanded/collapsed state of an individual FAQ item.
   * @param item The FAQ item to toggle.
   */
  toggleFaq(item: FaqItem): void {
    item.isActive = !item.isActive;
    this.cdr.markForCheck();
  }

  /**
   * @description Cleans up RxJS subscriptions.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}