/**
 * @file js-creator.models.ts
 * @path src/app/apps/js-creator/admin/shared/js-creator.models.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shapes of the API answers of JS Creator (`/api/js-creator/…`) and of its static
 *   font and icon sets. File URLs are signed and relative (same origin as the admin).
 * @dependencies render/document.ts (document of a template).
 */

import { TemplateDocument } from './render/document';

/** Folder of the own workspace (the tree is built from `parent_id`). */
export interface CreatorFolder {
  id: number;
  parent_id: number | null;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Template using a library file (also one in the trash). */
export interface UsedByTemplate {
  id: number;
  name: string;
  section: string;
  trashed: boolean;
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
  /** Templates using the image (only in the list). */
  used_by?: UsedByTemplate[];
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
  /** Templates using the font (only in the list). */
  used_by?: UsedByTemplate[];
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
  counts: { folders: number; images: number; fonts: number; templates: number; outputs: number };
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
  counts: { folders: number; images: number; fonts: number; templates: number; outputs: number };
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

/** Template of a section in a list (without its document). */
export interface CreatorTemplate {
  id: number;
  section: string;
  name: string;
  width: number;
  height: number;
  output_format: 'png' | 'jpg';
  output_quality: number;
  caption_template: string | null;
  /** Signed URL of the thumbnail (null until the editor saves one). */
  thumb_url: string | null;
  version: number;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Template with its document (editor). */
export interface CreatorTemplateDetail extends CreatorTemplate {
  schema_version: number;
  document: TemplateDocument;
}

/** A size used by templates (filter of the list). */
export interface TemplateSizeCount {
  width: number;
  height: number;
  count: number;
}

/** Save of the editor. */
export interface TemplateSave {
  name: string;
  width: number;
  height: number;
  output_format: 'png' | 'jpg';
  output_quality: number;
  caption_template: string | null;
  version: number;
  document: TemplateDocument;
}

/** Generated output (post) of the own workspace. */
export interface CreatorOutput {
  id: number;
  section: string;
  /** Folder (null = top level). */
  folder_id: number | null;
  name: string;
  /** Template it was made from (null after the template was deleted for good). */
  template_id: number | null;
  /** Name of the template at the time of generating. */
  template_name: string;
  /** Text of the post. */
  caption: string | null;
  width: number;
  height: number;
  format: 'png' | 'jpg';
  page_count: number;
  size_bytes: number;
  /** Signed URLs of the first page: picture, thumbnail, download. */
  url: string | null;
  thumb_url: string | null;
  download_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Output sent after generating. */
export interface OutputUpload {
  /** PNG drawn by the renderer in the size of the template. */
  file: Blob;
  template_id: number;
  folder_id: number | null;
  name: string;
  caption: string;
}

/** Signed URL of a ZIP of outputs. */
export interface OutputZip {
  url: string;
  count: number;
  bytes: number;
}
