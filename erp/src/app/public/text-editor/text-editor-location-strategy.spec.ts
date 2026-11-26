/**
 * @file text-editor-location-strategy.spec.ts
 * @path src/app/public/text-editor/text-editor-location-strategy.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of TextEditorLocationStrategy: outside the editor frame the history is
 *   used as by PathLocationStrategy; in the frame of the visual text editor a new page replaces
 *   the entry and the website never moves in the history (it belongs to the admin).
 * @dependencies PlatformLocation spy, APP_BASE_HREF '/'.
 */

import { TestBed } from '@angular/core/testing';
import { APP_BASE_HREF, PlatformLocation } from '@angular/common';
import { TextEditorLocationStrategy } from './text-editor-location-strategy';

describe('TextEditorLocationStrategy', () => {
  let platform: jasmine.SpyObj<PlatformLocation>;

  /** The strategy, in the editor frame or not. */
  const create = (inEditorFrame: boolean) => {
    platform = jasmine.createSpyObj<PlatformLocation>('PlatformLocation',
      ['pushState', 'replaceState', 'back', 'forward', 'historyGo', 'getBaseHrefFromDOM', 'onPopState', 'onHashChange']);
    TestBed.configureTestingModule({
      providers: [TextEditorLocationStrategy, { provide: PlatformLocation, useValue: platform }, { provide: APP_BASE_HREF, useValue: '/' }],
    });
    const strategy = TestBed.inject(TextEditorLocationStrategy);
    (strategy as unknown as { inEditorFrame: boolean }).inEditorFrame = inEditorFrame;
    return strategy;
  };

  /**
   * @description Outside the editor frame (the admin, the website for visitors) nothing changes.
   * @input pushState('/cs/faq'); back(); forward(); historyGo(-1)
   * @output platform pushState('/cs/faq'), back, forward, historyGo(-1)
   */
  it('uses the history as usual outside the editor frame', () => {
    const strategy = create(false);
    strategy.pushState({ id: 1 }, '', '/cs/faq', '');
    strategy.back();
    strategy.forward();
    strategy.historyGo(-1);
    expect(platform.pushState).toHaveBeenCalledOnceWith({ id: 1 }, '', '/cs/faq');
    expect(platform.replaceState).not.toHaveBeenCalled();
    expect(platform.back).toHaveBeenCalled();
    expect(platform.forward).toHaveBeenCalled();
    expect(platform.historyGo).toHaveBeenCalledOnceWith(-1);
  });

  /**
   * @description In the editor frame a new page replaces the entry (with its query) and the
   *   website never steps in the history.
   * @input pushState('/cs/faq', 'a=1'); back(); forward(); historyGo(-1)
   * @output replaceState('/cs/faq?a=1'); no pushState, back, forward, historyGo
   */
  it('replaces the entry and never steps in the history in the editor frame', () => {
    const strategy = create(true);
    strategy.pushState({ id: 2 }, '', '/cs/faq', 'a=1');
    strategy.back();
    strategy.forward();
    strategy.historyGo(-1);
    expect(platform.replaceState).toHaveBeenCalledOnceWith({ id: 2 }, '', '/cs/faq?a=1');
    expect(platform.pushState).not.toHaveBeenCalled();
    expect(platform.back).not.toHaveBeenCalled();
    expect(platform.forward).not.toHaveBeenCalled();
    expect(platform.historyGo).not.toHaveBeenCalled();
  });
});
