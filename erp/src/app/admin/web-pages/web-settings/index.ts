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
  ico: string;
  dic: string;
  /** GA4 Measurement ID (formát "G-XXXXXXXXXX"). Nepovinné - web bez GA funguje dál beze změny. */
  google_analytics_id?: string | null;
  contact_email: string;
  contact_phone: string;
  address: string;
  footer_text: string;
  logo_path?: string | null;
}

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