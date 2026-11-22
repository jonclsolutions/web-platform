/**
 * @file asset-chooser.component.spec.ts
 * @path src/app/apps/js-creator/admin/images/editor/controls/asset-chooser.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AssetChooserComponent: the tabs Images / My icons load their own
 *   lists, an icon is uploaded with the kind icon (PNG / JPG only) and chosen; texts of the tabs
 *   in both languages.
 * @dependencies AssetChooserComponent, admin-test-helpers.ts, editor-test-data.ts, i18n.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AssetChooserComponent } from './asset-chooser.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../../../testing/admin-test-helpers';
import { testAsset } from '../editor-test-data';
import cz from '../../../i18n/cz.json';
import en from '../../../i18n/en.json';

/**
 * @description Change event of a file input with one file.
 * @param file File.
 */
function chosen(file: File): Event {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: [file] });
  return { target: input } as unknown as Event;
}

describe('AssetChooserComponent', () => {
  let fixture: ComponentFixture<AssetChooserComponent>;
  let component: AssetChooserComponent;
  let ctx: AdminTestContext;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    ctx.dataHandler.getPaginatedCollection.and.returnValue(of({ data: [testAsset(1)], meta: { total: 1, per_page: 48, current_page: 1, last_page: 1 } }) as never);
    ctx.dataHandler.upload.and.returnValue(of([{ ...testAsset(7), kind: 'icon' }]) as never);
    await TestBed.configureTestingModule({ imports: [AssetChooserComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(AssetChooserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description The tab My icons lists the own icons; an icon is uploaded with its kind and
   *   chosen; a WebP is refused as an icon.
   * @input tab icons; upload b.webp; upload a.png
   * @output list without kind, then with kind=icon; alert for b.webp; upload with kind icon; chosen icon 7
   */
  it('lists and uploads own icons', () => {
    expect(ctx.dataHandler.getPaginatedCollection.calls.mostRecent().args[0]).not.toContain('kind=');
    const tabs = fixture.nativeElement.querySelectorAll('.jc-chooser-tab');
    expect(tabs.length).toBe(2);
    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.kind).toBe('icon');
    expect(ctx.dataHandler.getPaginatedCollection.calls.mostRecent().args[0]).toContain('kind=icon');
    expect(component.accept).toBe('.png,.jpg,.jpeg');

    component.upload(chosen(new File(['x'], 'b.webp')));
    expect(ctx.alert.open).toHaveBeenCalledWith('js-creator-editor.upload_refused_title', 'js-creator-editor.upload_icon_refused_text b.webp', 'warning');
    const picked = jasmine.createSpy('chosen');
    component.chosen.subscribe(picked);
    component.upload(chosen(new File(['x'], 'a.png')));
    expect((ctx.dataHandler.upload.calls.mostRecent().args[1] as FormData).get('kind')).toBe('icon');
    expect(picked).toHaveBeenCalledWith(jasmine.objectContaining({ id: 7, kind: 'icon' }));
  });

  /**
   * @description Texts of the tabs and of the icon upload exist in both languages.
   * @input keys chooser_images, chooser_icons, upload_icon, icons_empty, upload_icon_refused_text
   * @output non-empty in cz and en
   */
  it('has the texts of the tabs', () => {
    for (const lang of [cz, en] as Record<string, Record<string, string>>[]) {
      for (const key of ['chooser_images', 'chooser_icons', 'upload_icon', 'icons_empty', 'upload_icon_refused_text']) {
        expect(lang['js-creator-editor'][key]).withContext(key).toBeTruthy();
      }
    }
  });
});
