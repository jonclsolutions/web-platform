/**
 * @file faq.interface.ts
 * @path src/app/apps/web/public/faq/faq.interface.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Types of the FAQ page: one question in the current language and one category tab.
 */

/** One question of the shown category (texts already in the current language). */
export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  isActive: boolean;
}

/** One category tab (id of the category in the database, as a string). */
export interface FaqCategory {
  id: string;
  label: string;
}
