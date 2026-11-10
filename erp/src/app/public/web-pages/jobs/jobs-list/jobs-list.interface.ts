/**
 * @file jobs-list.interface.ts
 * @path src/app/public/web-pages/jobs/jobs-list/jobs-list.interface.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description One card of the Careers list (texts already in the current language).
 */

export interface JobItem {
  /** URL of the detail (slug). */
  id: string;
  title: string;
  shortDescription: string;
}
