/**
 * @file knowledge-base-editor.component.spec.ts
 * @path src/app/apps/web/admin/edit-website/content-editors/knowledge-base-editor/knowledge-base-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of KnowledgeBaseEditorComponent: loading the introduction and the
 *   blocks (the introduction always first), missing translations, adding / reordering / removing
 *   blocks and sub-blocks (the introduction stays first and cannot be moved / removed), the
 *   payload of a save (no image), the image of a block (upload, browser checks, removal, only for
 *   a saved block, never the introduction) and read-only mode.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler / permission / i18n / alert stubs).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { KnowledgeBaseEditorComponent } from './knowledge-base-editor.component';
import { REFERENCE_IMAGE_MAX_BYTES } from '../references-editor/references-editor.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../../../testing/admin-test-helpers';

describe('KnowledgeBaseEditorComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<KnowledgeBaseEditorComponent>;
  let component: KnowledgeBaseEditorComponent;

  const languages = [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }];
  const rows = () => [
    { id: 5, is_intro: false, is_active: false, image: null, heading_i18n: { cz: 'E-maily' }, text_i18n: { cz: 'Schránky' }, items: [] },
    { id: 1, is_intro: true, is_active: true, image: null, heading_i18n: { cz: 'Vše o systému', en: 'All about it' }, text_i18n: { cz: 'Úvod', en: 'Intro' }, items: [] },
    { id: 2, is_intro: false, is_active: true, image: 'knowledge-base/2-abc.webp', heading_i18n: { cz: 'Zabezpečení', en: 'Security' }, text_i18n: { cz: 'Text', en: 'Text' },
      items: [{ id: 20, title_i18n: { cz: 'Hesla', en: 'Passwords' }, text_i18n: { cz: 'Hash', en: 'Hash' } }, { id: 21, title_i18n: { cz: 'HTTPS' }, text_i18n: { cz: 'TLS' } }] },
  ];

  /** Creates the editor with the default answers of the API. */
  const create = () => {
    (ctx.dataHandler as any).get.and.callFake((url: string) => of(url === 'languages/web' ? languages : rows()));
    fixture = TestBed.createComponent(KnowledgeBaseEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  /** A change event of a file input with the file. */
  const fileEvent = (file: File) => ({ target: { files: [file], value: 'x' } } as unknown as Event);

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [KnowledgeBaseEditorComponent], providers: ctx.providers }).compileComponents();
    create();
  });

  afterEach(() => fixture?.destroy());

  /**
   * @description Loads web/knowledge-base; the introduction is moved first and rendered as its
   *   own fields; the blocks as collapsed cards; the image of a saved block as a storage URL.
   * @input The introduction second in the answer; one hidden block, one with 2 sub-blocks and an image.
   * @output get('web/knowledge-base'); order [1, 5, 2]; 2 intro fields; 2 block cards, 1 hidden;
   *   blockCount 2; image URLs [null, '/storage/knowledge-base/2-abc.webp'].
   */
  it('loads the introduction and the blocks', () => {
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('web/knowledge-base');
    expect(component.entries.map(s => s.id)).toEqual([1, 5, 2]);
    expect(component.intro?.heading_i18n).toEqual({ cz: 'Vše o systému', en: 'All about it' });
    expect(component.blockCount).toBe(2);
    expect(component.entries.slice(1).map(s => component.imageUrl(s))).toEqual([null, '/storage/knowledge-base/2-abc.webp']);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.ce-entry').length).toBe(2);
    expect(el.querySelectorAll('.ce-status--off').length).toBe(1);
    expect(el.querySelectorAll('.ce-card-body > .ce-subentry .ce-input').length).toBe(2);
  });

  /**
   * @description Without an introduction in the answer an empty one is created first.
   * @input Rows without is_intro.
   * @output entries[0] is an empty introduction without id; the blocks follow.
   */
  it('creates an empty introduction when there is none', () => {
    fixture.destroy();
    (ctx.dataHandler as any).get.and.callFake((url: string) => of(url === 'languages/web' ? languages : rows().filter(r => !r.is_intro)));
    fixture = TestBed.createComponent(KnowledgeBaseEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.entries[0]).toEqual(jasmine.objectContaining({ id: null, is_intro: true, heading_i18n: { cz: '', en: '' } }));
    expect(component.entries.slice(1).map(s => s.id)).toEqual([5, 2]);
  });

  /**
   * @description Missing translations: heading, text and every sub-block count in each language.
   * @input en: block 5 heading / text missing, sub-block HTTPS title / text missing.
   * @output cz 0; en 4; per block in en [0 (intro), 2, 2].
   */
  it('counts the missing translations', () => {
    expect(component.missingCount('cz')).toBe(0);
    expect(component.missingCount('en')).toBe(4);
    component.switchLang('en');
    expect(component.entries.map(s => component.missingIn(s))).toEqual([0, 2, 2]);
  });

  /**
   * @description Editing the structure and saving: a new block (hidden), a sub-block added, moved
   *   and removed; blocks never pass the introduction; the introduction cannot be removed; the
   *   payload carries no image / client-only fields; the answer becomes the saved state.
   * @input Move block 5 up (refused) and down; remove the introduction (refused); add a block; add a
   *   sub-block to block 2; move HTTPS up; remove Hesla; save.
   * @output PUT web/knowledge-base { sections } with intro first, then 2, 5, new; block 2 items
   *   [HTTPS, empty]; new block hidden without items; no image / open / key; not dirty.
   */
  it('edits the structure and saves the knowledge base', () => {
    const [intro, emails, security] = component.entries;
    component.moveBlock(1, -1);
    expect(component.entries[0]).toBe(intro);
    component.moveBlock(1, 1);
    component.removeBlock(0);
    component.addBlock();
    component.addItem(security);
    component.addItem(intro);
    component.move(security.items, 1, -1);
    component.remove(security.items, 1);
    expect(component.entries.map(s => s.id)).toEqual([1, 2, 5, null]);
    expect(intro.items).toEqual([]);
    expect(component.isDirty).toBeTrue();

    (ctx.dataHandler as any).put.and.returnValue(of(rows()));
    component.save();
    const [url, body] = (ctx.dataHandler as any).put.calls.mostRecent().args;
    expect(url).toBe('web/knowledge-base');
    expect(body.sections.map((s: any) => [s.id, s.is_intro])).toEqual([[1, true], [2, false], [5, false], [null, false]]);
    expect(body.sections[1].items.map((i: any) => [i.id, i.title_i18n.cz])).toEqual([[21, 'HTTPS'], [null, '']]);
    expect(body.sections[3]).toEqual(jasmine.objectContaining({ is_active: false, items: [], heading_i18n: { cz: '', en: '' } }));
    expect(Object.keys(body.sections[1])).not.toContain('image');
    expect(Object.keys(body.sections[1])).not.toContain('open');
    expect(component.isDirty).toBeFalse();
    expect(emails.id).toBe(5);
  });

  /**
   * @description The image of a saved block: uploaded at once (FormData `image`), refused in the
   *   browser when not JPG / PNG / WebP (e.g. a video) or too big, removed at once; never for the
   *   introduction or a new block; it does not make the editor dirty.
   * @input Upload a WebP to block 5; an MP4; a GIF; a too big PNG; upload to the introduction;
   *   remove the image of block 2; open a new block.
   * @output upload('web/knowledge-base/5/image') once, URL of the answer; 3 warnings; no upload for
   *   the introduction; delete('web/knowledge-base/2/image'), URL null; not dirty; the new block
   *   shows the "save first" hint and no file input.
   */
  it('uploads and removes the image of a saved block', () => {
    const [intro, emails, security] = component.entries;
    (ctx.dataHandler as any).upload.and.returnValue(of({ image: 'knowledge-base/5-new.webp' }));
    component.onImageSelected(emails, fileEvent(new File(['x'], 'a.webp', { type: 'image/webp' })));
    const [url, form] = (ctx.dataHandler as any).upload.calls.mostRecent().args;
    expect(url).toBe('web/knowledge-base/5/image');
    expect((form as FormData).get('image')).toEqual(jasmine.any(File));
    expect(component.imageUrl(emails)).toBe('/storage/knowledge-base/5-new.webp');

    component.onImageSelected(emails, fileEvent(new File(['x'], 'clip.mp4', { type: 'video/mp4' })));
    component.onImageSelected(emails, fileEvent(new File(['x'], 'a.gif', { type: 'image/gif' })));
    const big = new File(['x'], 'b.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: REFERENCE_IMAGE_MAX_BYTES + 1 });
    component.onImageSelected(emails, fileEvent(big));
    component.onImageSelected(intro, fileEvent(new File(['x'], 'a.png', { type: 'image/png' })));
    expect((ctx.dataHandler as any).upload).toHaveBeenCalledTimes(1);
    expect((ctx.alert.open as jasmine.Spy).calls.allArgs().map(args => args[1])).toEqual([
      'web-content-editor.kb_image_error_type', 'web-content-editor.kb_image_error_type', 'web-content-editor.kb_image_error_size',
    ]);

    (ctx.dataHandler as any).delete.and.returnValue(of({ image: null }));
    component.removeImage(security);
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('web/knowledge-base/2/image');
    expect(component.imageUrl(security)).toBeNull();
    expect(component.isDirty).toBeFalse();

    component.addBlock();
    fixture.detectChanges();
    const added = fixture.nativeElement.querySelectorAll('.ce-entry')[2] as HTMLElement;
    expect(added.querySelector('.ce-image .ce-field-hint')?.textContent?.trim()).toBe('web-content-editor.kb_image_save_first');
    expect(added.querySelector('input[type=file]')).toBeNull();
  });

  /**
   * @description Without web-edit-website-update the editor is read-only.
   * @input Only the view permission; expand a block; try an upload.
   * @output no save / add buttons, no file input; the introduction heading readonly; no upload.
   */
  it('is read-only without the update permission', () => {
    fixture.destroy();
    ctx.permissions.granted = new Set(['web-edit-website-view']);
    create();
    component.toggle(component.entries[2]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(component.canUpdate).toBeFalse();
    expect(el.querySelector('.ce-btn-primary')).toBeNull();
    expect(el.querySelector('.ce-add-btn')).toBeNull();
    expect(el.querySelector('input[type=file]')).toBeNull();
    expect((el.querySelector('.ce-card-body > .ce-subentry input.ce-input') as HTMLInputElement).readOnly).toBeTrue();
    component.onImageSelected(component.entries[2], fileEvent(new File(['x'], 'a.png', { type: 'image/png' })));
    expect((ctx.dataHandler as any).upload).not.toHaveBeenCalled();
  });
});
