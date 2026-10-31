/**
 * @file index.ts
 * @path src/app/admin/core-pages/web-settings/index.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Types of the Web settings page: languages, company details (SiteSetting) and
 *   social links.
 * @refactor-note (2026-10-31) Optional company details: `hidden_fields` (switched-off fields,
 *   CompanyOptionalField) and nullable optional values.
 */

export interface LangMeta {
  code: string;
  name: string;
  iconUrl?: string | null;
  active: boolean;
  isBuiltIn?: boolean;
}

type I18nMap = Record<string, string>;

export interface SiteSetting {
  id?: number;
  company_name: string;
  brand_tagline: string;
  brand_tagline_i18n: I18nMap;
  copyright_text: string;
  copyright_text_i18n: I18nMap;
  ico: string | null;
  dic: string | null;
  /** GA4 Measurement ID (formát "G-XXXXXXXXXX"). Nepovinné - web bez GA funguje dál beze změny. */
  google_analytics_id?: string | null;
  contact_email: string;
  contact_phone: string | null;
  address: string | null;
  footer_text: string | null;
  logo_path?: string | null;
  /** Keys of the switched-off optional fields (not shown on the public pages). */
  hidden_fields?: CompanyOptionalField[];
}

/** Company detail fields that can be switched off (API SiteSetting::HIDEABLE_FIELDS). */
export type CompanyOptionalField =
  | 'brand_tagline' | 'copyright_text' | 'ico' | 'dic'
  | 'google_analytics_id' | 'contact_phone' | 'address' | 'footer_text';

export interface SocialLink {
  id?: number;
  name: string;
  url: string;
  icon_path: string;
  position: number;
  _iconFile?: File | null;
  _iconPreview?: string | null;
  _saving?: boolean;
  _isNew?: boolean;
  _dirty?: boolean;
}