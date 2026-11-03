/**
 * @file upload-rules.ts
 * @path src/app/shared/utils/upload-rules.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Types and pure helpers of the attachment rules published by the API
 *   (`GET upload-rules`, App\Support\Uploads\AttachmentPolicy). The browser uses them to refuse a
 *   wrong file right when it is chosen and to list the allowed types in that error.
 * @note The checks in the browser are only a convenience - the API validates every upload again.
 */

/** @description Upload profiles of the API (keys of `GET upload-rules`). */
export type UploadProfile = 'raw_request_commission' | 'sales_order' | 'job_application' | 'support_ticket' | 'project_thread';

/** @description Rules of one upload profile. */
export interface UploadRule {
  /** Allowed extensions, lower case, without the dot. */
  extensions: string[];
  max_files: number;
  max_file_size_mb: number;
  /** Null = no limit of the total size. */
  max_total_size_mb: number | null;
}

/**
 * @description Lower-case extension of a file name without the dot ('' when there is none).
 * @param fileName File name, e.g. 'Report.PDF'.
 * @returns {string} e.g. 'pdf'.
 */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 && dot < fileName.length - 1 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/**
 * @description Whether the file name has an allowed extension. An empty list means "no rules
 *   known" (the API could not be reached) - then nothing is refused and the API decides.
 * @param fileName File name.
 * @param extensions Allowed extensions.
 * @returns {boolean}
 */
export function isExtensionAllowed(fileName: string, extensions: readonly string[]): boolean {
  return extensions.length === 0 || extensions.includes(fileExtension(fileName));
}

/**
 * @description Human-readable list of the allowed types for the hints ('PDF, DOCX, PNG').
 * @param extensions Allowed extensions.
 * @returns {string}
 */
export function extensionsLabel(extensions: readonly string[]): string {
  return extensions.map(e => e.toUpperCase()).join(', ');
}

/**
 * @description Whether a failed submit was refused because of an attachment (HTTP 422 with an
 *   error of `attachments`, `attachments.N`, `cv_file` or `attachment`) - the fallback when the
 *   check in the browser was not possible (rules not loaded) or the file content did not match.
 * @param err HttpErrorResponse-like error.
 * @returns {boolean}
 */
export function isAttachmentRejection(err: any): boolean {
  if (err?.status !== 422) return false;
  const keys = Object.keys(err?.error?.errors ?? {});
  return keys.some(k => k === 'attachments' || k.startsWith('attachments.') || k === 'cv_file' || k === 'attachment');
}
