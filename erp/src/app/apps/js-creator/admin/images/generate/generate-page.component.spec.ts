/**
 * @file generate-page.component.spec.ts
 * @path src/app/apps/js-creator/admin/images/generate/generate-page.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of GeneratePageComponent: loading (template, fonts, folders, the last
 *   folder), the text of the post from the pattern, highlights, photos from the computer with
 *   their crop, what stops generating, generating (exact PNG of the template, only the output
 *   sent, the result shown, an optional image left empty), refused outputs, characters the font
 *   does not have, the page without the create permission, a set (united fields with block
 *   fields, tabs of formats with their own crops, one output each), a carousel slide by slide,
 *   presets (apply, save without photos, overwrite after a confirmation, delete) and the rows of
 *   bulk generating (checks, names, captions, photos of a row, waiting on 429).
 * @dependencies admin-test-helpers.ts (admin doubles), editor-test-data.ts, the canvas and
 *   createImageBitmap of the test browser.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { GeneratePageComponent } from './generate-page.component';
import { FontLibraryService } from '../../shared/font-library.service';
import { IconSetService } from '../../shared/icon-set.service';
import { CreatorBlockDetail, CreatorFolder, CreatorOutput, CreatorPreset, CreatorSet, CreatorTemplateDetail } from '../../shared/js-creator.models';
import { ImageField, ImageLayer, Layer, TextField, TextLayer, createLayer, emptyDocument } from '../../shared/render/document';
import { fieldImageBoxes } from '../../shared/render/field-images';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';
import { TEST_CURATED, TEST_SIZE, imageField, shapeLayer, testAsset, testFont, testTemplate, textField, textLayer } from '../editor/editor-test-data';

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
  /** Presets the API answers with. */
  let presets: CreatorPreset[] = [];

  /**
   * @description Creates the page for template 7: a title field (text layer), an image field
   *   in a 500 × 500 image layer and a shape; caption pattern "{{title}} #tag".
   * @param granted Permissions of the account.
   * @param photoRequired Whether the image field is required.
   * @param adjust Changes of the served template before the page loads it.
   */
  async function create(granted: string[] | 'all' = 'all', photoRequired = true, adjust?: (template: typeof served) => void): Promise<void> {
    ctx = createAdminTestContext({ granted });
    const photo: ImageLayer = {
      ...(createLayer('image', TEST_SIZE, 'img') as ImageLayer), anchor: 'tl', x: 500, y: 500, w: 500, h: 500, fit: 'cover', source: { kind: 'field', field: 'photo' },
    };
    served = testTemplate({
      layers: [shapeLayer('a'), textLayer('t1', { field: 'title', w: 900, h: 200 }), photo],
      fields: [{ ...(textField('title') as TextField), maxLength: 20 }, { ...(imageField('photo') as ImageField), required: photoRequired }],
      caption: '{{title}} #tag',
    });
    adjust?.(served);
    ctx.dataHandler.get.and.callFake(((url: string) => of(url.includes('/templates/') ? served : { used_bytes: 0, quota_bytes: 1e9, trash_bytes: 0, counts: {} })) as never);
    ctx.dataHandler.getCollection.and.callFake(((url: string) => of(
      url === 'js-creator/folders' ? [folder(2, 'Kampaň'), folder(3, 'Jiné')] : url.startsWith('js-creator/images/presets') ? presets : [testFont(3)],
    )) as never);
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

  /**
   * @description An optional image field left empty does not stop generating - its place stays
   *   empty in the output like in the preview.
   * @input photo not required; title "Léto"; no photo; Generate
   * @output no problem; one upload; no alert
   */
  it('generates with an optional image field left empty', async () => {
    await create('all', false);
    component.setText('title', 'Léto');
    expect(component.problems()).toEqual([]);
    await component.generate();
    expect(ctx.dataHandler.postQuietly).toHaveBeenCalledTimes(1);
    expect(ctx.alert.open).not.toHaveBeenCalled();
  });

  /**
   * @description Characters the font of the template does not have (outside the unicode-range of
   *   its faces) are a problem that stops generating - they would be drawn with another font.
   * @input face of the font of the text layer covering U+0000-017F; title "Akce → 😀"; Generate
   * @output problem characters "→ 😀"; no upload
   */
  it('refuses characters the font does not have', async () => {
    await create('all', false);
    const family = component.resources.fontFamily((served.document.pages[0].layers[1] as TextLayer).font.family);
    const face = new FontFace(family, 'url("/nowhere.woff2")', { unicodeRange: 'U+0000-017F' });
    document.fonts.add(face);
    try {
      component.setText('title', 'Akce → 😀');
      expect(component.problems()).toEqual([{ kind: 'characters', field: null, label: '→ 😀' }]);
      await component.generate();
      expect(ctx.dataHandler.postQuietly).not.toHaveBeenCalled();
    } finally {
      document.fonts.delete(face);
    }
  });
  /**
   * @description A set: one form with the fields of all its templates (the block field of an
   *   instance included, templates in the trash skipped), tabs of the formats, a crop per format,
   *   and Generate makes one output per template named with its format.
   * @input set 4 with template 7 (title, photo 500 × 500), template 8 (500 × 1000: title, photo,
   *   an instance of block 3 with the field badge) and template 9 in the trash; title "Léto",
   *   badge "Nové", a photo; tab 8 with zoom 2; Generate with the name "Akce"
   * @output fields title, photo, badge; 2 tabs; crop zoom 2 only for template 8; two uploads
   *   (7 then 8) named "Akce – 1000×1000" / "Akce – 500×1000" with PNGs of their sizes; 2 results
   */
  it('generates a set', async () => {
    ctx = createAdminTestContext();
    const photo: ImageLayer = {
      ...(createLayer('image', TEST_SIZE, 'img') as ImageLayer), anchor: 'tl', x: 500, y: 500, w: 500, h: 500, source: { kind: 'field', field: 'photo' },
    };
    const first = testTemplate({ id: 7, layers: [textLayer('t1', { field: 'title' }), photo], fields: [textField('title'), imageField('photo')], caption: '{{title}} {{badge}}' });
    const block: CreatorBlockDetail = {
      id: 3, section: 'images', name: 'Badge', width: 200, height: 100, thumb_url: null, version: 1, created_at: null, updated_at: null, deleted_at: null,
      schema_version: 1, document: emptyDocument(true),
    };
    block.document.fields = [{ ...(textField('badge') as TextField), required: false }];
    block.document.pages[0].layers = [textLayer('bt', { field: 'badge' })];
    const instance = {
      id: 'inst', name: '', type: 'block', anchor: 'tl', x: 0, y: 0, w: 200, h: 100, rotation: 0, opacity: 1, hidden: false, locked: false, blockId: 3, scale: 1,
    } as Layer;
    const second: CreatorTemplateDetail = {
      ...testTemplate({ id: 8, layers: [textLayer('t2', { field: 'title' }), { ...photo, w: 250, h: 250, x: 100, y: 600 }, instance], fields: [textField('title'), imageField('photo')] }),
      width: 500, height: 1000, blocks: [block],
    };
    const theSet: CreatorSet = {
      id: 4, section: 'images', name: 'Léto', caption_template: null, created_at: null, updated_at: null, deleted_at: null,
      templates: [7, 8, 9].map(id => ({ id, name: `T${id}`, width: 1000, height: 1000, output_format: 'png' as const, thumb_url: null, trashed: id === 9 })),
    };
    ctx.dataHandler.get.and.callFake(((url: string) => of(url.endsWith('/sets/4') ? theSet : url.endsWith('/templates/7') ? first
      : url.endsWith('/templates/8') ? second : { used_bytes: 0, quota_bytes: 1e9, trash_bytes: 0, counts: {} })) as never);
    ctx.dataHandler.getCollection.and.callFake(((url: string) => of(url === 'js-creator/folders' || url.includes('/presets') ? [] : [testFont(3)])) as never);
    let next = 40;
    ctx.dataHandler.postQuietly.and.callFake((() => of(output({ id: next++ }))) as never);
    const fonts = {
      curatedFamilies: () => of(TEST_CURATED), curatedName: (s: string) => `jsc-${s}`, ownName: (id: number) => `jsc-user-${id}`,
      registerCurated: () => undefined, registerOwn: () => undefined,
    };
    await TestBed.configureTestingModule({
      imports: [GeneratePageComponent],
      providers: [
        ...ctx.providers,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '4' }), data: { kind: 'set' } } } },
        { provide: FontLibraryService, useValue: fonts },
        { provide: IconSetService, useValue: { iconSet: () => of({ source: '', license: '', viewBox: '0 0 24 24', icons: {} }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GeneratePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    spyOn(component.resources, 'ensureFonts').and.resolveTo();
    spyOn(component.resources, 'missingFonts').and.returnValue([]);

    expect(component.fields().map(f => f.key)).toEqual(['title', 'photo', 'badge']);
    expect(component.targets().map(t => t.template.id)).toEqual([7, 8]);
    expect(component.tabs().length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.gen-tab').length).toBe(2);

    component.setText('title', 'Léto');
    component.setText('badge', 'Nové');
    expect(component.caption()).toBe('Léto Nové');
    await component.chooseFile(component.fields()[1] as ImageField, { target: { files: [await pngFile(1200, 1200)], value: '' } } as unknown as Event);
    component.showTarget(1);
    expect(component.template()?.id).toBe(8);
    component.setZoom('photo', '2');
    expect(component.cropsOf()[8]['photo'].zoom).toBe(2);
    expect(component.cropsOf()[7]['photo'].zoom).toBe(1);

    component.setName('Akce');
    await component.generate();
    const calls = ctx.dataHandler.postQuietly.calls.allArgs() as [string, FormData][];
    expect(calls.length).toBe(2);
    expect(calls.map(([, data]) => [data.get('template_id'), data.get('name'), data.get('caption')])).toEqual([
      ['7', 'Akce – 1000×1000', 'Léto Nové'], ['8', 'Akce – 500×1000', 'Léto Nové'],
    ]);
    const bitmap = await createImageBitmap(calls[1][1].get('file') as File);
    expect([bitmap.width, bitmap.height]).toEqual([500, 1000]);
    bitmap.close();
    expect(component.results().map(o => o.id)).toEqual([40, 41]);
    expect(component.progress()).toBeNull();
  });

  /**
   * @description A carousel: the slides are tabs of the preview, every slide is drawn, staged
   *   on its own and the output joins the tokens; an overflow on a slide that is not shown stops
   *   generating too.
   * @input template with a second slide holding the title text (one line of 900 px); slide tab 2;
   *   title "Léto"; Generate; slide 1 shown and a title of 4 words in big letters
   * @output 2 slide tabs, slideIndex 1; POST …/outputs/pages twice (template_id 7, file), then
   *   POST …/outputs with pages[] [tk1, tk2] and no file; problem overflow for the long title
   */
  it('generates a carousel slide by slide', async () => {
    await create('all', false, template => template.document.pages.push({
      background: template.document.pages[0].background, layers: [textLayer('t2', { field: 'title', w: 900, h: 60, overflow: 'block', autoShrink: false, size: 40 })],
    }));
    const tabs = fixture.nativeElement.querySelectorAll('.gen-slides .gen-tab');
    expect(tabs.length).toBe(2);
    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.slideIndex()).toBe(1);

    let staged = 0;
    ctx.dataHandler.postQuietly.and.callFake(((url: string) => of(url.endsWith('/outputs/pages') ? { token: `tk${++staged}`, bytes: 10 } : output({ page_count: 2 }))) as never);
    component.setText('title', 'Léto');
    await component.generate();
    const calls = ctx.dataHandler.postQuietly.calls.allArgs() as [string, FormData][];
    expect(calls.map(c => c[0])).toEqual(['js-creator/images/outputs/pages', 'js-creator/images/outputs/pages', 'js-creator/images/outputs']);
    expect(calls[0][1].get('template_id')).toBe('7');
    expect(calls[0][1].get('file')).toBeTruthy();
    expect(calls[2][1].getAll('pages[]')).toEqual(['tk1', 'tk2']);
    expect(calls[2][1].get('file')).toBeNull();

    component.showSlide(0);
    served.document.pages[1].layers[0] = { ...served.document.pages[1].layers[0], size: 400 } as never;
    component.setText('title', 'Léto '.repeat(4).trim());
    fixture.detectChanges();
    expect(component.problems().some(p => p.kind === 'overflow')).toBeTrue();
  });

  /**
   * @description Presets: the list of the template is loaded; applying fills texts, a library
   *   image with its crop and the typed text of the post; saving sends the values without
   *   photos of the computer; the same name overwrites only after a confirmation; a taken name is
   *   explained in the dialog; deleting asks first.
   * @input preset Léto (title, image 5 with a crop, caption); apply; save "Zima"; local photo;
   *   save "léto" cancelled / confirmed; 422 name; delete
   * @output texts / image / crop / caption of the preset; POST presets {name Zima, template_id 7, values};
   *   images {} with a photo; PUT presets/1 only after yes; dialog error preset_name_taken; DELETE presets/1
   */
  it('saves, applies and deletes presets', async () => {
    const crop = { focusX: 0.2, focusY: 0.8, zoom: 2 };
    const leto: CreatorPreset = {
      id: 1, section: 'images', template_id: 7, set_id: null, name: 'Léto', created_at: null, updated_at: null,
      values: { texts: { title: 'Léto **50 %**' }, images: { photo: 5 }, crops: { '7': { photo: crop } }, caption: 'Vlastní' },
    };
    presets = [leto];
    await create();
    presets = [];
    expect(component.presets().map(p => p.name)).toEqual(['Léto']);
    expect(ctx.dataHandler.getCollection).toHaveBeenCalledWith('js-creator/images/presets?template_id=7');

    ctx.dataHandler.getPaginatedCollection.and.returnValue(of({ data: [testAsset(5)], meta: { total: 1, per_page: 200, current_page: 1, last_page: 1 } }) as never);
    await component.applyPreset('1');
    expect(component.texts()['title']).toBe('Léto **50 %**');
    expect(component.images()['photo']).toEqual({ kind: 'asset', asset: jasmine.objectContaining({ id: 5 }) as never });
    expect(component.crops()['photo']).toEqual(crop);
    expect(component.caption()).toBe('Vlastní');

    component.setText('title', 'Zima');
    component.openSavePreset();
    expect(component.presetDialog()?.name).toBe('Léto');
    component.setPresetName('Zima');
    ctx.dataHandler.postQuietly.and.returnValue(of({ ...leto, id: 2, name: 'Zima' }) as never);
    await component.savePreset();
    const [url, body] = ctx.dataHandler.postQuietly.calls.mostRecent().args as [string, unknown];
    expect(url).toBe('js-creator/images/presets');
    expect(body).toEqual({ name: 'Zima', template_id: 7, values: { texts: { title: 'Zima' }, images: { photo: 5 }, crops: { '7': { photo: crop } }, caption: 'Vlastní' } });
    expect(component.presets().map(p => p.name)).toEqual(['Léto', 'Zima']);
    expect(component.presetDialog()).toBeNull();

    await component.chooseFile(served.document.fields[1] as ImageField, { target: { files: [await pngFile(800, 800)], value: '' } } as unknown as Event);
    component.openSavePreset();
    component.setPresetName('léto');
    ctx.confirm.open.and.resolveTo(false);
    await component.savePreset();
    expect(ctx.dataHandler.putQuietly).not.toHaveBeenCalled();
    ctx.confirm.open.and.resolveTo(true);
    ctx.dataHandler.putQuietly.and.returnValue(of({ ...leto, name: 'léto' }) as never);
    await component.savePreset();
    const [putUrl, putBody] = ctx.dataHandler.putQuietly.calls.mostRecent().args as [string, { name: string; values: { images: object } }];
    expect(putUrl).toBe('js-creator/images/presets/1');
    expect(putBody.name).toBe('léto');
    expect(putBody.values.images).toEqual({});

    component.openSavePreset();
    component.setPresetName('Jaro');
    ctx.dataHandler.postQuietly.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { name: ['taken'] } } })) as never);
    await component.savePreset();
    expect(component.presetDialog()?.error).toBe('js-creator-generate.preset_name_taken');
    component.presetDialog.set(null);

    component.presetId.set(1);
    ctx.dataHandler.delete.and.returnValue(of(undefined) as never);
    await component.deletePreset();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/presets/1');
    expect(component.presets().map(p => p.name)).toEqual(['Zima']);
  });

  /**
   * @description The runner of bulk generating checks a row like the form and generates it: the
   *   text of the post from the pattern (or its column), the default name with the number of the
   *   row, a photo of the row decoded only in the browser, a bad photo refused without stopping,
   *   a 429 waited for and tried again; the dialog opens.
   * @input row 7 (title Léto); row 8 with a photo, name and caption; row 9 with a broken photo; 429 once
   * @output problems required / too_long; caption "Léto #tag", name "… – 007"; name "Vlastní",
   *   caption "Text", file only the output; error photo_unsupported (stop false); ok after the retry
   */
  it('generates rows of a table', async () => {
    await create('all', false);
    const runner = component.bulkRunner;
    expect(runner.targetCount()).toBe(1);
    expect(runner.check({ title: '' }, new Set()).map(p => p.kind)).toEqual(['required']);
    expect(runner.check({ title: 'x'.repeat(30) }, new Set()).map(p => p.kind)).toContain('too_long');

    expect((await runner.run({ index: 7, texts: { title: 'Léto' }, images: {}, name: '', caption: null })).ok).toBeTrue();
    let [, data] = ctx.dataHandler.postQuietly.calls.mostRecent().args as [string, FormData];
    expect(data.get('caption')).toBe('Léto #tag');
    expect(String(data.get('name'))).toMatch(/^Post .* – 007$/);

    const photo = await pngFile(1200, 1200);
    expect((await runner.run({ index: 8, texts: { title: 'A' }, images: { photo: { kind: 'local', file: photo } }, name: 'Vlastní', caption: 'Text' })).ok).toBeTrue();
    [, data] = ctx.dataHandler.postQuietly.calls.mostRecent().args as [string, FormData];
    expect([data.get('name'), data.get('caption'), (data.get('file') as File).name]).toEqual(['Vlastní', 'Text', 'output.png']);

    const bad = await runner.run({ index: 9, texts: { title: 'A' }, images: { photo: { kind: 'local', file: new File(['x'], 'x.png') } }, name: '', caption: null });
    expect(bad).toEqual({ ok: false, error: 'photo_unsupported', stop: false });

    let calls = 0;
    ctx.dataHandler.postQuietly.and.callFake((() => (++calls === 1
      ? throwError(() => new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '1' }) }))
      : of(output()))) as never);
    expect((await runner.run({ index: 10, texts: { title: 'B' }, images: {}, name: '', caption: null })).ok).toBeTrue();
    expect(calls).toBe(2);
    expect(component.waiting()).toBeNull();

    component.openBulk();
    fixture.detectChanges();
    expect(document.querySelector('app-jc-bulk-generate')).not.toBeNull();
    component.bulkOpen.set(false);
    fixture.detectChanges();
  });
});
