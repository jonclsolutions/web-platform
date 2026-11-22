/**
 * @file generate-page.component.spec.ts
 * @path src/app/apps/js-creator/admin/images/generate/generate-page.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of GeneratePageComponent: loading (template, fonts, folders, the last
 *   folder), the text of the post from the pattern, highlights, photos from the computer with
 *   their crop, what stops generating, generating (exact PNG of the template, only the output
 *   sent, the result shown), refused outputs and the page without the create permission.
 * @dependencies admin-test-helpers.ts (admin doubles), editor-test-data.ts, the canvas and
 *   createImageBitmap of the test browser.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GeneratePageComponent } from './generate-page.component';
import { FontLibraryService } from '../../shared/font-library.service';
import { IconSetService } from '../../shared/icon-set.service';
import { CreatorFolder, CreatorOutput, CreatorTemplateDetail } from '../../shared/js-creator.models';
import { ImageField, ImageLayer, TextField, createLayer } from '../../shared/render/document';
import { fieldImageBoxes } from '../../shared/render/field-images';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';
import { TEST_CURATED, TEST_SIZE, imageField, shapeLayer, testFont, testTemplate, textField, textLayer } from '../editor/editor-test-data';

/** Key of the last folder in the browser storage. */
const LAST_FOLDER_KEY = 'jsc.generate.folder';

/**
 * @description Folder of the workspace.
 * @param id Id.
 * @param name Name.
 */
function folder(id: number, name: string): CreatorFolder {
  return { id, parent_id: null, name, created_at: null, updated_at: null, deleted_at: null };
}

/**
 * @description Output answered by the API.
 * @param overrides Properties.
 */
function output(overrides: Partial<CreatorOutput> = {}): CreatorOutput {
  return {
    id: 31, section: 'images', folder_id: 2, name: 'Post', template_id: 7, template_name: 'Post', caption: 'Akce #tag', width: 1000, height: 1000,
    format: 'png', page_count: 1, size_bytes: 1234, url: '/o', thumb_url: '/t', download_url: '/d', created_at: null, updated_at: null, deleted_at: null,
    ...overrides,
  };
}

/**
 * @description PNG file of one colour.
 * @param width Width.
 * @param height Height.
 */
async function pngFile(width: number, height: number): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#cc3300';
  ctx.fillRect(0, 0, width, height);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b as Blob), 'image/png'));
  return new File([blob], 'vacation.png', { type: 'image/png' });
}

