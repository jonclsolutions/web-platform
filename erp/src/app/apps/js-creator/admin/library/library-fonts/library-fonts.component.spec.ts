/**
 * @file library-fonts.component.spec.ts
 * @path src/app/apps/js-creator/admin/library/library-fonts/library-fonts.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of LibraryFontsComponent: own fonts and the curated set are listed with
 *   previews, the font popup checks the file, family and face before sending, the face changes,
 *   restore refuses a taken face, a used font is not deleted.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles), HttpTestingController.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { LibraryFontsComponent } from './library-fonts.component';
import { CreatorFont } from '../../shared/js-creator.models';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

/**
 * @description Own font of the API.
 * @param id Id.
 * @param family Family.
 * @param weight Weight.
 */
function font(id: number, family = 'Brand', weight = 400): CreatorFont {
  return { id, family, weight, style: 'normal', format: 'woff2', size_bytes: 3000, url: `/api/f/${id}`, created_at: null, deleted_at: null };
}

describe('LibraryFontsComponent', () => {
  let fixture: ComponentFixture<LibraryFontsComponent>;
  let component: LibraryFontsComponent;
  let ctx: AdminTestContext;

  beforeEach(async () => {
    spyOn(document.fonts, 'add').and.stub();
    ctx = createAdminTestContext();
    ctx.dataHandler.getCollection.and.callFake(((_url: string, params?: { only_trashed?: number }) =>
      of(params?.only_trashed ? [font(8, 'Brand', 400)] : [font(1)])) as never);
    await TestBed.configureTestingModule({ imports: [LibraryFontsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(LibraryFontsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('assets/apps/js-creator/admin/assets/fonts/fonts.json').flush({
      families: [{ family: 'Inter', slug: 'inter', category: 'sans-serif', license: 'OFL-1.1', source: 'x', faces: [{ weight: 400, style: 'normal', files: [] }, { weight: 700, style: 'normal', files: [] }] }],
    });
    fixture.detectChanges();
  });

  /**
   * @description Own fonts and the curated set are shown with a sample in their own family.
   * @input own [Brand 400]; curated [Inter 400, 700]
   * @output 2 rows; samples in "jsc-user-1" and "jsc-inter"; weights "400, 700"
   */
  it('lists own and curated fonts', () => {
    const samples = fixture.nativeElement.querySelectorAll('.lf-sample') as NodeListOf<HTMLElement>;
    expect(samples.length).toBe(2);
    expect(samples[0].style.fontFamily).toContain('jsc-user-1');
    expect(samples[1].style.fontFamily).toContain('jsc-inter');
    expect(component.weightsOf(component.curated[0])).toBe('400, 700');
  });

  /**
   * @description The upload popup needs a file of an allowed type and size, a valid family and
   *   a free face; then it sends the file with the face.
   * @input no file; brand.exe; brand-bold.woff2 (family prefilled "brand"), face Brand 400 normal
   *   (taken), then 700
   * @output errors file_required, file_type, face_taken; family "brand"; upload with weight 700
   */
  it('checks an upload before sending', () => {
    component.openUpload();
    component.submit();
    expect(component.dialog!.error).toBe('js-creator-library.error_file_required');

    component.onFileChosen({ target: { files: [new File(['x'], 'brand.exe')] } } as unknown as Event);
    component.submit();
    expect(component.dialog!.error).toContain('js-creator-library.error_file_type');

    component.dialog!.family = '';
    component.onFileChosen({ target: { files: [new File(['wOF2'], 'brand-bold.woff2')] } } as unknown as Event);
    expect(component.dialog!.family).toBe('brand');
    component.submit();
    expect(component.dialog!.error).toBe('js-creator-library.error_face_taken');
    expect(ctx.dataHandler.upload).not.toHaveBeenCalled();

    component.dialog!.weight = 700;
    component.submit();
    const data = ctx.dataHandler.upload.calls.mostRecent().args[1] as FormData;
    expect([data.get('family'), data.get('weight'), data.get('style')]).toEqual(['brand', '700', 'normal']);
  });

  /**
   * @description Changing a face sends the new face; restoring a font whose face exists is
   *   refused with a message.
   * @input openEdit(Brand 400) → italic; trash view, restore(Brand 400 of the trash)
   * @output PUT fonts/1 {Brand, 400, italic}; alert restore_title, no POST restore
   */
  it('changes a face and refuses a taken face on restore', () => {
    component.openEdit(font(1));
    component.dialog!.style = 'italic';
    component.submit();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/library/fonts/1', { family: 'Brand', weight: 400, style: 'italic' });

    component.switchView('trash');
    component.restore(font(8));
    expect(ctx.alert.open.calls.mostRecent().args[0]).toBe('js-creator-library.restore_title');
    expect(ctx.dataHandler.post).not.toHaveBeenCalled();
  });

  /**
   * @description A font used by a template is not deleted: a message names the template.
   * @input font with used_by [Post]; remove
   * @output alert in_use_title with „Post“; no DELETE
   */
  it('refuses to delete a used font', async () => {
    await component.remove({ ...font(1), used_by: [{ id: 3, name: 'Post', section: 'images', trashed: false }] });
    expect(ctx.alert.open.calls.mostRecent().args[0]).toBe('js-creator-library.in_use_title');
    expect(ctx.alert.open.calls.mostRecent().args[1]).toContain('„Post“');
    expect(ctx.dataHandler.delete).not.toHaveBeenCalled();
  });

  /**
   * @description Multiselect of the own fonts: one font is downloaded under its URL, several as a
   *   ZIP; bulk delete; a bulk restore names fonts whose face is taken.
   * @input fonts Brand 400 (listed) and Brand 700; download of one; select all + download; delete;
   *   restore answered with a skipped face_taken font
   * @output link to /api/f/1; POST library/fonts/zip [1, 2] → link to /zip; POST library/fonts/bulk
   *   {delete, [1, 2]}; alert with error_face_taken „Brand“
   */
  it('selects, downloads and deletes fonts in bulk', async () => {
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    (fixture.nativeElement.querySelector('.lf-check input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ws-selection')).not.toBeNull();
    component.download();
    expect((click.calls.mostRecent().object as HTMLAnchorElement).getAttribute('href')).toBe('/api/f/1');

    component.own = [font(1), font(2, 'Brand', 700)];
    component.toggleAll();
    expect(component.selection.ids()).toEqual([1, 2]);
    ctx.dataHandler.post.and.returnValue(of({ url: '/zip', count: 2, bytes: 6000 }) as never);
    component.download();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/library/fonts/zip', { ids: [1, 2] });
    expect((click.calls.mostRecent().object as HTMLAnchorElement).getAttribute('href')).toBe('/zip');

    ctx.dataHandler.post.and.returnValue(of({ count: 2, skipped: [] }) as never);
    await component.bulk('delete');
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/library/fonts/bulk', { action: 'delete', ids: [1, 2] });
    expect(component.selection.size).toBe(0);

    component.toggle(font(8));
    ctx.dataHandler.post.and.returnValue(of({ count: 0, skipped: [{ id: 8, name: 'Brand', reason: 'face_taken', used_by: [] }] }) as never);
    await component.bulk('restore');
    expect(ctx.alert.open).toHaveBeenCalledWith('js-creator-shared.bulk_skipped_files_title', 'js-creator-library.error_face_taken „Brand“', 'warning');
  });
});
