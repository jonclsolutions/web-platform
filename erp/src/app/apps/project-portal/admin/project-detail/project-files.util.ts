/**
 * @file project-files.util.ts
 * @path src/app/apps/project-portal/admin/project-detail/project-files.util.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared helpers of the project page sub-pages that send files (approvals, updates):
 *   checking picked files against the upload rules of the API (profile project_thread) and the
 *   human-readable file size.
 * @dependencies shared/utils/upload-rules
 */

import { UploadRule, extensionsLabel, fileExtension, isExtensionAllowed } from '../../../../shared/utils/upload-rules';

/** @description Result of picking files: the accepted ones and the first problem (already translated). */
export interface PickedFiles {
  files: File[];
  error: string | null;
}

/**
 * @description Adds picked files to the chosen ones: too many, a forbidden type and a too big file
 *   are refused with the first reason.
 * @param current Files chosen so far.
 * @param picked Files of the file input.
 * @param rules Upload rules (null = API defaults: 5 files, 10 MB, any type the API allows).
 * @param t Translation of a key of the section `projects`.
 * @return Accepted files and the first error.
 */
export function pickProjectFiles(current: File[], picked: File[], rules: UploadRule | null, t: (key: string) => string): PickedFiles {
  const maxFiles = rules?.max_files ?? 5;
  const maxMb = rules?.max_file_size_mb ?? 10;
  const files = [...current];
  let error: string | null = null;
  for (const file of picked) {
    if (files.length >= maxFiles) {
      error ??= t('attachment_error_too_many').replace('{max}', String(maxFiles));
      break;
    }
    if (!isExtensionAllowed(file.name, rules?.extensions ?? [])) {
      const ext = fileExtension(file.name);
      const types = rules?.extensions?.length ? ' ' + t('attachment_allowed_types').replace('{types}', extensionsLabel(rules.extensions)) : '';
      error ??= t('attachment_error_type').replace('{name}', file.name).replace('{ext}', ext ? '.' + ext : '?') + types;
      continue;
    }
    if (file.size > maxMb * 1024 * 1024) {
      error ??= t('attachment_error_size').replace('{name}', file.name).replace('{maxMb}', String(maxMb));
      continue;
    }
    files.push(file);
  }
  return { files, error };
}

/**
 * @description File size for people (KB under 1 MB, else MB with one decimal).
 * @param bytes Size in bytes.
 */
export function formatProjectFileSize(bytes: number): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
