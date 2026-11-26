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
 *   and the "Page titles" tab (PageTitlesEditorComponent of the e-shop pages); the layout of the
 *   texts of the website without the visual editor, the question before leaving with unsaved
 *   edits (route guard) and the readable names of the keys of the e-shop.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, alert spy, i18n stub),
 *   ResourceCacheService (real)
 */

import { ComponentFixture, TestBed, fakeAsync, flush, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { By } from '@angular/platform-browser';
import { PageTitlesEditorComponent } from '../../../../admin/components/page-titles-editor/page-titles-editor.component';
import { EditEshopComponent } from './edit-eshop.component';
import { SHOP_ADMIN_ROUTES } from '../shop-admin.routes';
import { unsavedTextsGuard } from '../../../../admin/components/translation-editor/unsaved-texts.guard';
import shopCz from '../i18n/cz.json';
import shopEn from '../i18n/en.json';
import adminCz from '../../../../../assets/i18n/admin/cz/cz.json';
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
    // get: the languages; getQuietly: the texts (the editor explains a failed load itself)
    const route = (url: string) => {
      if (url === 'languages/shop') return of(JSON.parse(JSON.stringify(languages)));
      if (url === 'translations/shop/cz') return of(JSON.parse(JSON.stringify(cz)));
      if (url === 'translations/shop/en') return of(JSON.parse(JSON.stringify(en)));
      return throwError(() => ({ status: 404 }));
    };
    (ctx.dataHandler as any).get.and.callFake(route);
    (ctx.dataHandler as any).getQuietly.and.callFake(route);
    await TestBed.configureTestingModule({ imports: [EditEshopComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(EditEshopComponent);
    component = fixture.componentInstance;
  };

  beforeEach(async () => { await setup(); });
  afterEach(() => { fixture.destroy(); localStorage.removeItem('jsw_languages'); });

  /**
   * @description The page is configured for the 'shop' module and the 'edit-eshop' texts.
   * @input  t('page_title'); ngOnInit()
   * @output 'edit-eshop.page_title'; get('languages/shop'), getQuietly('translations/shop/cz'); 3 keys
   */
  it('loads the languages and translations of the shop module', fakeAsync(() => {
    expect(component.t('page_title')).toBe('edit-eshop.page_title');
    component.ngOnInit();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('languages/shop');
    expect((ctx.dataHandler as any).getQuietly).toHaveBeenCalledWith('translations/shop/cz');
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
   * @description Saving posts the changed texts of the current language to save_translations/shop.
   * @input  updateValue('checkout', 'K pokladně'); onSubmit()
   * @output postQuietly('save_translations/shop', { lang: 'cz', changes: [{ path: 'checkout', value: 'K pokladně', base: 'Pokladna' }] }); success alert
   */
  it('saves the translations of the shop module', fakeAsync(() => {
    component.ngOnInit();
    component.updateValue('checkout', 'K pokladně');
    component.onSubmit();
    expect((ctx.dataHandler as any).postQuietly).toHaveBeenCalledWith('save_translations/shop',
      { lang: 'cz', changes: [{ path: 'checkout', value: 'K pokladně', base: 'Pokladna' }] });
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
    expect((ctx.dataHandler as any).postQuietly).not.toHaveBeenCalled();
    flush();
  }));

  /**
   * @description Languages of the shop module are added and deleted on languages/shop.
   * @input  add 'de' / 'Deutsch'; then delete English
   * @output postQuietly('languages/shop', FormData with module 'shop'); delete('languages/shop/en')
   */
  it('manages the languages of the shop module', fakeAsync(() => {
    component.ngOnInit();
    component.openAddForm();
    component.newLangCode = 'de';
    component.newLangName = 'Deutsch';
    component.confirmAddLang();
    const [url, fd] = (ctx.dataHandler as any).postQuietly.calls.mostRecent().args;
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
    const tabs = () => el.querySelectorAll('.ew-page-tabs .rbb-btn') as NodeListOf<HTMLButtonElement>;
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
    expect(tabs()[1].querySelector('.rbb-dot')).not.toBeNull();

    tabs()[0].click();
    fixture.detectChanges();
    expect((el.querySelector('.ew-root') as HTMLElement).style.display).toBe('');
    expect((el.querySelector('.ew-titles-wrap') as HTMLElement).style.display).toBe('none');
    expect(fixture.debugElement.query(By.css('app-page-titles-editor')).componentInstance).toBe(editor);
    discardPeriodicTasks();
  }));

  /**
   * @description The layout of the texts of the website (calmer actions: the "Jazyky" button in
   *   the page header, the statistics line) - without the button of the visual text editor.
   * @input render
   * @output compactActions; .ew-langs-btn in the header; no .ew-editor-btn
   */
  it('has the layout of the texts of the website without the visual editor', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const view = fixture.debugElement.query(By.css('app-translation-editor-view')).componentInstance;
    expect(view.compactActions).toBeTrue();
    expect(view.editorRoute).toBeNull();
    expect(el.querySelector('app-page-header .ew-langs-btn')).not.toBeNull();
    expect(el.querySelector('.ew-editor-btn')).toBeNull();
    discardPeriodicTasks();
  }));

  /**
   * @description Leaving with unsaved edits asks first: the route has unsavedTextsGuard; without
   *   edits the page lets go at once, with an edit it asks (a promise of the answer).
   * @input route 'edit-eshop'; confirmLeave() clean; updateValue + confirmLeave()
   * @output canDeactivate [unsavedTextsGuard]; true; a Promise
   */
  it('asks before leaving with unsaved edits', fakeAsync(() => {
    expect(SHOP_ADMIN_ROUTES.find(r => r.path === 'edit-eshop')!.canDeactivate).toEqual([unsavedTextsGuard]);
    fixture.detectChanges();
    flush();
    expect(component.confirmLeave()).toBeTrue();
    component.updateValue('checkout', 'K pokladně');
    fixture.detectChanges();
    expect(component.confirmLeave() instanceof Promise).toBeTrue();
    discardPeriodicTasks();
  }));

  /**
   * @description Readable names of the keys of the e-shop: the same names in Czech and English,
   *   the groups and the common words put together.
   * @input the real 'edit-eshop' / 'translation-editor' texts; keyLabel of checkout.labels.first_name,
   *   product_detail.add_to_cart, cart.title
   * @output the same keys in cz / en; 'Pokladna › Popisky polí › Jméno', 'Detail produktu › Tlačítko
   *   do košíku', 'Košík › Nadpis' (title of the common words)
   */
  it('names the keys of the e-shop for people', () => {
    const cz = (shopCz as any)['edit-eshop'].editor_key_labels;
    expect(Object.keys((shopEn as any)['edit-eshop'].editor_key_labels).sort()).toEqual(Object.keys(cz).sort());
    (ctx.i18n.getMergedSection as jasmine.Spy).and.callFake((section: string) =>
      section === 'edit-eshop' ? (shopCz as any)['edit-eshop'] : (adminCz as any)[section]);
    expect(component.hasKeyLabels).toBeTrue();
    expect(component.keyLabel('checkout.labels.first_name')).toBe('Pokladna › Popisky polí › Jméno');
    expect(component.keyLabel('product_detail.add_to_cart')).toBe('Detail produktu › Tlačítko do košíku');
    expect(component.keyLabel('cart.title')).toBe('Košík › ' + (adminCz as any)['translation-editor'].editor_key_words.title.replace(/^./, (c: string) => c.toUpperCase()));
  });
});