describe('GeneratePageComponent', () => {
  let fixture: ComponentFixture<GeneratePageComponent>;
  let component: GeneratePageComponent;
  let ctx: AdminTestContext;
  let served: CreatorTemplateDetail;

  /**
   * @description Creates the page for template 7: a title field (text layer), an image field
   *   in a 500 × 500 image layer and a shape; caption pattern "{{title}} #tag".
   * @param granted Permissions of the account.
   */
  async function create(granted: string[] | 'all' = 'all'): Promise<void> {
    ctx = createAdminTestContext({ granted });
    const photo: ImageLayer = {
      ...(createLayer('image', TEST_SIZE, 'img') as ImageLayer), anchor: 'tl', x: 500, y: 500, w: 500, h: 500, fit: 'cover', source: { kind: 'field', field: 'photo' },
    };
    served = testTemplate({
      layers: [shapeLayer('a'), textLayer('t1', { field: 'title', w: 900, h: 200 }), photo],
      fields: [{ ...(textField('title') as TextField), maxLength: 20 }, imageField('photo')],
      caption: '{{title}} #tag',
    });
    ctx.dataHandler.get.and.callFake(((url: string) => of(url.includes('/templates/') ? served : { used_bytes: 0, quota_bytes: 1e9, trash_bytes: 0, counts: {} })) as never);
    ctx.dataHandler.getCollection.and.callFake(((url: string) => of(url === 'js-creator/folders' ? [folder(2, 'Kampaň'), folder(3, 'Jiné')] : [testFont(3)])) as never);
    ctx.dataHandler.postQuietly.and.returnValue(of(output()) as never);
    const fonts = {
      curatedFamilies: () => of(TEST_CURATED), curatedName: (s: string) => `jsc-${s}`, ownName: (id: number) => `jsc-user-${id}`,
      registerCurated: () => undefined, registerOwn: () => undefined,
    };
    const icons = { iconSet: () => of({ source: '', license: '', viewBox: '0 0 24 24', icons: {} }) };
    await TestBed.configureTestingModule({
      imports: [GeneratePageComponent],
      providers: [
        ...ctx.providers,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } },
        { provide: FontLibraryService, useValue: fonts },
        { provide: IconSetService, useValue: icons },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GeneratePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    spyOn(component.resources, 'ensureFonts').and.resolveTo();
    spyOn(component.resources, 'missingFonts').and.returnValue([]);
  }

  afterEach(() => {
    try {
      localStorage.removeItem(LAST_FOLDER_KEY);
    } catch {
      // Storage may be unavailable in the test browser.
    }
  });

  /**
   * @description The page loads the template, own fonts and folders, picks the last used folder
   *   and shows a field per template field; the text of the post follows the fields until it is
   *   edited, Fill from template brings the pattern back.
   * @input last folder 2; title "Léto **50 %**"; caption edited "Vlastní"; refill
   * @output folderId 2; inputs of title and photo; caption "Léto 50 % #tag"; "Vlastní"; pattern again
   */
  it('loads the template and fills the text of the post', async () => {
    localStorage.setItem(LAST_FOLDER_KEY, '2');
    await create();
    expect(component.folderId()).toBe(2);
    expect(component.folderChoices().map(o => o.label)).toEqual(['Jiné', 'Kampaň']);
    expect(fixture.nativeElement.querySelector('#jc-gen-title')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-field="photo"] input[type=file]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-jc-generate-preview canvas')).not.toBeNull();

    component.setText('title', 'Léto **50 %**');
    expect(component.caption()).toBe('Léto 50 % #tag');
    component.setCaption('Vlastní');
    component.setText('title', 'Jiné');
    expect(component.caption()).toBe('Vlastní');
    component.refillCaption();
    expect(component.caption()).toBe('Jiné #tag');
    component.setFolder('3');
    expect(localStorage.getItem(LAST_FOLDER_KEY)).toBe('3');
  });

  /**
   * @description Highlight wraps the selection of the input; without a selection it explains how.
   * @input title "Velká sleva" with "sleva" selected; then no selection
   * @output "Velká **sleva**"; an info dialog
   */
  it('highlights the selected text', async () => {
    await create();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#jc-gen-title') as HTMLInputElement;
    component.setText('title', 'Velká sleva');
    fixture.detectChanges();
    input.value = 'Velká sleva';
    input.setSelectionRange(6, 11);
    component.highlight('title');
    expect(component.texts()['title']).toBe('Velká **sleva**');
    input.setSelectionRange(2, 2);
    component.highlight('title');
    expect(ctx.alert.open).toHaveBeenCalledWith('js-creator-generate.highlight', 'js-creator-generate.highlight_hint', 'info');
  });

  /**
   * @description A photo from the computer becomes the value of its field with the crop of the
   *   template; a small photo is warned about; zoom, drag and reset change the crop; removing
   *   the photo clears it.
   * @input PNG 200 × 100 for "photo" (place 500 × 500); zoom 2; drag 50 px; reset; remove
   * @output value local 200 × 100, crop 0.5/0.5/1, low resolution warning; zoom 2; focus moved;
   *   back to 0.5/1; no value
   */
  it('takes photos from the computer with their crop', async () => {
    await create();
    const field = served.document.fields[1] as ImageField;
    await component.chooseFile(field, { target: { files: [await pngFile(200, 100)], value: 'x' } } as unknown as Event);
    const value = component.images()['photo'];
    expect(value?.kind).toBe('local');
    expect(component.naturalSize(value!)).toEqual({ width: 200, height: 100 });
    expect(component.crops()['photo']).toEqual({ focusX: 0.5, focusY: 0.5, zoom: 1 });
    expect(component.resolutionWarning(field)).toBe('js-creator-generate.resolution_low');

    component.setZoom('photo', '2');
    expect(component.crops()['photo'].zoom).toBe(2);
    const [box] = fieldImageBoxes(served.document, TEST_SIZE, 'photo');
    component.onPan({ key: 'photo', box, dx: 50, dy: 0 });
    expect(component.crops()['photo'].focusX).toBeLessThan(0.5);
    component.resetCrop('photo');
    expect(component.crops()['photo']).toEqual({ focusX: 0.5, focusY: 0.5, zoom: 1 });

    component.clearImage('photo');
    expect(component.images()['photo']).toBeUndefined();
    expect(component.crops()['photo']).toBeUndefined();
  });

  /**
   * @description Generate lists what is missing and sends nothing.
   * @input nothing filled; Generate
   * @output attempted; problems required title + photo shown; no upload
   */
  it('refuses to generate an incomplete form', async () => {
    await create();
    await component.generate();
    fixture.detectChanges();
    expect(component.attempted()).toBeTrue();
    expect(component.problems().map(p => p.field)).toEqual(['title', 'photo']);
    expect(fixture.nativeElement.querySelector('.gen-problems')).not.toBeNull();
    expect(ctx.dataHandler.postQuietly).not.toHaveBeenCalled();
  });

  /**
   * @description Generating waits for the fonts, draws the template in its exact size to a PNG
   *   and sends only that picture with the template, folder, default name and text of the post;
   *   the result is shown and the usage refreshed.
   * @input title "Léto", photo 1200 × 1200 from the computer, folder 2; Generate
   * @output fonts ensured; postQuietly js-creator/images/outputs with output.png (PNG 1000 × 1000),
   *   template_id 7, folder_id 2, name "Post …", caption "Léto #tag"; no other file; result set
   */
  it('generates the output and sends only the picture', async () => {
    await create();
    component.setText('title', 'Léto');
    await component.chooseFile(served.document.fields[1] as ImageField, { target: { files: [await pngFile(1200, 1200)], value: '' } } as unknown as Event);
    component.setFolder('2');
    await component.generate();

    expect(component.resources.ensureFonts).toHaveBeenCalled();
    const [url, data] = ctx.dataHandler.postQuietly.calls.mostRecent().args as [string, FormData];
    expect(url).toBe('js-creator/images/outputs');
    const file = data.get('file') as File;
    expect([file.name, file.type]).toEqual(['output.png', 'image/png']);
    const bitmap = await createImageBitmap(file);
    expect([bitmap.width, bitmap.height]).toEqual([1000, 1000]);
    bitmap.close();
    expect([data.get('template_id'), data.get('folder_id'), data.get('caption')]).toEqual(['7', '2', 'Léto #tag']);
    expect(String(data.get('name')).startsWith('Post ')).toBeTrue();
    expect(Array.from(data.keys()).sort()).toEqual(['caption', 'file', 'folder_id', 'name', 'template_id']);
    expect(component.result()?.id).toBe(31);
    expect(component.generating()).toBeFalse();
  });

  /**
   * @description A font that did not load, a full quota and a folder gone meanwhile stop the
   *   output with their explanation.
   * @input missingFonts ['set:inter']; API 422 quota_exceeded; API 422 folder_id
   * @output alert error_fonts without an upload; alert error_quota; alert error_folder_gone and the top level chosen
   */
  it('explains refused outputs', async () => {
    await create();
    component.setText('title', 'Léto');
    await component.chooseFile(served.document.fields[1] as ImageField, { target: { files: [await pngFile(600, 600)], value: '' } } as unknown as Event);

    (component.resources.missingFonts as jasmine.Spy).and.returnValue(['set:inter']);
    await component.generate();
    expect(ctx.alert.open).toHaveBeenCalledWith('js-creator-generate.error_title', 'js-creator-generate.error_fonts', 'warning');
    expect(ctx.dataHandler.postQuietly).not.toHaveBeenCalled();

    (component.resources.missingFonts as jasmine.Spy).and.returnValue([]);
    ctx.dataHandler.postQuietly.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { error_code: 'quota_exceeded' } })));
    await component.generate();
    expect(ctx.alert.open).toHaveBeenCalledWith('js-creator-generate.error_title', 'js-creator-generate.error_quota', 'warning');

    component.setFolder('3');
    ctx.dataHandler.postQuietly.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { folder_id: ['gone'] } } })));
    await component.generate();
    expect(ctx.alert.open).toHaveBeenCalledWith('js-creator-generate.error_title', 'js-creator-generate.error_folder_gone', 'warning');
    expect(component.folderId()).toBeNull();
  });

  /**
   * @description Without the create permission the page is only a preview; the result opens in
   *   Outputs with its folder.
   * @input view-only account; openInOutputs(output of folder 2)
   * @output Generate disabled and no upload; navigate to outputs?folder=2&output=31
   */
  it('is a preview without the create permission', async () => {
    await create(['view-js-creator', 'js-creator-images-view']);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.gen-generate') as HTMLButtonElement).disabled).toBeTrue();
    await component.generate();
    expect(ctx.dataHandler.postQuietly).not.toHaveBeenCalled();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.openInOutputs(output());
    expect(navigate).toHaveBeenCalledWith(['/admin/js-creator/outputs'], { queryParams: { folder: 2, output: 31 } });
  });
});
