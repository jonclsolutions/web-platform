/**
 * @file upload-rules-stub.ts
 * @path src/testing/upload-rules-stub.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description UploadRulesService stub of the specs - answers synchronously with the same rules
 *   the API publishes (App\Support\Uploads\AttachmentPolicy), so the components check files
 *   exactly like in production and no request to `GET upload-rules` is made.
 * @dependencies
 * - rxjs (of); UploadRulesService, UploadRule types.
 */

import { Provider } from '@angular/core';
import { of } from 'rxjs';
import { UploadRulesService } from '../app/shared/services/upload-rules.service';
import { UploadProfile, UploadRule } from '../app/shared/utils/upload-rules';

const COMMISSION = [
  'pdf', 'doc', 'docx', 'dotx', 'odt', 'pages', 'rtf', 'txt', 'csv',
  'xls', 'xlsx', 'xlsm', 'xltx', 'ods', 'numbers', 'ppt', 'pptx', 'key',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'heic', 'heif', 'psd', 'ai', 'eps',
  'zip', 'rar', '7z', 'tar', 'gz', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
  'mp4', 'mov', 'avi', 'wmv', 'mkv', 'webm', 'dwg', 'dxf', 'stp', 'step', 'stl', 'obj',
];

/** @description Rules of every profile, equal to `GET upload-rules`. */
export const TEST_UPLOAD_RULES: Record<UploadProfile, UploadRule> = {
  raw_request_commission: { extensions: COMMISSION, max_files: 10, max_file_size_mb: 20, max_total_size_mb: 50 },
  sales_order: { extensions: COMMISSION, max_files: 10, max_file_size_mb: 20, max_total_size_mb: 50 },
  job_application: {
    extensions: ['pdf', 'doc', 'docx', 'odt', 'pages', 'rtf', 'txt', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'zip', 'rar', '7z'],
    max_files: 1, max_file_size_mb: 20, max_total_size_mb: null,
  },
  support_ticket: {
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'zip'],
    max_files: 1, max_file_size_mb: 20, max_total_size_mb: null,
  },
  project_thread: {
    extensions: ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'zip', 'rar', '7z'],
    max_files: 5, max_file_size_mb: 15, max_total_size_mb: null,
  },
};

/**
 * @description Provider of the stub.
 * @param rules Rules to answer with (default TEST_UPLOAD_RULES; pass {} to simulate an unreachable API).
 */
export function provideUploadRulesStub(rules: Partial<Record<UploadProfile, UploadRule>> = TEST_UPLOAD_RULES): Provider {
  return { provide: UploadRulesService, useValue: { rules: (profile: UploadProfile) => of(rules[profile] ?? null) } };
}
