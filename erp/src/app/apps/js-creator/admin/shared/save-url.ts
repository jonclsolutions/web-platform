/**
 * @file save-url.ts
 * @path src/app/apps/js-creator/admin/shared/save-url.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Saves a file of a (signed) URL of the API on the disk of the user: a temporary
 *   link with the `download` attribute is clicked - the API answers with
 *   `Content-Disposition: attachment` and the name of the file.
 * @usage `saveUrl(asset.download_url)`.
 * @dependencies none (DOM).
 */

/**
 * @description Starts the download of a URL.
 * @param url Signed URL of the file (or ZIP).
 */
export function saveUrl(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
