/**
 * @file tech-stack.config.ts
 * @path src/app/public/web-pages/home/tech-stack.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static configuration of the technology stack shown in the home page
 * "tech stack" marquee (two rows, top row moves right, bottom row moves left).
 * The stack is intentionally static (bundled with the frontend, no API / DB / admin),
 * because it changes only when the company's development stack changes - see
 * home.component.html (tech-stack section).
 *
 * Adding a logo: put the SVG into `src/assets/images/tech-stack/` and set `logo` to its
 * path (e.g. 'assets/images/tech-stack/angular.svg'). While `logo` is `null`, the card
 * renders an image placeholder with the technology name.
 *
 * @note Technology names are brand names and are NOT translated. All other visible
 * texts of the section (heading, lead, pause button, screen-reader label) live in the
 * public i18n (`home.tech_stack.*`).
 */

/** One card in the tech-stack marquee. */
export interface TechStackItem {
  /** Brand name - used as `alt` text and as the placeholder caption. Not translated. */
  name: string;
  /** Path to the logo in `assets/`, or `null` to render the image placeholder. */
  logo: string | null;
}

export const TECH_STACK_ROW_TOP: TechStackItem[] = [
  { name: 'Angular', logo: 'assets/images/icons/angular.svg' },
  { name: 'Laravel', logo: 'assets/images/icons/laravel.svg' },
  { name: 'Flutter', logo: 'assets/images/icons/flutter.svg' },
  { name: 'C#', logo: 'assets/images/icons/csharp.svg' },
  { name: 'PostgreSQL', logo: 'assets/images/icons/postgresql.svg' },     
  { name: 'SQLite', logo: 'assets/images/icons/sqlite.svg' },   
];

export const TECH_STACK_ROW_BOTTOM: TechStackItem[] = [
  
  { name: 'Docker', logo: 'assets/images/icons/docker.svg' },
  { name: 'Linux', logo: 'assets/images/icons/linux.svg' },
  { name: 'Windows', logo: 'assets/images/icons/windows.svg' },
  { name: 'Android', logo: 'assets/images/icons/android.svg' },
  { name: 'iOS', logo: 'assets/images/icons/ios.svg' },
  { name: 'Redis', logo: 'assets/images/icons/redis.svg' },   

];

/**
 * @description Builds the item list for one seamless marquee track: the row is first
 * repeated until one copy has at least `minPerCopy` cards (so a single copy is always
 * wider than the viewport, even on wide screens), then that copy is duplicated. The CSS
 * animation moves the track by exactly -50 % (= one copy), so the loop has no visible jump.
 * @param items Cards of one row.
 * @param minPerCopy Minimum number of cards in one copy.
 * @returns Two identical copies concatenated; empty array for an empty row.
 */
export function buildMarqueeLoop(items: TechStackItem[], minPerCopy: number = 10): TechStackItem[] {
  if (items.length === 0) return [];

  let copy: TechStackItem[] = [...items];
  while (copy.length < minPerCopy) {
    copy = [...copy, ...items];
  }
  return [...copy, ...copy];
}