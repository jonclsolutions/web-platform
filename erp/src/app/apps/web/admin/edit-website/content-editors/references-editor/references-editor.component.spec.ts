/**
 * @file references-editor.component.spec.ts
 * @path src/app/apps/web/admin/edit-website/content-editors/references-editor/references-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ReferencesEditorComponent: loading the references, missing
 *   translations (required / optional texts, features, stack), adding / reordering / removing
 *   references, features and stack rows, the payload of a save (no image), the image (upload,
 *   browser checks, removal, kept over discard, only for a saved reference) and read-only mode.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler / permission / i18n / alert stubs).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { REFERENCE_IMAGE_MAX_BYTES, ReferencesEditorComponent } from './references-editor.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../../../testing/admin-test-helpers';

describe('ReferencesEditorComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ReferencesEditorComponent>;
  let component: ReferencesEditorComponent;

  const languages = [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }];
  const rows = () => [
    { id: 1, category_i18n: { cz: 'Webový vývoj', en: 'Web development' }, duration: '2025', client: 'First Prague', is_active: true, image: 'references/1-abc.webp',
      name_i18n: { cz: 'E-shop', en: 'E-shop' }, size_i18n: { cz: 'Na míru' }, role_i18n: {},
      description_i18n: { cz: 'Popis', en: 'Description' }, result_i18n: {},
      features: [{ id: 10, text_i18n: { cz: 'Košík', en: 'Cart' } }, { id: 11, text_i18n: { cz: 'Sklad' } }],
      stack: [{ id: 20, label_i18n: { cz: 'Databáze', en: 'Database' }, value_i18n: { cz: 'MariaDB', en: 'MariaDB' } }] },
    { id: 2, category_i18n: {}, duration: '', client: '', is_active: false, image: null,
      name_i18n: { cz: 'Škola' }, size_i18n: {}, role_i18n: {}, description_i18n: { cz: 'Web školy' }, result_i18n: {},
      features: [], stack: [] },
  ];

  /** Creates the editor with the default answers of the API. */
  const create = () => {
    (ctx.dataHandler as any).get.and.callFake((url: string) => of(url === 'languages/web' ? languages : rows()));
    fixture = TestBed.createComponent(ReferencesEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  /** A change event of a file input with the file. */
  const fileEvent = (file: File) => ({ target: { files: [file], value: 'x' } } as unknown as Event);

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [ReferencesEditorComponent], providers: ctx.providers }).compileComponents();
    create();
  });

  afterEach(() => fixture?.destroy());

  /**
   * @description Loads web/references; collapsed cards with name, year · client and status;
   *   every text with every language; the image of a saved reference as a storage URL.
   * @input Two references (second hidden, without image).
   * @output get('web/references'); names / open state; meta '2025 · First Prague'; role
   *   { cz: '', en: '' }; category text per language (empty for the second); image URLs ['/storage/references/1-abc.webp', null].
   */
  it('loads the references', () => {
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('web/references');
    expect(component.entries.map(r => [component.titleOf(r), r.is_active, r.open])).toEqual([['E-shop', true, false], ['Škola', false, false]]);
    expect(component.entries[0].role_i18n).toEqual({ cz: '', en: '' });
    expect(component.entries.map(r => component.imageUrl(r))).toEqual(['/storage/references/1-abc.webp', null]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.ce-entry-meta')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('2025 · First Prague');
    expect(el.querySelectorAll('.ce-status--off').length).toBe(1);
    expect(component.entries.map(r => r.category_i18n)).toEqual([{ cz: 'Webový vývoj', en: 'Web development' }, { cz: '', en: '' }]);
  });

  /**
   * @description Missing translations: required texts (name, description, features, stack) count
   *   in every language; an optional one (scope) only when filled in another language.
   * @input en: second name / description missing, feature Sklad missing, scope filled in cz only.
   * @output cz 0; en 4 (scope, Sklad, Škola name, Škola description); per reference [2, 2].
   */
  it('counts the missing translations', () => {
    expect(component.missingCount('cz')).toBe(0);
    expect(component.missingCount('en')).toBe(4);
    component.switchLang('en');
    expect(component.entries.map(r => component.missingIn(r))).toEqual([2, 2]);
  });

  /**
   * @description Editing the structure and saving: a new reference (hidden, one empty feature),
   *   features / stack rows added, reordered and removed; the payload carries no image and no
   *   client-only fields; the answer becomes the saved state with the open cards kept.
   * @input Open the first; add a reference; add a stack row to the first; move feature Sklad up;
   *   remove feature Košík; save.
   * @output PUT web/references with 3 references in order; first: features [Sklad], stack
   *   [Databáze, empty]; new: is_active false, empty category, features [empty]; no 'image' / 'open'
   *   / 'key'; not dirty; open [true, false, true].
   */
  it('edits the structure and saves all references', () => {
    const first = component.entries[0];
    component.toggle(first);
    component.addReference();
    component.addStack(first);
    component.move(first.features, 1, -1);
    component.remove(first.features, 1);
    expect(component.isDirty).toBeTrue();

    (ctx.dataHandler as any).put.and.returnValue(of([...rows(), { ...rows()[1], id: 3 }]));
    component.save();
    const [url, body] = (ctx.dataHandler as any).put.calls.mostRecent().args;
    expect(url).toBe('web/references');
    expect(body.references.length).toBe(3);
    expect(body.references[0].features).toEqual([{ id: 11, text_i18n: { cz: 'Sklad', en: '' } }]);
    expect(body.references[0].stack.map((l: any) => l.label_i18n.cz)).toEqual(['Databáze', '']);
    expect(body.references[2]).toEqual(jasmine.objectContaining({ id: null, category_i18n: { cz: '', en: '' }, is_active: false, duration: '', client: '' }));
    expect(body.references[2].features).toEqual([{ id: null, text_i18n: { cz: '', en: '' } }]);
    expect(Object.keys(body.references[0])).not.toContain('image');
    expect(Object.keys(body.references[0])).not.toContain('open');
    expect(component.isDirty).toBeFalse();
    expect(component.entries.map(r => r.open)).toEqual([true, false, true]);
  });

  /**
   * @description The image of a saved reference: uploaded at once (FormData `image`), refused in
   *   the browser when of another type or too big, removed at once; it does not make the editor
   *   dirty and survives a discard. A new reference has no upload.
   * @input Upload a PNG to reference 2; a GIF; a too big JPG; remove the image of reference 1;
   *   discard; open a new reference.
   * @output upload('web/references/2/image') once, image URL of the answer; 2 warnings; delete
   *   ('web/references/1/image'), URL null; not dirty; after discard the URLs stay; the new
   *   reference shows the "save first" hint and no file input.
   */
  it('uploads and removes the image of a saved reference', () => {
    const [first, second] = component.entries;
    (ctx.dataHandler as any).upload.and.returnValue(of({ image: 'references/2-new.webp' }));
    component.onImageSelected(second, fileEvent(new File(['x'], 'a.png', { type: 'image/png' })));
    const [url, form] = (ctx.dataHandler as any).upload.calls.mostRecent().args;
    expect(url).toBe('web/references/2/image');
    expect((form as FormData).get('image')).toEqual(jasmine.any(File));
    expect(component.imageUrl(second)).toBe('/storage/references/2-new.webp');

    component.onImageSelected(second, fileEvent(new File(['x'], 'a.gif', { type: 'image/gif' })));
    const big = new File(['x'], 'b.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: REFERENCE_IMAGE_MAX_BYTES + 1 });
    component.onImageSelected(second, fileEvent(big));
    expect((ctx.dataHandler as any).upload).toHaveBeenCalledTimes(1);
    expect(ctx.alert.open).toHaveBeenCalledWith('web-content-editor.refs_image_error_title', 'web-content-editor.refs_image_error_type', 'warning');
    expect(ctx.alert.open).toHaveBeenCalledWith('web-content-editor.refs_image_error_title', 'web-content-editor.refs_image_error_size', 'warning');

    (ctx.dataHandler as any).delete.and.returnValue(of({ image: null }));
    component.removeImage(first);
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('web/references/1/image');
    expect(component.imageUrl(first)).toBeNull();
    expect(component.isDirty).toBeFalse();

    component.entries[1].client = 'Changed';
    component.discard();
    expect(component.entries.map(r => component.imageUrl(r))).toEqual([null, '/storage/references/2-new.webp']);

    component.addReference();
    fixture.detectChanges();
    const added = fixture.nativeElement.querySelectorAll('.ce-entry')[2] as HTMLElement;
    expect(added.querySelector('.ce-image .ce-field-hint')?.textContent?.trim()).toBe('web-content-editor.refs_image_save_first');
    expect(added.querySelector('input[type=file]')).toBeNull();
  });

  /**
   * @description Without web-edit-website-update the editor is read-only: no save / add / image
   *   buttons, readonly inputs, no upload.
   * @input Only the view permission; expand the first reference; try an upload.
   * @output canUpdate false; no primary button, no add button, no file input; inputs readonly;
   *   no upload request.
   */
  it('is read-only without the update permission', () => {
    fixture.destroy();
    ctx.permissions.granted = new Set(['web-edit-website-view']);
    create();
    component.toggle(component.entries[0]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(component.canUpdate).toBeFalse();
    expect(el.querySelector('.ce-btn-primary')).toBeNull();
    expect(el.querySelector('.ce-add-btn')).toBeNull();
    expect(el.querySelector('input[type=file]')).toBeNull();
    expect((el.querySelector('.ce-entry-body input.ce-input') as HTMLInputElement).readOnly).toBeTrue();
    component.onImageSelected(component.entries[0], fileEvent(new File(['x'], 'a.png', { type: 'image/png' })));
    expect((ctx.dataHandler as any).upload).not.toHaveBeenCalled();
  });

  /**
   * @description The category is free text per language (optional): typed in the edited
   *   language, counted as missing only when filled in another one.
   * @input Expand the second reference, type 'Audit' as its cz category.
   * @output a text input (no select) for the category; category_i18n { cz: 'Audit', en: '' };
   *   en misses one more text (5); dirty.
   */
  it('edits the category as text per language', () => {
    const second = component.entries[1];
    component.toggle(second);
    fixture.detectChanges();
    const body = fixture.nativeElement.querySelectorAll('.ce-entry')[1] as HTMLElement;
    expect(body.querySelector('select')).toBeNull();
    second.category_i18n['cz'] = 'Audit';
    component.changed();
    expect(second.category_i18n).toEqual({ cz: 'Audit', en: '' });
    expect(component.missingCount('en')).toBe(5);
    expect(component.isDirty).toBeTrue();
  });

  /**
   * @description A switch of the admin language redraws the editor at once (OnPush).
   * @input translations$ emits.
   * @output markForCheck called.
   */
  it('redraws when the admin language changes', () => {
    const markForCheck = spyOn((component as any).cd, 'markForCheck');
    ctx.i18n.translations$.next({});
    expect(markForCheck).toHaveBeenCalled();
  });
});
