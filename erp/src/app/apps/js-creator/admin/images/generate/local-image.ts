/**
 * @file local-image.ts
 * @path src/app/apps/js-creator/admin/images/generate/local-image.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Photos chosen from the computer when generating. They are decoded ONLY in the
 *   browser and never sent anywhere - only the finished output goes to the API (GDPR: data
 *   minimisation). The orientation of a phone photo (EXIF) is applied by the browser.
 *   - the preview uses a copy of at most PREVIEW_EDGE px (fast drawing, little memory);
 *   - the output decodes the file again at the resolution its places need (never more than the
 *     photo has), so the output has the full quality;
 *   - formats: what the browser can decode (JPG, PNG, WebP everywhere; HEIC only in Safari).
 * @usage `const photo = await openLocalImage(file); … const full = await outputBitmap(photo, scale); full.close()`.
 * @dependencies createImageBitmap.
 */

/** Longest side of the preview copy (px). */
export const PREVIEW_EDGE = 2048;

/** Largest photo accepted (bytes) - protects the memory of the tab. */
export const MAX_LOCAL_BYTES = 40 * 1024 * 1024;

/** Types offered by the file picker (others are tried too - HEIC in Safari). */
export const LOCAL_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';

/** Why a photo cannot be used: over MAX_LOCAL_BYTES, or a format the browser cannot decode. */
export class LocalImageError extends Error {
  /**
   * @param reason Reason.
   */
  constructor(readonly reason: 'too_large' | 'unsupported') {
    super(reason);
  }
}

/** A photo from the computer, decoded in the browser. */
export interface LocalImage {
  /** Name of the file (shown in the form only). */
  name: string;
  file: Blob;
  /** Natural size after the orientation. */
  width: number;
  height: number;
  /** Copy for the preview. */
  preview: ImageBitmap;
}

/**
 * @description Decodes a photo from the computer for the preview.
 * @param file Chosen file.
 * @returns The photo with its preview copy.
 * @throws LocalImageError `too_large` (over MAX_LOCAL_BYTES) or `unsupported` (the browser cannot decode it).
 */
export async function openLocalImage(file: File): Promise<LocalImage> {
  if (file.size > MAX_LOCAL_BYTES) throw new LocalImageError('too_large');
  let full: ImageBitmap;
  try {
    full = await decode(file);
  } catch {
    throw new LocalImageError('unsupported');
  }
  const { width, height } = full;
  const preview = await scaledCopy(full, PREVIEW_EDGE / Math.max(width, height));
  if (preview !== full) full.close();
  return { name: file.name, file, width, height, preview };
}

/**
 * @description Decodes the photo again for an output at the scale its largest place needs
 *   (1 or more = the full photo).
 * @param image Photo.
 * @param scale Needed scale (image px → output px).
 * @returns Bitmap to draw; the caller closes it.
 */
export async function outputBitmap(image: LocalImage, scale: number): Promise<ImageBitmap> {
  const full = await decode(image.file);
  const copy = await scaledCopy(full, scale);
  if (copy !== full) full.close();
  return copy;
}

/**
 * @description Decodes a file with its EXIF orientation (older browsers without the option
 *   decode it as they do by default).
 * @param file File.
 */
async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (error) {
    if (error instanceof TypeError) return createImageBitmap(file);
    throw error;
  }
}

/**
 * @description Smaller copy of a bitmap (the same bitmap when no reduction is needed).
 * @param bitmap Source.
 * @param scale Wanted scale (≥ 1 = keep).
 */
async function scaledCopy(bitmap: ImageBitmap, scale: number): Promise<ImageBitmap> {
  if (!(scale < 0.999)) return bitmap;
  // Rounded up (never smaller than needed), ignoring floating point noise (2048.0000000001).
  const width = Math.max(1, Math.ceil(bitmap.width * scale - 1e-6));
  const height = Math.max(1, Math.ceil(bitmap.height * scale - 1e-6));
  return createImageBitmap(bitmap, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
}
