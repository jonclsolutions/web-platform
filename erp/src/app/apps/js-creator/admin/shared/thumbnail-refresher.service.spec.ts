/**
 * @file thumbnail-refresher.service.spec.ts
 * @path src/app/apps/js-creator/admin/shared/thumbnail-refresher.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ThumbnailRefresherService: the templates are loaded quietly with
 *   their blocks, drawn and their thumbnails uploaded quietly one after another; a failed
 *   template keeps its old thumbnail and the others go on; blocks (imported) the same way on
 *   their own paths.
 * @dependencies ThumbnailRefresherService, admin-test-helpers.ts, editor-test-data.ts.
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ThumbnailRefresherService } from './thumbnail-refresher.service';
import { FontLibraryService } from './font-library.service';
import { IconSetService } from './icon-set.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';
import { TEST_CURATED, shapeLayer, testTemplate } from '../images/editor/editor-test-data';

describe('ThumbnailRefresherService', () => {
  let ctx: AdminTestContext;

  beforeEach(() => {
    ctx = createAdminTestContext();
    const fonts = {
      curatedFamilies: () => of(TEST_CURATED), curatedName: (s: string) => `jsc-${s}`, ownName: (id: number) => `jsc-user-${id}`,
      registerCurated: () => undefined, registerOwn: () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        ...ctx.providers,
        { provide: FontLibraryService, useValue: fonts },
        { provide: IconSetService, useValue: { iconSet: () => of({ source: '', license: '', viewBox: '0 0 24 24', icons: {} }) } },
      ],
    });
  });

  /**
   * @description Two templates: the first cannot be loaded, the second is drawn and uploaded.
   * @input refresh('images', [5, 6]); GET 5 fails; GET 6 answers a template with a shape
   * @output getQuietly of both; one quiet POST …/templates/6/thumbnail with a WebP / PNG; done(6, url); count 1
   */
  it('draws the thumbnails again', async () => {
    ctx.dataHandler.getQuietly.and.callFake(((url: string) => (url.endsWith('/5')
      ? throwError(() => new Error('gone')) : of(testTemplate({ id: 6, layers: [shapeLayer('a')] })))) as never);
    ctx.dataHandler.postQuietly.and.returnValue(of({ thumb_url: '/new' }) as never);
    const done = jasmine.createSpy('done');
    const count = await TestBed.inject(ThumbnailRefresherService).refresh('images', [5, 6, 6], done);
    expect(ctx.dataHandler.getQuietly.calls.allArgs().map(a => a[0])).toEqual(['js-creator/images/templates/5', 'js-creator/images/templates/6']);
    const [url, form] = ctx.dataHandler.postQuietly.calls.mostRecent().args as [string, FormData];
    expect(url).toBe('js-creator/images/templates/6/thumbnail');
    expect((form.get('thumb') as File).size).toBeGreaterThan(0);
    expect(done).toHaveBeenCalledOnceWith(6, '/new');
    expect(count).toBe(1);
  });

  /**
   * @description Blocks are loaded and uploaded on the paths of the blocks.
   * @input refresh('images', [4], done, 'block'); GET answers a block with a shape
   * @output getQuietly js-creator/images/blocks/4; POST …/blocks/4/thumbnail; done(4, url)
   */
  it('draws the thumbnails of blocks', async () => {
    ctx.dataHandler.getQuietly.and.returnValue(of(testTemplate({ id: 4, layers: [shapeLayer('a')] })) as never);
    ctx.dataHandler.postQuietly.and.returnValue(of({ thumb_url: '/block' }) as never);
    const done = jasmine.createSpy('done');
    const count = await TestBed.inject(ThumbnailRefresherService).refresh('images', [4], done, 'block');
    expect(ctx.dataHandler.getQuietly).toHaveBeenCalledWith('js-creator/images/blocks/4');
    expect(ctx.dataHandler.postQuietly.calls.mostRecent().args[0]).toBe('js-creator/images/blocks/4/thumbnail');
    expect(done).toHaveBeenCalledOnceWith(4, '/block');
    expect(count).toBe(1);
  });
});
