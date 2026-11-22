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

/** Template or block using a library file or a block (also one in the trash). */
export interface UsedByTemplate {
  id: number;
  /** A template or a block (library files only - a block is used by templates). */
  kind?: 'template' | 'block';
  name: string;
  section: string;
  trashed: boolean;
}

/** Image of the own library. */
/** Kind of a file of the library: an image, or an own icon (PNG / JPG, at most 1024 px). */
export type AssetKind = 'image' | 'icon';

export interface CreatorAsset {
  id: number;
  /** Image of the library or own icon (missing in old answers = image). */
  kind?: AssetKind;
  name: string;
  mime: string;
  width: number;
  height: number;
  size_bytes: number;
  url: string;
  thumb_url: string;
  /** Signed URL saving the image as a file under its name. */
  download_url?: string;
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
  /** A block of the template changed after the thumbnail was drawn (the list draws it again). */
  thumb_stale?: boolean;
  version: number;
  /** Starred by the owner (templates only; absent in older answers = no). */
  favorite?: boolean;
  /** Last output generated from it. */
  last_used_at?: string | null;
  /** Default target folder of its outputs. */
  default_folder_id?: number | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Template with its document and the blocks of its instances (editor, generating). */
export interface CreatorTemplateDetail extends CreatorTemplate {
  schema_version: number;
  document: TemplateDocument;
  /** Blocks of the instances with their documents (absent in older answers = none). */
  blocks?: CreatorBlockDetail[];
}

/** Block of a section in a list (without its document). */
export interface CreatorBlock {
  id: number;
  section: string;
  name: string;
  width: number;
  height: number;
  /** Signed URL of the thumbnail (null until the editor saves one). */
  thumb_url: string | null;
  /** The thumbnail has to be drawn again (an imported block - the list draws it). */
  thumb_stale?: boolean;
  version: number;
  /** Templates using the block (such a block cannot be deleted). */
  used_by?: UsedByTemplate[];
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Block with its document (editor of the block, instances of templates). */
export interface CreatorBlockDetail extends CreatorBlock {
  schema_version: number;
  document: TemplateDocument;
}

/** Save of the block editor. */
export interface BlockSave {
  name: string;
  width: number;
  height: number;
  version: number;
  document: TemplateDocument;
}

/** Template of a set. */
export interface SetTemplate {
  id: number;
  name: string;
  width: number;
  height: number;
  output_format: 'png' | 'jpg';
  thumb_url: string | null;
  /** In the trash - skipped when generating. */
  trashed: boolean;
}

/** Set of templates of a section (one filling → one output per template). */
export interface CreatorSet {
  id: number;
  section: string;
  name: string;
  /** Caption pattern of the set (null = the pattern of the first template). */
  caption_template: string | null;
  templates: SetTemplate[];
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** New set / save of a set. */
export interface SetSave {
  name: string;
  caption_template: string | null;
  template_ids: number[];
}

/** Refusal of a set: a field has another kind in another template (422 `field_conflict`). */
export interface SetFieldConflict {
  key: string;
  template_id: number;
  type: 'text' | 'image';
  other_id: number;
  other_type: 'text' | 'image';
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
/** A page of an output (a slide of a carousel). */
export interface OutputPage {
  page: number;
  url: string | null;
  thumb_url: string | null;
  download_url: string | null;
}

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
  /** Every page (slides of a carousel; one item for a single picture). */
  pages?: OutputPage[];
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Output sent after generating. */
export interface OutputUpload {
  /** PNG drawn by the renderer in the size of the template (a single picture). */
  file?: Blob;
  /** Tokens of the staged slides of a carousel, in their order (instead of `file`). */
  pages?: string[];
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

/** Action on several templates, blocks or sets of a list (multiselect). */
export type BulkAction = 'delete' | 'restore' | 'destroy';

/**
 * Answer of a bulk action: done items and the skipped ones - blocks and library files used by
 * templates (`in_use`), fonts whose face is taken again (`face_taken`, restore).
 */
export interface BulkResult {
  count: number;
  skipped: { id: number; name: string; reason?: 'in_use' | 'face_taken'; used_by: UsedByTemplate[] }[];
}

/** Signed URL of a ZIP of library files. */
export interface LibraryZip {
  url: string;
  count: number;
  bytes: number;
}

/** Selection of an export (ids of own items of the section). */
export interface ExportSelection {
  template_ids?: number[];
  block_ids?: number[];
  set_ids?: number[];
}

/**
 * Export / import file of JS Creator (format `js-creator`, version 1) - checked strictly by the
 * API; the browser only saves it and sends it back.
 */
export interface TransferPackage {
  format: 'js-creator';
  version: number;
  section: string;
  exported_at: string;
  templates: unknown[];
  blocks: unknown[];
  sets: unknown[];
  assets: unknown[];
  fonts: unknown[];
}

/** Item imported under another name (its name was taken). */
export interface ImportRenamed {
  type: 'template' | 'block' | 'set' | 'asset' | 'font';
  from: string;
  to: string;
}

/** Answer of an import. */
export interface ImportSummary {
  templates: number;
  blocks: number;
  sets: number;
  assets: number;
  fonts: number;
  fonts_reused: number;
  renamed: ImportRenamed[];
  /** New templates and blocks (their thumbnails are drawn by the browser). */
  template_ids: number[];
  block_ids: number[];
}

/** Values of a preset: texts, library images (ids), crops by template id, text of the post typed by hand. */
export interface PresetValues {
  texts: Record<string, string>;
  images: Record<string, number>;
  crops: Record<string, Record<string, { focusX: number; focusY: number; zoom: number }>>;
  /** Text of the post typed by hand (null = filled from the pattern). */
  caption: string | null;
}

/** Saved filling of the form of generating of a template or a set. */
export interface CreatorPreset {
  id: number;
  section: string;
  template_id: number | null;
  set_id: number | null;
  name: string;
  values: PresetValues;
  created_at: string | null;
  updated_at: string | null;
}

/** New preset / overwrite (the owner only when creating). */
export interface PresetSave {
  name: string;
  template_id?: number;
  set_id?: number;
  values: PresetValues;
}

/** Saved set of hashtags (inserted into the text of the post). */
export interface HashtagSet {
  name: string;
  tags: string;
}

/** Personal settings of the account: brand colours and hashtag sets. */
export interface CreatorPreferences {
  colors: string[];
  hashtag_sets: HashtagSet[];
}

/** Template an output was generated from (filter of the page Outputs). */
export interface OutputTemplateRef {
  id: number;
  name: string;
}
