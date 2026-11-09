/**
 * @file page-titles-editor.component.spec.ts
 * @path src/app/admin/components/page-titles-editor/page-titles-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PageTitlesEditorComponent: loading the rows of one area with the
 *   languages of its module, dirty tracking (output for the host tab), saving only changed rows
 *   to the area's endpoint, discard, the update permission, the preview, page names from the
 *   host page's section, the favicon and the load error.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler / permission / i18n / alert stubs).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { PageTitlesEditorComponent } from './page-titles-editor.component';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('PageTitlesEditorComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<PageTitlesEditorComponent>;
  let component: PageTitlesEditorComponent;

  const rows = () => [
    { id: 1, area: 'web', page_key: 'home', route_path: '/home', title_i18n: { cz: 'Domů' }, sort_order: 1 },
    { id: 2, area: 'web', page_key: 'about-us', route_path: '/about-us', title_i18n: { cz: 'O nás', en: 'About' }, sort_order: 2 },
  ];
  const web = [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }];

  /** Creates the editor with the given inputs and runs ngOnInit. */
  const create = (inputs: Record<string, unknown> = {}, get?: (url: string) => any) => {
    (ctx.dataHandler as any).get.and.callFake(get ?? ((url: string) => {
      if (url === 'languages/web') return of(web);
      if (url === 'languages/shop') return of([]);
      if (url === 'web/page-titles') return of(rows());
      if (url === 'public/legal/config') return of({ settings: { logo_path: 'logo.png' } });
      return of([]);
    }));
    fixture = TestBed.createComponent(PageTitlesEditorComponent);
    component = fixture.componentInstance;
    const all = { area: 'web', endpoint: 'web/page-titles', updatePermission: 'web-edit-website-update', labelSection: 'edit-website', ...inputs };
    Object.entries(all).forEach(([k, v]) => fixture.componentRef.setInput(k, v));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [PageTitlesEditorComponent], providers: ctx.providers }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  /**
   * @description Loads the rows of its endpoint with the active languages of the area's module;
   *   every row gets every language; the favicon comes from the public configuration.
   * @input area web; languages cz, en, de (inactive).
   * @output get('web/page-titles'); languages cz, en; row 1 { cz: 'Domů', en: '' }; not dirty;
   *   favicon '/storage/logo.png' (environment storage URL); rendered 2 inputs.
   */
  it('loads the rows of its area', () => {
    create();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('web/page-titles');
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);
    expect(component.rows[0].title_i18n).toEqual({ cz: 'Domů', en: '' });
    expect(component.isDirty).toBeFalse();
    expect(component.faviconSrc).toContain('logo.png');
    expect(fixture.nativeElement.querySelectorAll('.pt-input').length).toBe(2);
  });

  /**
   * @description Only changed rows are saved to the area's endpoint; the host is told about the
   *   unsaved state; discard restores; a failed save keeps the edits.
   * @input change row 1 cz; onInput; save(); change row 2; discard(); change; save failing.
   * @output dirtyChange true then false; put('web/page-titles', { titles: [row 1] }); success alert;
   *   discard back to 'O nás'; saving false and still dirty after the error.
   */
  it('saves only changed rows and can discard', () => {
    create();
    const dirty: boolean[] = [];
    component.dirtyChange.subscribe(d => dirty.push(d));
    component.rows[0].title_i18n['cz'] = 'Úvod';
    component.onInput(component.rows[0]);
    (ctx.dataHandler as any).put.and.returnValue(of(rows()));
    component.save();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/page-titles', { titles: [{ id: 1, title_i18n: { cz: 'Úvod', en: '' } }] });
    expect(ctx.alert.open).toHaveBeenCalledWith('page-titles.pt_saved_title', 'page-titles.pt_saved_message', 'success');
    expect(dirty).toEqual([true, false]);

    component.rows[1].title_i18n['cz'] = 'Changed';
    component.discard();
    expect(component.rows[1].title_i18n['cz']).toBe('O nás');

    component.rows[1].title_i18n['cz'] = 'X';
    (ctx.dataHandler as any).put.and.returnValue(throwError(() => new Error('x')));
    component.save();
    expect(component.saving).toBeFalse();
    expect(component.isDirty).toBeTrue();
  });

  /**
   * @description Without the update permission the inputs are read-only and nothing is saved;
   *   save() without changes does nothing.
   * @input granted []; dirty row; save(); then granted all, no change, save().
   * @output canUpdate false, readonly inputs, no save buttons, no put; no put without changes.
   */
  it('needs the update permission to save', () => {
    ctx.permissions.granted = new Set();
    create();
    expect(component.canUpdate).toBeFalse();
    expect((fixture.nativeElement.querySelector('.pt-input') as HTMLInputElement).readOnly).toBeTrue();
    expect(fixture.nativeElement.querySelector('.pt-header-actions')).toBeNull();
    component.rows[0].title_i18n['cz'] = 'X';
    component.save();
    component.discard();
    ctx.permissions.granted = 'all';
    component.save();
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
  });

  /**
   * @description Preview, labels and language: the focused row's title in the chosen language,
   *   the first row otherwise; names from the host page's section, else the URL; placeholder.
   * @input strings of 'edit-website' { pt_page_web_home } and 'page-titles' placeholder; focus row 2;
   *   switchLang('en'); empty title.
   * @output 'Domů'; 'About'; label 'Home page' / '/about-us'; placeholder with the language name;
   *   lengthOf 5; empty preview text from strings.
   */
  it('previews titles and names the pages', () => {
    ctx.i18n.getMergedSection.and.callFake((section: string) => section === 'edit-website'
      ? { pt_page_web_home: 'Home page' }
      : { pt_input_placeholder: 'Title ({lang})', pt_preview_empty: '(none)', pt_unsaved_count: '{count} unsaved' });
    create();
    expect(component.previewText).toBe('Domů');
    component.onFocus(component.rows[1]);
    component.switchLang('en');
    expect(component.previewText).toBe('About');
    expect(component.lengthOf(component.rows[1])).toBe(5);
    expect(component.labelFor(component.rows[0])).toBe('Home page');
    expect(component.labelFor(component.rows[1])).toBe('/about-us');
    expect(component.placeholderFor()).toBe('Title (English)');
    component.rows[1].title_i18n['en'] = ' ';
    expect(component.previewText).toBe('(none)');
    component.rows[1].title_i18n['en'] = 'Changed';
    expect(component.unsavedLabel).toBe('1 unsaved');
  });

  /**
   * @description The e-shop uses its own languages (web ones when it has none, Czech when neither
   *   loads); a given logoSrc is used as is (no public config call); a language missing from the
   *   list switches to the first one.
   * @input area shop, endpoint shop/page-titles, logoSrc null: shop languages [en]; then none
   *   (web [cz, en]); then both failing.
   * @output languages ['en'], lang 'en', favicon null, no public config call; ['cz', 'en']; ['cz'].
   */
  it('uses the languages of the e-shop', () => {
    const shopGet = (shop: any, webLangs: any) => (url: string) =>
      url === 'languages/shop' ? shop : url === 'languages/web' ? webLangs : url === 'shop/page-titles' ? of([]) : of({});
    create({ area: 'shop', endpoint: 'shop/page-titles', logoSrc: null }, shopGet(of([{ code: 'en', name: 'English', active: true }]), of(web)));
    expect(component.languages.map(l => l.code)).toEqual(['en']);
    expect(component.lang).toBe('en');
    expect(component.faviconSrc).toBeNull();
    expect((ctx.dataHandler as any).get).not.toHaveBeenCalledWith('public/legal/config');
    fixture.destroy();
    TestBed.inject(ResourceCacheService).invalidate('page-titles:languages:shop');  // cached 10 minutes

    create({ area: 'shop', endpoint: 'shop/page-titles', logoSrc: '/x.png' }, shopGet(of([]), of(web)));
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);
    expect(component.faviconSrc).toBe('/x.png');
  });

  /**
   * @description A failed load shows the error; failing languages / logo fall back quietly.
   * @input endpoint fails; then languages and public config fail.
   * @output loadError true, error text rendered; then Czech only, favicon null, rows loaded.
   */
  it('reports a failed load and falls back quietly', () => {
    create({}, (url: string) => url === 'web/page-titles' ? throwError(() => new Error('x')) : of([]));
    expect(component.loadError).toBeTrue();
    expect(component.loading).toBeFalse();
    expect(fixture.nativeElement.querySelector('.pt-error')).not.toBeNull();
    fixture.destroy();

    TestBed.inject(ResourceCacheService).invalidate('page-titles:languages:web');
    create({}, (url: string) => url === 'web/page-titles' ? of(rows()) : throwError(() => new Error('x')));
    expect(component.languages.map(l => l.code)).toEqual(['cz']);
    expect(component.faviconSrc).toBeNull();
    expect(component.rows.length).toBe(2);
  });
});
