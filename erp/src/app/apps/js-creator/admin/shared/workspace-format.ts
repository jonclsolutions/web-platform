/**
 * @file workspace-format.ts
 * @path src/app/apps/js-creator/admin/shared/workspace-format.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Pure helpers of the workspace pages: sizes in B / kB / MB / GB and the level of the
 *   usage of a quota (ok, warning from 80 %, full at 100 %).
 */

/** Level of the usage of a quota. */
export type UsageLevel = 'ok' | 'warning' | 'full';

/** Share of the quota from which the usage bar warns. */
export const USAGE_WARNING_SHARE = 0.8;

/**
 * @description Human size of a number of bytes (base 1024, one decimal from kB on).
 * @param bytes Size.
 * @param locale Number locale (e.g. 'cs-CZ' = decimal comma).
 * @returns E.g. "512 B", "1,5 MB".
 */
export function formatBytes(bytes: number, locale = 'cs-CZ'): string {
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)} ${units[unit]}`;
}

/**
 * @description Level of the usage of a quota.
 * @param used Used bytes.
 * @param quota Allowed bytes.
 * @returns 'full' at 100 % and more, 'warning' from 80 %, otherwise 'ok'.
 */
export function usageLevel(used: number, quota: number): UsageLevel {
  if (quota <= 0 || used >= quota) return 'full';
  return used >= quota * USAGE_WARNING_SHARE ? 'warning' : 'ok';
}

/**
 * @description Whole percent of the quota in use (0 … 100).
 * @param used Used bytes.
 * @param quota Allowed bytes.
 */
export function usagePercent(used: number, quota: number): number {
  return quota <= 0 ? 100 : Math.min(100, Math.round((used / quota) * 100));
}
