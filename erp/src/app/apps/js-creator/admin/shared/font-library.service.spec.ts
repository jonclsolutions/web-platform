/**
 * @file font-library.service.spec.ts
 * @path src/app/apps/js-creator/admin/shared/font-library.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of FontLibraryService: the curated set is read from the static
 *   fonts.json, faces are added to document.fonts once under the own names of the application.
 * @dependencies HttpTestingController, src/testing/admin-test-helpers.ts.
 */

import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { FontLibraryService } from './font-library.service';
import { CreatorFont, CuratedFontFamily } from './js-creator.models';
import { createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('FontLibraryService', () => {
  let service: FontLibraryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: createAdminTestContext().providers });
    service = TestBed.inject(FontLibraryService);
    http = TestBed.inject(HttpTestingController);
  });

  /**
   * @description The curated set comes from the static file once (shared by every reader); a
   *   missing file gives an empty set.
   * @input two subscriptions; the answer with one family
   * @output one request of assets/apps/js-creator/admin/assets/fonts/fonts.json; both get it
   */
  it('reads the curated set once', () => {
    const family: CuratedFontFamily = { family: 'Inter', slug: 'inter', category: 'sans-serif', license: 'OFL-1.1', source: 'x', faces: [] };
    const results: CuratedFontFamily[][] = [];
    service.curatedFamilies().subscribe(list => results.push(list));
    service.curatedFamilies().subscribe(list => results.push(list));
    http.expectOne('assets/apps/js-creator/admin/assets/fonts/fonts.json').flush({ families: [family] });
    expect(results).toEqual([[family], [family]]);
  });

  /**
   * @description Every subset file of a curated face and an own font are added once, under
   *   `jsc-<slug>` / `jsc-user-<id>`; the CSS value quotes the name.
   * @input a family with one face of two files, registered twice; an own font twice
   * @output document.fonts.add called 3 times with those families; cssFamily '"jsc-inter", sans-serif'
   */
  it('registers faces once under own names', () => {
    const add = spyOn(document.fonts, 'add').and.stub();
    const family: CuratedFontFamily = {
      family: 'Inter', slug: 'inter', category: 'sans-serif', license: 'OFL-1.1', source: 'x',
      faces: [{ weight: 400, style: 'normal', files: [{ file: 'inter/a.woff2', unicodeRange: 'U+0000-00FF' }, { file: 'inter/b.woff2', unicodeRange: 'U+0100-02BA' }] }],
    };
    const own = { id: 7, family: 'Brand', weight: 700, style: 'italic', format: 'woff2', size_bytes: 1, url: '/api/x', created_at: null, deleted_at: null } as CreatorFont;

    service.registerCurated(family);
    service.registerCurated(family);
    service.registerOwn(own);
    service.registerOwn(own);

    expect(add.calls.count()).toBe(3);
    expect(add.calls.allArgs().map(args => (args[0] as FontFace).family)).toEqual(['jsc-inter', 'jsc-inter', 'jsc-user-7']);
    expect(service.cssFamily(service.curatedName('inter'))).toBe('"jsc-inter", sans-serif');
  });
});
