/**
 * @file template-editor.component.spec.ts
 * @path src/app/apps/js-creator/admin/images/editor/template-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of TemplateEditorComponent: loading the template with its fonts, icons
 *   and library images; adding layers; keyboard shortcuts (not while typing); saving with the
 *   version (thumbnail after a save), a version conflict (offer to load the current state), an
 *   invalid document (reasons); leaving with unsaved changes; read-only mode; narrow screens; the
 *   unsaved-changes guard; blocks (the template carries its blocks, inserting a block, block from
 *   the selection, unpacking) and the same editor for a block (save of the block, refresh of the
 *   thumbnails of its templates).
 * @dependencies TemplateEditorComponent, admin-test-helpers.ts (DataHandler and dialog doubles),
 *   editor-test-data.ts.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TemplateEditorComponent } from './template-editor.component';
import { unsavedTemplateGuard } from './unsaved-template.guard';
import { FontLibraryService } from '../../shared/font-library.service';
import { IconSetService } from '../../shared/icon-set.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';
import { TEST_CURATED, shapeLayer, testAsset, testFont, testTemplate, textField, textLayer } from './editor-test-data';
import { CreatorBlockDetail, CreatorTemplateDetail } from '../../shared/js-creator.models';
import { ThumbnailRefresherService } from '../../shared/thumbnail-refresher.service';
import { emptyDocument } from '../../shared/render/document';

describe('TemplateEditorComponent', () => {
  let fixture: ComponentFixture<TemplateEditorComponent>;
  let component: TemplateEditorComponent;
  let ctx: AdminTestContext;
  let served: CreatorTemplateDetail;

  /**
   * @description Block 3 (200 × 100) with the text field "badge".
   */
  function badgeBlock(): CreatorBlockDetail {
    const document = emptyDocument(true);
    document.fields = [textField('badge')];
    document.pages[0].layers = [textLayer('bt', { field: 'badge' })];
    return {
      id: 3, section: 'images', name: 'Badge', width: 200, height: 100, thumb_url: null, version: 2, created_at: null, updated_at: null, deleted_at: null,
      schema_version: 1, document, used_by: [{ id: 7, kind: 'template', name: 'Post', section: 'images', trashed: false }, { id: 8, kind: 'template', name: 'Old', section: 'images', trashed: true }],
    };
  }

  /**
   * @description Creates the editor (wide screen) with a template using library image 5.
   * @param granted Permissions of the account.
   * @param kind A template / a block (route data).
   * @param template Template to serve instead of the default one.
   */
  async function create(granted: string[] | 'all' = 'all', kind: 'template' | 'block' = 'template', template?: CreatorTemplateDetail): Promise<void> {
    ctx = createAdminTestContext({ granted });
    const image = { ...shapeLayer('img'), type: 'image', source: { kind: 'asset', assetId: 5 }, fit: 'cover', focusX: 0.5, focusY: 0.5, mask: 'none', border: null, overlay: null, flipX: false } as never;
    served = template ?? testTemplate({ layers: [shapeLayer('a'), image] });
    ctx.dataHandler.get.and.callFake(((url: string) => of(url.includes('/templates/') ? served : url.includes('/blocks/') ? badgeBlock() : {})) as never);
    ctx.dataHandler.getCollection.and.returnValue(of([testFont(3)]) as never);
    ctx.dataHandler.getPaginatedCollection.and.returnValue(of({ data: [testAsset(5)], meta: { total: 1, per_page: 200, current_page: 1, last_page: 1 } }) as never);
    const fonts = {
      curatedFamilies: () => of(TEST_CURATED), curatedName: (s: string) => `jsc-${s}`, ownName: (id: number) => `jsc-user-${id}`,
      registerCurated: () => undefined, registerOwn: () => undefined,
    };
    const icons = { iconSet: () => of({ source: '', license: '', viewBox: '0 0 24 24', icons: { star: [['path', { d: 'M1 1h22' }]] } }) };
    await TestBed.configureTestingModule({
      imports: [TemplateEditorComponent],
      providers: [
        ...ctx.providers,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: kind === 'block' ? '3' : '7' }), data: { kind } } } },
        { provide: FontLibraryService, useValue: fonts },
        { provide: IconSetService, useValue: icons },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TemplateEditorComponent);
    component = fixture.componentInstance;
    component.wide.set(true);
    fixture.detectChanges();
  }

  /**
   * @description Sends a key event to the document.
   * @param key Key.
   * @param init Modifiers.
   * @param target Element (default the body).
   */
  function key(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): void {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    fixture.detectChanges();
  }

  /**
   * @description The template, own fonts, icons and the library images it uses are loaded; the
   *   editor shows the layers and the name; the image is requested by its id.
   * @input template 7 with a shape and library image 5
   * @output store with 2 layers; name input "Post"; assets?ids=5 requested; asset 5 known
   */
  it('loads the template and its resources', async () => {
    await create();
    const store = component.store()!;
    expect(store.layers().length).toBe(2);
    expect((fixture.nativeElement.querySelector('.te-name') as HTMLInputElement).value).toBe('Post');
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/library/assets?ids=5');
    expect(component.assets().get(5)?.name).toBe('img5');
    expect(component.ownFonts().map(f => f.id)).toEqual([3]);
  });

  /**
   * @description Shortcuts: Delete, arrows (Shift = 10 px), Ctrl+Z, Ctrl+D, Escape; nothing while
   *   typing in an input; Ctrl+S saves even from an input.
   * @input select a; ArrowRight, Shift+ArrowDown; Ctrl+D; Delete; Ctrl+Z; Escape; Delete typed in an input; Ctrl+S in the input
   * @output a at 1,10; a copy, then deleted, back; selection cleared; no deletion from the input; save called
   */
  it('handles keyboard shortcuts', async () => {
    await create();
    const store = component.store()!;
    store.select(['a']);
    key('ArrowRight');
    key('ArrowDown', { shiftKey: true });
    expect([store.layers()[0].x, store.layers()[0].y]).toEqual([1, 10]);
    key('d', { ctrlKey: true });
    expect(store.layers().length).toBe(3);
    key('Delete');
    expect(store.layers().length).toBe(2);
    key('z', { ctrlKey: true });
    expect(store.layers().length).toBe(3);
    key('Escape');
    expect(store.selection()).toEqual([]);

    const input = fixture.nativeElement.querySelector('.te-name') as HTMLInputElement;
    store.select(['a']);
    key('Delete', {}, input);
    expect(store.layers().length).toBe(3);
    const save = spyOn(component, 'save').and.resolveTo(true);
    key('s', { ctrlKey: true }, input);
    expect(save).toHaveBeenCalled();
  });

  /**
   * @description A save sends the state with its version, takes the answer (new version, no
   *   unsaved changes) and uploads a thumbnail.
   * @input add a text; save → API answers version 4
   * @output putQuietly to …/templates/7 with version 3; version 4, not dirty; thumbnail uploaded
   */
  it('saves and uploads a thumbnail', async () => {
    await create();
    component.add('text');
    const store = component.store()!;
    expect(store.dirty()).toBeTrue();
    ctx.dataHandler.putQuietly.and.callFake(((_url: string, body: { document: CreatorTemplateDetail['document'] }) =>
      of({ ...served, version: 4, document: body.document })) as never);
    ctx.dataHandler.upload.and.returnValue(of({ thumb_url: '/t' }) as never);

    expect(await component.save()).toBeTrue();
    const [url, body] = ctx.dataHandler.putQuietly.calls.mostRecent().args as [string, { version: number }];
    expect(url).toBe('js-creator/images/templates/7');
    expect(body.version).toBe(3);
    expect(store.version()).toBe(4);
    expect(store.dirty()).toBeFalse();
    // The thumbnail is encoded asynchronously (canvas.toBlob) - wait for it, at most 2 s.
    for (let i = 0; i < 40 && !ctx.dataHandler.upload.calls.count(); i++) await new Promise(resolve => setTimeout(resolve, 50));
    expect(ctx.dataHandler.upload).toHaveBeenCalledWith('js-creator/images/templates/7/thumbnail', jasmine.any(FormData));
  });

  /**
   * @description A version conflict offers to load the current state (confirmed → loaded); an
   *   invalid document shows the reasons; a template without a name is not sent.
   * @input 409 version_conflict (confirm yes, server has "Newer"); 422 with errors; empty name
   * @output confirm conflict_title; name "Newer", version 9; alert save_invalid with the path; no request
   */
  it('explains refused saves', async () => {
    await create();
    const store = component.store()!;
    component.add('shape');
    ctx.dataHandler.putQuietly.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error_code: 'version_conflict', current_version: 9 } })) as never);
    served = { ...served, name: 'Newer', version: 9 };
    expect(await component.save()).toBeFalse();
    await new Promise(resolve => setTimeout(resolve));
    expect(ctx.confirm.open.calls.mostRecent().args[0]).toBe('js-creator-editor.conflict_title');
    expect(store.state().name).toBe('Newer');
    expect(store.version()).toBe(9);

    component.add('shape');
    ctx.dataHandler.putQuietly.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { 'document.pages.0.layers.0.size': ['Must be a number.'] } } })) as never);
    await component.save();
    await new Promise(resolve => setTimeout(resolve));
    expect(ctx.alert.open.calls.mostRecent().args[1]).toContain('document.pages.0.layers.0.size');

    ctx.dataHandler.putQuietly.calls.reset();
    store.commit(draft => { draft.name = '  '; });
    expect(await component.save()).toBeFalse();
    expect(ctx.dataHandler.putQuietly).not.toHaveBeenCalled();
  });

  /**
   * @description Leaving with unsaved changes asks (guard); without changes it does not; the
   *   browser question on unload only with changes.
   * @input no changes; a change (confirm answers no)
   * @output true without a question; false after the question; beforeunload prevented
   */
  it('asks before leaving unsaved changes', async () => {
    await create();
    expect(await unsavedTemplateGuard(component, null as never, null as never, null as never)).toBeTrue();
    component.add('icon');
    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    expect(await unsavedTemplateGuard(component, null as never, null as never, null as never)).toBeFalse();
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.onBeforeUnload(event);
    expect(event.defaultPrevented).toBeTrue();
  });

  /**
   * @description Without the update permission the template is read only (no save, no adding);
   *   a narrow screen shows a message instead of the editor.
   * @input only js-creator-images-view; wide = false
   * @output badge read_only, no save button, add ignored; .te-narrow shown
   */
  it('is read only without the permission and needs a wide screen', async () => {
    await create(['view-js-creator', 'js-creator-images-view']);
    expect(fixture.nativeElement.querySelector('.te-badge')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.te-save')).toBeNull();
    component.add('text');
    expect(component.store()!.layers().length).toBe(2);

    component.wide.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.te-narrow')).not.toBeNull();
  });

  /**
   * @description Generate in the top bar opens generating from the template (the guard still
   *   asks about unsaved changes).
   * @input click on Generate
   * @output navigate to image-templates/7/generate
   */
  it('opens generating from the top bar', async () => {
    await create();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    (fixture.nativeElement.querySelector('.te-generate') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/admin/js-creator/image-templates', 7, 'generate']);
  });
  /**
   * @description Blocks in a template: the template carries its blocks (instance boxes follow the
   *   block, their fields join the form), a chosen block is loaded and inserted, the selection
   *   becomes a new block (POST with its document) replaced by an instance, an instance unpacks.
   * @input template with an instance of block 3 stored 400 × 200 at scale 1 and a shape; insert
   *   block 3 again; select the shape → "Kampaň"; unpack the first instance
   * @output instance synced to 200 × 100, form fields [badge]; second instance with badge_2;
   *   POST js-creator/images/blocks {name, 100 × 100, document} → instance in place of the shape;
   *   unpacked text with the field badge
   */
  it('works with blocks in a template', async () => {
    const template = testTemplate({ layers: [
      { id: 'inst', name: '', type: 'block', anchor: 'tl', x: 0, y: 0, w: 400, h: 200, rotation: 0, opacity: 1, hidden: false, locked: false, blockId: 3, scale: 1 } as never,
      shapeLayer('s', 500, 500),
    ] });
    template.blocks = [badgeBlock()];
    await create('all', 'template', template);
    const store = component.store()!;
    expect([store.layers()[0].w, store.layers()[0].h]).toEqual([200, 100]);
    expect(store.dirty()).toBeFalse();
    expect(component.formFields().map(f => f.key)).toEqual(['badge']);

    component.insertBlock(badgeBlock());
    expect(store.layers().length).toBe(3);
    expect(component.formFields().map(f => f.key)).toEqual(['badge', 'badge_2']);
    store.undo();

    const made: CreatorBlockDetail = { ...badgeBlock(), id: 11, name: 'Kampaň', width: 100, height: 100 };
    ctx.dataHandler.postQuietly.and.returnValue(of(made) as never);
    store.select(['s']);
    component.openMakeBlock();
    expect(component.blockName()).toBe('');
    component.setBlockName('Kampaň');
    component.makeBlock();
    const [url, body] = ctx.dataHandler.postQuietly.calls.first().args as [string, { name: string; width: number; height: number; document: { pages: { layers: unknown[] }[] } }];
    expect(url).toBe('js-creator/images/blocks');
    expect([body.name, body.width, body.height, body.document.pages[0].layers.length]).toEqual(['Kampaň', 100, 100, 1]);
    expect(store.layers().map(l => l.type)).toEqual(['block', 'block']);
    expect(component.blockName()).toBeNull();

    component.unpack('inst');
    expect(store.layers().map(l => l.type)).toEqual(['text', 'block']);
    expect(store.doc().fields.map(f => f.key)).toEqual(['badge']);

    store.select([store.layers()[1].id]);
    component.openMakeBlock();
    expect(ctx.alert.open).toHaveBeenCalledWith('js-creator-editor.make_block', 'js-creator-editor.make_block_has_block', 'warning');
  });

  /**
   * @description The same editor edits a block: it loads the block, has no Generate and no block
   *   button, saves through the blocks API and then draws the thumbnails of its templates (not
   *   of those in the trash) again.
   * @input route kind block, block 3; a change; save
   * @output kind block; no .te-generate; PUT js-creator/images/blocks/3 with version 2; refresh('images', [7])
   */
  it('edits a block', async () => {
    await create('all', 'block');
    const refresh = spyOn(TestBed.inject(ThumbnailRefresherService), 'refresh').and.resolveTo(1);
    expect(component.kind).toBe('block');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.te-generate')).toBeNull();
    expect(component.store()!.layers().length).toBe(1);
    ctx.dataHandler.putQuietly.and.returnValue(of({ ...badgeBlock(), version: 3 }) as never);
    ctx.dataHandler.upload.and.returnValue(of({ thumb_url: '/t' }) as never);
    component.store()!.addLayer('shape');
    expect(await component.save()).toBeTrue();
    const [url, body] = ctx.dataHandler.putQuietly.calls.mostRecent().args as [string, { version: number; output_format?: string }];
    expect(url).toBe('js-creator/images/blocks/3');
    expect(body.version).toBe(2);
    expect(body.output_format).toBeUndefined();
    for (let i = 0; i < 50 && !refresh.calls.count(); i++) await new Promise(r => setTimeout(r, 10));
    expect(refresh).toHaveBeenCalledWith('images', [7]);
  });

  /**
   * @description Slides and safe zones in the editor: the bar of slides adds a slide, switches
   *   back and deletes a slide only after a confirmation; a 9:16 template shows the networks, the chosen one is remembered and a layer at the
   *   top is listed; "none" hides it.
   * @input template 1080 × 1920 with a text at 10, 10; click "add slide"; click slide 1; delete
   *   cancelled; delete slide 2 confirmed; network tiktok; none
   * @output 2 slide buttons, slide 1 shown again; still 2 slides, then 1 with the text; networks with tiktok; warning with the text (zone_top);
   *   localStorage jsc-safe-zone = tiktok, then none and no warning
   */
  it('works with slides and safe zones', async () => {
    localStorage.removeItem('jsc-safe-zone');
    const story = testTemplate({ layers: [textLayer('t', { name: 'Hook' })] });
    story.width = 1080;
    story.height = 1920;
    await create('all', 'template', story);
    const bar = () => fixture.nativeElement.querySelector('app-jc-pages-bar') as HTMLElement;
    (bar().querySelector('.pb-actions .pb-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(bar().querySelectorAll('.pb-page').length).toBe(2);
    expect(component.store()!.pageIndex()).toBe(1);
    (bar().querySelectorAll('.pb-page')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.store()!.pageIndex()).toBe(0);
    ctx.confirm.open.and.resolveTo(false);
    (bar().querySelector('.pb-btn--danger') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(component.store()!.pageCount()).toBe(2);
    ctx.confirm.open.and.resolveTo(true);
    component.store()!.setPage(1);
    fixture.detectChanges();
    (bar().querySelector('.pb-btn--danger') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.store()!.pageCount()).toBe(1);
    expect(component.store()!.layers().map(l => l.id)).toEqual(['t']);

    expect(component.networks()).toContain('tiktok');
    component.setSafeNetwork('tiktok');
    fixture.detectChanges();
    expect(localStorage.getItem('jsc-safe-zone')).toBe('tiktok');
    expect(fixture.nativeElement.querySelector('.te-warning--zone').textContent).toContain('„Hook“ – js-creator-shared.zone_top');
    component.setSafeNetwork('');
    fixture.detectChanges();
    expect(localStorage.getItem('jsc-safe-zone')).toBe('none');
    expect(fixture.nativeElement.querySelector('.te-warning--zone')).toBeNull();
    localStorage.removeItem('jsc-safe-zone');
  });
});
