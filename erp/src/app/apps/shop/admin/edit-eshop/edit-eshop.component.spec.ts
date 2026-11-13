/**
 * @file edit-eshop.component.spec.ts
 * @path src/app/apps/shop/admin/edit-eshop/edit-eshop.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of EditEshopComponent – the translation editor of the e-shop
 *   (module 'shop'). The page only configures BaseTranslationEditorComponent, so the tests check
 *   the configuration through the real editor: languages and translations of the 'shop'
 *   module, missing keys, saving, the 'shop-edit-eshop-update' permission, language management
 *   and the "Page titles" tab (PageTitlesEditorComponent of the e-shop pages).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, alert spy, i18n stub),
 *   ResourceCacheService (real)
 */

import { ComponentFixture, TestBed, fakeAsync, flush, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { By } from '@angular/platform-browser';
import { PageTitlesEditorComponent } from '../../../../admin/components/page-titles-editor/page-titles-editor.component';
import { EditEshopComponent } from './edit-eshop.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('EditEshopComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<EditEshopComponent>;
  let component: EditEshopComponent;

  const languages = [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }, { code: 'en', name: 'English', active: true }];
  const cz = { cart: { title: 'Košík', empty: 'Prázdný' }, checkout: 'Pokladna' };
  const en = { cart: { title: 'Cart', empty: '' } };

  const setup = async (granted: string[] | 'all' = 'all') => {
    localStorage.removeItem('jsw_languages');
    ctx = createAdminTestContext({ granted });
    (ctx.dataHandler as any).get.and.callFake((url: string) => {
      if (url === 'languages/shop') return of(JSON.parse(JSON.stringify(languages)));
      if (url === 'translations/shop/cz') return of(JSON.parse(JSON.stringify(cz)));
      if (url === 'translations/shop/en') return of(JSON.parse(JSON.stringify(en)));
      return throwError(() => new Error('404'));
    });
    await TestBed.configureTestingModule({ imports: [EditEshopComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(EditEshopComponent);
    component = fixture.componentInstance;
  };

  beforeEach(async () => { await setup(); });
  afterEach(() => { fixture.destroy(); localStorage.removeItem('jsw_languages'); });

  /**
   * @description The page is configured for the 'shop' module and the 'edit-eshop' texts.
   * @input  t('page_title'); ngOnInit()
   * @output 'edit-eshop.page_title'; get('languages/shop'), get('translations/shop/cz'); 3 keys
   */
  it('loads the languages and translations of the shop module', fakeAsync(() => {
    expect(component.t('page_title')).toBe('edit-eshop.page_title');
    component.ngOnInit();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('languages/shop');
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('translations/shop/cz');
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);
    expect(component.totalCount).toBe(3);
    flush();
  }));

  /**
   * @description English is compared with the Czech reference.
   * @input  loadLang('en'): cart.title 'Cart', cart.empty '', checkout missing
   * @output missingCount 2 (cart.empty, checkout); filledCount 1
   */
  it('marks keys missing against the Czech reference', fakeAsync(() => {
    component.ngOnInit();
    component.loadLang('en');
    expect(component.missingCount).toBe(2);
    expect(component.filledCount).toBe(1);
    flush();
  }));

  /**
   * @description Saving posts the current language to save_translations/shop.
   * @input  updateValue('checkout', 'K pokladně'); onSubmit()
   * @output post('save_translations/shop', { lang: 'cz', data: { …, checkout: 'K pokladně' } }); success alert
   */
  it('saves the translations of the shop module', fakeAsync(() => {
    component.ngOnInit();
    component.updateValue('checkout', 'K pokladně');
    component.onSubmit();
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('save_translations/shop',
      { lang: 'cz', data: jasmine.objectContaining({ checkout: 'K pokladně' }) });
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-eshop.admin_title', 'edit-eshop.translations_saved_message', 'success');
    flush();
  }));

  /**
   * @description Without 'shop-edit-eshop-update' nothing can be saved.
   * @input  granted ['shop-edit-eshop-view']; onSubmit()
   * @output canUpdate false; post not called
   */
  it('requires the shop-edit-eshop-update permission to save', fakeAsync(async () => {
    fixture.destroy();
    TestBed.resetTestingModule();
    await setup(['shop-edit-eshop-view']);
    component.ngOnInit();
    component.onSubmit();
    expect(component.canUpdate).toBeFalse();
    expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
    flush();
  }));

  /**
   * @description Languages of the shop module are added and deleted on languages/shop.
   * @input  add 'de' / 'Deutsch'; then delete English
   * @output upload('languages/shop', FormData with module 'shop'); delete('languages/shop/en')
   */
  it('manages the languages of the shop module', fakeAsync(() => {
    component.ngOnInit();
    component.openAddForm();
    component.newLangCode = 'de';
    component.newLangName = 'Deutsch';
    component.confirmAddLang();
    const [url, fd] = (ctx.dataHandler as any).upload.calls.mostRecent().args;
    expect(url).toBe('languages/shop');
    expect((fd as FormData).get('module')).toBe('shop');
    component.askDeleteLang({ code: 'en', name: 'English', active: true });
    component.confirmDeleteLang();
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('languages/shop/en');
    flush();
  }));

  /**
   * @description The editor renders.
   * @input  detectChanges() after loading
   * @output text contains 'edit-eshop.page_title' and 'English'
   */
  it('renders the editor', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('edit-eshop.page_title');
    expect(fixture.nativeElement.textContent).toContain('English');
    discardPeriodicTasks();
  }));

  /**
   * @description The page also manages the browser titles of its own pages: the "Page titles" tab
   *   creates PageTitlesEditorComponent for the 'shop' area on the first open; the translations
   *   are hidden, not destroyed; the editor stays created when switching back; its unsaved state
   *   puts a dot on the tab.
   * @input render; click the second tab; dirtyChange(true); click the first tab.
   * @output no editor at first; editor area 'shop', endpoint 'shop/page-titles', permission
   *   'shop-edit-eshop-update', labels 'edit-eshop'; .ew-root hidden; dot shown; translations visible, editor hidden.
   */
  it('manages the page titles of its module in a tab', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    const el: HTMLElement = fixture.nativeElement;
    const tabs = () => el.querySelectorAll('.ew-page-tab') as NodeListOf<HTMLButtonElement>;
    expect(tabs().length).toBe(2);
    expect(el.querySelector('app-page-titles-editor')).toBeNull();

    tabs()[1].click();
    fixture.detectChanges();
    const debug = fixture.debugElement.query(By.css('app-page-titles-editor'));
    const editor = debug.componentInstance as PageTitlesEditorComponent;
    expect([editor.area, editor.endpoint, editor.updatePermission, editor.labelSection])
      .toEqual(['shop', 'shop/page-titles', 'shop-edit-eshop-update', 'edit-eshop']);
    expect((el.querySelector('.ew-root') as HTMLElement).style.display).toBe('none');
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');

    editor.dirtyChange.emit(true);
    fixture.detectChanges();
    expect(tabs()[1].querySelector('.ew-page-tab-dot')).not.toBeNull();

    tabs()[0].click();
    fixture.detectChanges();
    expect((el.querySelector('.ew-root') as HTMLElement).style.display).toBe('');
    expect((el.querySelector('.ew-titles-wrap') as HTMLElement).style.display).toBe('none');
    expect(fixture.debugElement.query(By.css('app-page-titles-editor')).componentInstance).toBe(editor);
    discardPeriodicTasks();
  }));
});
