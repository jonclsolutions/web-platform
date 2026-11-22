/**
 * @file local-image.spec.ts
 * @path src/app/apps/js-creator/admin/images/generate/local-image.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of photos from the computer decoded in the browser: natural size and a
 *   reduced preview copy, the output decoded again at the needed scale, refused files.
 * @dependencies local-image.ts, createImageBitmap of the test browser.
 */

import { LocalImageError, MAX_LOCAL_BYTES, PREVIEW_EDGE, openLocalImage, outputBitmap } from './local-image';

/**
 * @description PNG file of one colour drawn by a canvas.
 * @param width Width.
 * @param height Height.
 * @param name File name.
 */
async function pngFile(width: number, height: number, name = 'photo.png'): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#336699';
  ctx.fillRect(0, 0, width, height);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b as Blob), 'image/png'));
  return new File([blob], name, { type: 'image/png' });
}

describe('local-image', () => {
  /**
   * @description A large photo keeps its natural size, the preview copy is reduced to
   *   PREVIEW_EDGE; the output is decoded again at the needed scale (the full photo from 1 up).
   * @input PNG 3000 × 1500; output scales 0.5 and 2
   * @output 3000 × 1500, preview 2048 × 1024; output 1500 × 750 and 3000 × 1500
   */
  it('opens a photo and decodes it for the output', async () => {
    const photo = await openLocalImage(await pngFile(3000, 1500));
    expect([photo.width, photo.height, photo.name]).toEqual([3000, 1500, 'photo.png']);
    expect([photo.preview.width, photo.preview.height]).toEqual([PREVIEW_EDGE, PREVIEW_EDGE / 2]);
    const half = await outputBitmap(photo, 0.5);
    expect([half.width, half.height]).toEqual([1500, 750]);
    const full = await outputBitmap(photo, 2);
    expect([full.width, full.height]).toEqual([3000, 1500]);
    [half, full, photo.preview].forEach(b => b.close());
  });

  /**
   * @description A small photo is its own preview; a file the browser cannot decode and a file
   *   over the limit are refused with their reason.
   * @input PNG 300 × 200; text file named .jpg; a file reporting MAX_LOCAL_BYTES + 1 bytes
   * @output preview 300 × 200; LocalImageError unsupported; LocalImageError too_large
   */
  it('keeps small photos and refuses bad files', async () => {
    const small = await openLocalImage(await pngFile(300, 200));
    expect([small.preview.width, small.preview.height]).toEqual([300, 200]);
    small.preview.close();

    const reasons: string[] = [];
    for (const file of [
      new File(['not an image'], 'photo.jpg', { type: 'image/jpeg' }),
      Object.defineProperty(new File(['x'], 'big.jpg', { type: 'image/jpeg' }), 'size', { value: MAX_LOCAL_BYTES + 1 }),
    ]) {
      try {
        await openLocalImage(file);
      } catch (error) {
        reasons.push(error instanceof LocalImageError ? error.reason : 'other');
      }
    }
    expect(reasons).toEqual(['unsupported', 'too_large']);
  });
});
