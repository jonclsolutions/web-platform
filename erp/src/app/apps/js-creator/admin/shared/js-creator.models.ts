/**
 * @file js-creator.models.ts
 * @path src/app/apps/js-creator/admin/shared/js-creator.models.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shapes of the API answers of JS Creator (`/api/js-creator/…`) and of its static
 *   font and icon sets. File URLs are signed and relative (same origin as the admin).
 */

/** Folder of the own workspace (the tree is built from `parent_id`). */
export interface CreatorFolder {
  id: number;
  parent_id: number | null;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Image of the own library. */
export interface CreatorAsset {
  id: number;
  name: string;
  mime: string;
  width: number;
  height: number;
  size_bytes: number;
  url: string;
  thumb_url: string;
  created_at: string | null;
  deleted_at: string | null;
}

/** Style of a font face. */
export type FontStyle = 'normal' | 'italic';

/** Own font (one face). */
export interface CreatorFont {
  id: number;
  family: string;
  weight: number;
  style: FontStyle;
  format: 'ttf' | 'otf' | 'woff' | 'woff2';
  size_bytes: number;
  url: string;
  created_at: string | null;
  deleted_at: string | null;
}

/** Face of a font sent to the API (upload / change). */
export interface FontFaceFields {
  family: string;
  weight: number;
  style: FontStyle;
}

/** Usage of the own workspace. */
export interface WorkspaceUsage {
  used_bytes: number;
  quota_bytes: number;
  trash_bytes: number;
  counts: { folders: number; images: number; fonts: number };
}

/** Settings of the application. */
export interface CreatorSettings {
  default_quota_mb: number;
}

/** Row of the overview of accounts (numbers only, never content). */
export interface QuotaAccount {
  id: number;
  name: string;
  has_access: boolean;
  used_bytes: number;
  quota_mb: number | null;
  quota_bytes: number;
  counts: { folders: number; images: number; fonts: number };
}

/** One file of a curated font face with the characters it covers. */
export interface CuratedFontFile {
  file: string;
  unicodeRange: string;
}

/** Family of the curated font set (assets/fonts/fonts.json). */
export interface CuratedFontFamily {
  family: string;
  slug: string;
  category: string;
  license: string;
  source: string;
  faces: { weight: number; style: FontStyle; files: CuratedFontFile[] }[];
}

/** One element of an icon (Lucide node: tag + attributes). */
export type IconNode = [string, Record<string, string>];

/** The icon set (assets/icons/icons.json). */
export interface IconSet {
  source: string;
  license: string;
  viewBox: string;
  icons: Record<string, IconNode[]>;
}
