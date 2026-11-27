/**
 * @file settings-form.ts
 * @path src/app/admin/core-pages/settings/settings-form.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Pure helpers of the company profile form (SettingsComponent): the three tabs and
 *   the fields each of them owns, the unsaved-changes check of one tab, the request body that
 *   saves one tab (the stored values of the other tabs, so their unsaved edits stay only in the
 *   form) and the merge of freshly loaded data into the form (a tab with unsaved edits keeps them).
 * @dependencies SiteSetting / SocialLink / CompanyOptionalField (./index)
 * @note The API saves the company details as a whole (PUT legal/config/settings validates every
 *   field), so the body of one tab is "stored values + the fields of this tab".
 */

import { CompanyOptionalField, SiteSetting, SocialLink } from './';

/** Tab of the company profile (`?tab=brand`, `?tab=social`; the company details without it). */
export type SettingsTab = 'company' | 'brand' | 'social';

/** Every tab in the order of the tab row. */
export const SETTINGS_TABS: readonly SettingsTab[] = ['company', 'brand', 'social'];

/** Value fields of SiteSetting a tab edits (the logo of the brand tab is a file - checked apart). */
export const TAB_FIELDS: Readonly<Record<SettingsTab, readonly (keyof SiteSetting)[]>> = {
  company: ['company_name', 'ico', 'dic', 'contact_email', 'contact_phone', 'address'],
  brand: ['brand_tagline_i18n', 'copyright_text_i18n', 'footer_text'],
  social: ['google_analytics_id'],
};

/** Optional fields (their "show" checkbox) of every tab. */
export const TAB_TOGGLES: Readonly<Record<SettingsTab, readonly CompanyOptionalField[]>> = {
  company: ['ico', 'dic', 'contact_phone', 'address'],
  brand: ['brand_tagline', 'copyright_text', 'footer_text'],
  social: ['google_analytics_id'],
};

/** Translated fields (text per language code). */
const I18N_FIELDS: readonly (keyof SiteSetting)[] = ['brand_tagline_i18n', 'copyright_text_i18n'];

/**
 * @description Text of a field for comparing: null / undefined = empty text.
 * @param value Field value.
 * @returns The value as a string.
 */
function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * @description Whether two texts per language differ (a missing language = an empty text).
 * @param a First map.
 * @param b Second map.
 * @returns True when some language has another text.
 */
function i18nDiffers(a: Record<string, string> | undefined, b: Record<string, string> | undefined): boolean {
  const codes = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...codes].some(code => text(a?.[code]) !== text(b?.[code]));
}

/**
 * @description Whether an optional field is switched on (not in `hidden_fields`).
 * @param settings Company details.
 * @param field Optional field.
 * @returns True = shown on the public pages.
 */
export function fieldOn(settings: SiteSetting, field: CompanyOptionalField): boolean {
  return !(settings.hidden_fields ?? []).includes(field);
}

/**
 * @description Whether the form holds unsaved values of the company details of a tab (fields and
 *   their "show" checkboxes; not the logo file nor the social links - the component adds them).
 * @param draft Values in the form.
 * @param saved Stored values (last load / save).
 * @param tab Tab to check.
 * @returns True when something of the tab differs.
 */
export function settingsTabDirty(draft: SiteSetting, saved: SiteSetting, tab: SettingsTab): boolean {
  const fieldDiffers = TAB_FIELDS[tab].some(field => I18N_FIELDS.includes(field)
    ? i18nDiffers(draft[field] as Record<string, string>, saved[field] as Record<string, string>)
    : text(draft[field]) !== text(saved[field]));
  return fieldDiffers || TAB_TOGGLES[tab].some(field => fieldOn(draft, field) !== fieldOn(saved, field));
}

/**
 * @description Company details to send when a tab is saved: the stored values with the fields and
 *   the checkboxes of the tab taken from the form. The unsaved edits of the other tabs are not sent.
 * @param draft Values in the form.
 * @param saved Stored values.
 * @param tab Tab being saved.
 * @returns Full company details for PUT legal/config/settings (i18n maps copied).
 */
export function settingsForTab(draft: SiteSetting, saved: SiteSetting, tab: SettingsTab): SiteSetting {
  const result: SiteSetting = { ...saved };
  for (const field of TAB_FIELDS[tab]) {
    const value = draft[field];
    (result as any)[field] = I18N_FIELDS.includes(field) ? { ...(value as object ?? {}) } : value;
  }
  const own = TAB_TOGGLES[tab];
  const hiddenElsewhere = (saved.hidden_fields ?? []).filter(field => !own.includes(field));
  const hiddenHere = (draft.hidden_fields ?? []).filter(field => own.includes(field));
  result.hidden_fields = [...hiddenElsewhere, ...hiddenHere];
  return result;
}

/**
 * @description Puts the stored values of one tab into the form (after its save, or a load when the
 *   tab has no unsaved edits). The fields of the other tabs stay as they are in the form.
 * @param draft Values in the form.
 * @param saved Stored values.
 * @param tab Tab to take over.
 * @returns New form values.
 */
export function takeSavedTab(draft: SiteSetting, saved: SiteSetting, tab: SettingsTab): SiteSetting {
  const result: SiteSetting = { ...draft, logo_path: saved.logo_path, id: saved.id };
  for (const field of TAB_FIELDS[tab]) {
    const value = saved[field];
    (result as any)[field] = I18N_FIELDS.includes(field) ? { ...(value as object ?? {}) } : value;
  }
  const own = TAB_TOGGLES[tab];
  const hiddenElsewhere = (draft.hidden_fields ?? []).filter(field => !own.includes(field));
  const hiddenHere = (saved.hidden_fields ?? []).filter(field => own.includes(field));
  result.hidden_fields = [...hiddenElsewhere, ...hiddenHere];
  return result;
}

/**
 * @description Whether a link is a full web address (http / https) - the API takes only those.
 * @param url Typed address.
 * @returns True for a valid http(s) address.
 */
export function isWebUrl(url: string | null | undefined): boolean {
  const value = (url ?? '').trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname;
  } catch {
    return false;
  }
}

/**
 * @description Whether a social link differs from its stored version (or is new / has a new icon).
 * @param link Row of the form.
 * @returns True when the row needs saving.
 */
export function socialLinkDirty(link: SocialLink): boolean {
  if (link._isNew || link._iconFile) return true;
  const saved = link._saved;
  if (!saved) return false;
  return text(link.name) !== text(saved.name) || text(link.url) !== text(saved.url) || link.position !== saved.position;
}

/**
 * @description Merges freshly loaded social links into the rows of the form: rows with unsaved
 *   edits stay as typed (dropped when the link was deleted meanwhile), new rows stay at the end,
 *   the others take the loaded version.
 * @param rows Rows of the form.
 * @param loaded Rows built from the API (stored versions).
 * @returns Rows of the form, sorted by position (new rows last).
 */
export function mergeSocialLinks(rows: readonly SocialLink[], loaded: readonly SocialLink[]): SocialLink[] {
  const dirtyById = new Map(rows.filter(row => !row._isNew && socialLinkDirty(row)).map(row => [row.id, row]));
  const merged = loaded.map(row => dirtyById.get(row.id) ?? row);
  merged.sort((a, b) => a.position - b.position);
  return [...merged, ...rows.filter(row => row._isNew)];
}
