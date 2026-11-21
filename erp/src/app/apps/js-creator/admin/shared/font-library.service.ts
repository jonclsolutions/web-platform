/**
 * @file font-library.service.ts
 * @path src/app/apps/js-creator/admin/shared/font-library.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Fonts of JS Creator in the browser: the curated set (assets/fonts/fonts.json,
 *   self-hosted) and the own fonts of the account (signed URLs of the API). Every face is added
 *   to `document.fonts` once under an own family name - `jsc-<slug>` / `jsc-user-<id>` - so it
 *   never changes a font the admin itself uses and a user-chosen name never reaches CSS. The
 *   browser downloads a face only when a text uses it (and only the subset with its characters).
 * @usage `cssFamily(familyName)` in a [style.font-family] binding after `registerCurated()` /
 *   `registerOwn()`.
 * @dependencies HttpClient (static JSON), FontFace API.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { CreatorFont, CuratedFontFamily } from './js-creator.models';
import { JS_CREATOR_ASSETS } from './js-creator-assets';

@Injectable({ providedIn: 'root' })
export class FontLibraryService {
  private readonly http = inject(HttpClient);

  /** Faces already added to document.fonts (key: family name + weight + style + source). */
  private readonly registered = new Set<string>();

  /** The curated set, loaded once (empty when the file cannot be read). */
  private readonly families$: Observable<CuratedFontFamily[]> = this.http
    .get<{ families: CuratedFontFamily[] }>(`${JS_CREATOR_ASSETS}/fonts/fonts.json`)
    .pipe(map(file => file?.families ?? []), catchError(() => of([])), shareReplay({ bufferSize: 1, refCount: false }));

  /** @description Families of the curated set. */
  curatedFamilies(): Observable<CuratedFontFamily[]> {
    return this.families$;
  }

  /**
   * @description Family name under which a curated family is registered.
   * @param slug Slug of the family (fonts.json).
   */
  curatedName(slug: string): string {
    return `jsc-${slug}`;
  }

  /**
   * @description Family name under which an own font is registered.
   * @param id Id of the font.
   */
  ownName(id: number): string {
    return `jsc-user-${id}`;
  }

  /**
   * @description CSS value of a registered family with a neutral fallback.
   * @param name Registered family name.
   */
  cssFamily(name: string): string {
    return `"${name}", sans-serif`;
  }

  /**
   * @description Adds every face of a curated family (each subset file with its unicode range).
   * @param family Family of fonts.json.
   */
  registerCurated(family: CuratedFontFamily): void {
    for (const face of family.faces) {
      for (const file of face.files) {
        this.add(this.curatedName(family.slug), `${JS_CREATOR_ASSETS}/fonts/${file.file}`,
          { weight: String(face.weight), style: face.style, unicodeRange: file.unicodeRange });
      }
    }
  }

  /**
   * @description Adds an own font face.
   * @param font Font of the API.
   */
  registerOwn(font: CreatorFont): void {
    this.add(this.ownName(font.id), font.url, { weight: String(font.weight), style: font.style });
  }

  /**
   * @description Adds one face to document.fonts (once).
   * @param family Registered family name.
   * @param url Source.
   * @param descriptors Weight, style, unicode range.
   */
  private add(family: string, url: string, descriptors: FontFaceDescriptors): void {
    const key = `${family}|${descriptors.weight}|${descriptors.style}|${descriptors.unicodeRange ?? ''}`;
    if (this.registered.has(key) || typeof FontFace === 'undefined' || !document.fonts) return;
    this.registered.add(key);
    document.fonts.add(new FontFace(family, `url("${url}")`, descriptors));
  }
}
