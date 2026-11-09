/**
 * @file web-settings.component.spec.ts
 * @path src/app/admin/core-pages/web-settings/web-settings.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of WebSettingsComponent – company settings (incl. logo upload and
 *   per-language texts), social links (add / save / delete with icon upload), the page-titles
 *   tab hosting PageTitlesEditorComponent of the administration and the data retention tab.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, confirm/alert spies, permission stub),
 *   ResourceCacheService (real)
 */

import { ComponentFixture, TestBed, fakeAsync, flush, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { WebSettingsComponent } from './web-settings.component';
import { environment } from '../../../../environments/environment';
import { By } from '@angular/platform-browser';
import { PageTitlesEditorComponent } from '../../components/page-titles-editor/page-titles-editor.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('WebSettingsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<WebSettingsComponent>;
  let component: WebSettingsComponent;

  const config = {
    settings: {
      company_name: 'RPSW', ico: '1', dic: 'CZ1', contact_email: 'a@b.cz', brand_tagline: 'Tag', copyright_text: '©', logo_path: 'logo.png',
      hidden_fields: ['google_analytics_id', 'contact_phone', 'address', 'footer_text']
    },
    social_links: [{ id: 5, name: 'LinkedIn', url: 'https://l', icon_path: 'li.png', position: 1 }]
  };
  /** Payload of GET legal/config/page-titles - the administration's rows. */
  const pageTitles = [
    { id: 3, area: 'admin', page_key: 'panel', route_path: '/admin', title_i18n: { cz: 'Administrace' } }
  ];

  beforeEach(async () => {
    ctx = createAdminTestContext();
    (ctx.dataHandler as any).get.and.callFake((url: string) => {
      if (url === 'languages/web') return of([{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }]);
      if (url === 'languages/shop') return of([]);
      if (url === 'legal/config') return of(JSON.parse(JSON.stringify(config)));
      if (url === 'legal/config/page-titles') return of(JSON.parse(JSON.stringify(pageTitles)));
      return of({});
    });
    await TestBed.configureTestingModule({ imports: [WebSettingsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(WebSettingsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  const init = () => component.ngOnInit();

  describe('company settings', () => {
    /**
     * @description Init loads the active languages and the settings; per-language texts get defaults.
     * @input  ngOnInit(); languages cz, en; settings with brand_tagline 'Tag' and no i18n
     * @output settings.company_name 'RPSW'; brand_tagline_i18n { cz: 'Tag', en: '' }; socialLinks 1 (LinkedIn); loading flags false;
     *   legal/config is never read as a paginated list (it is one settings object)
     */
    it('loads settings with per-language defaults', fakeAsync(() => {
      init();
      expect(ctx.genericTable.getPaginatedData).not.toHaveBeenCalled();
      expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);
      expect(component.settings.company_name).toBe('RPSW');
      expect(component.settings.brand_tagline_i18n).toEqual({ cz: 'Tag', en: '' });
      expect(component.settings.copyright_text_i18n).toEqual({ cz: '©', en: '' });
      expect(component.socialLinks.map(s => s.name)).toEqual(['LinkedIn']);
      expect(component.settingsLoading).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Without a new logo the settings are saved as JSON (empty GA id → null).
     * @input  google_analytics_id ''; saveSettings()
     * @output put('legal/config/settings', { company_name: 'RPSW', …, google_analytics_id: null }); success alert
     */
    it('saves settings as JSON without a logo', fakeAsync(() => {
      init();
      component.settings.google_analytics_id = '';
      (ctx.dataHandler as any).put.and.returnValue(of({ company_name: 'RPSW' }));
      component.saveSettings();
      const [url, body] = (ctx.dataHandler as any).put.calls.mostRecent().args;
      expect(url).toBe('legal/config/settings');
      expect(body).toEqual(jasmine.objectContaining({ company_name: 'RPSW', ico: '1', google_analytics_id: null }));
      expect(ctx.alert.open).toHaveBeenCalledWith('web-settings.save_success_title', 'web-settings.save_success_message', 'success');
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description With a new logo the settings are sent as multipart (POST + _method=PUT).
     * @input  onLogoSelected(logo.png 1 KB image); saveSettings()
     * @output upload('legal/config/settings', FormData{ logo_file, _method: 'PUT', brand_tagline_i18n JSON }); logo selection cleared afterwards
     */
    it('uploads the logo with the settings', fakeAsync(() => {
      init();
      const file = new File([new Uint8Array(1024)], 'logo.png', { type: 'image/png' });
      component.onLogoSelected({ target: { files: [file], value: 'x' } } as any);
      expect(component.logoSrc).toMatch(/^blob:/);
      component.saveSettings();
      const [url, fd] = (ctx.dataHandler as any).upload.calls.mostRecent().args;
      expect(url).toBe('legal/config/settings');
      expect((fd.get('logo_file') as File).name).toBe('logo.png');
      expect(fd.get('_method')).toBe('PUT');
      expect(JSON.parse(fd.get('brand_tagline_i18n'))).toEqual({ cz: 'Tag', en: '' });
      expect(component.logoFile).toBeNull();
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Optional fields: on unless listed in hidden_fields; the checkbox switches them
     *   and the list is sent on save (JSON body and multipart).
     * @input  loaded settings (GA, phone, address, footer off); setFieldOn('dic', false),
     *   setFieldOn('address', true) + address 'Praha'; saveSettings(); then a logo + saveSettings()
     * @output isFieldOn dic true / GA false; body.hidden_fields [GA, phone, footer, dic];
     *   FormData hidden_fields the same list as JSON
     */
    it('switches optional fields on and off and sends them', fakeAsync(() => {
      init();
      expect(component.isFieldOn('dic')).toBeTrue();
      expect(component.isFieldOn('google_analytics_id')).toBeFalse();
      component.setFieldOn('dic', false);
      component.setFieldOn('address', true);
      component.settings.address = 'Praha';
      (ctx.dataHandler as any).put.and.returnValue(of({ company_name: 'RPSW' }));
      component.saveSettings();
      const expected = ['google_analytics_id', 'contact_phone', 'footer_text', 'dic'];
      expect((ctx.dataHandler as any).put.calls.mostRecent().args[1].hidden_fields).toEqual(expected);
      flush();

      component.setFieldOn('dic', false);
      component.setFieldOn('address', true);
      component.settings.address = 'Praha';
      component.onLogoSelected({ target: { files: [new File([new Uint8Array(10)], 'l.png', { type: 'image/png' })], value: 'x' } } as any);
      component.saveSettings();
      const fd = (ctx.dataHandler as any).upload.calls.mostRecent().args[1] as FormData;
      expect(JSON.parse(fd.get('hidden_fields') as string)).toEqual(expected);
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Saving is refused while a required field is empty: name, e-mail and every
     *   switched-on optional field (i18n: a text in some language); switched-off fields do not count.
     * @input  name '', phone switched on and empty, tagline texts empty, GA off and empty; saveSettings()
     * @output warning 'validation_required_title' listing name, tagline and phone (no "*", no GA); no PUT;
     *   with everything filled / off → missingFieldLabels() []
     */
    it('refuses to save empty required fields', fakeAsync(() => {
      init();
      component.settings.company_name = ' ';
      component.setFieldOn('contact_phone', true);
      component.settings.brand_tagline_i18n = { cz: '', en: ' ' };
      component.saveSettings();
      const [title, message, type] = ctx.alert.open.calls.mostRecent().args;
      expect([title, type]).toEqual(['web-settings.validation_required_title', 'warning']);
      expect(message).toBe('web-settings.validation_required_message');
      expect(component.missingFieldLabels()).toEqual(['web-settings.field_company_name', 'web-settings.field_brand_tagline', 'web-settings.field_phone']);
      expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();

      component.settings.company_name = 'RPSW';
      component.settings.brand_tagline_i18n = { cz: '', en: 'Tag' };
      component.setFieldOn('contact_phone', false);
      expect(component.missingFieldLabels()).toEqual([]);
      discardPeriodicTasks();
    }));

    /**
     * @description A switched-off field is shown greyed out (struck through) with a disabled input;
     *   unticking a checkbox switches its field off.
     * @input  rendered company tab; GA off, DIČ on; untick the DIČ checkbox
     * @output GA field .ws-field--off with disabled input; DIČ field not off, input enabled;
     *   after the click DIČ off
     */
    it('renders switched-off fields disabled', fakeAsync(() => {
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      const field = (name: string): HTMLElement =>
        (fixture.nativeElement.querySelector(`[name="${name}"]`) as HTMLElement).closest('.ws-field') as HTMLElement;
      expect(field('google_analytics_id').classList).toContain('ws-field--off');
      expect((field('google_analytics_id').querySelector('.ws-input') as HTMLInputElement).disabled).toBeTrue();
      expect(field('dic').classList).not.toContain('ws-field--off');

      const box = field('dic').querySelector('.ws-field-toggle') as HTMLInputElement;
      box.checked = false;
      box.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(component.isFieldOn('dic')).toBeFalse();
      expect(field('dic').classList).toContain('ws-field--off');
      discardPeriodicTasks();
    }));

    /**
     * @description Logos over 2 MB or non-images are rejected.
     * @input  3 MB image; 1 KB text file
     * @output warnings 'logo_too_large_message', 'logo_invalid_format_message'; logoFile null
     */
    it('rejects too large or non-image logos', () => {
      const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
      const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
      component.onLogoSelected({ target: { files: [big], value: 'x' } } as any);
      component.onLogoSelected({ target: { files: [txt], value: 'x' } } as any);
      expect(ctx.alert.open.calls.allArgs().map(a => a[1])).toEqual(['web-settings.logo_too_large_message', 'web-settings.logo_invalid_format_message']);
      expect(component.logoFile).toBeNull();
    });

    /**
     * @description The logo shown is the new preview, else the stored file from public storage.
     * @input  settings.logo_path 'logo.png', no preview
     * @output logoSrc '<public_storage_url>/logo.png'; hasLogo true
     */
    it('shows the stored logo', fakeAsync(() => {
      init();
      expect(component.logoSrc).toBe(`${environment.public_storage_url}/logo.png`);
      expect(component.hasLogo).toBeTrue();
      discardPeriodicTasks();
    }));

    /**
     * @description A failed settings load shows the translated error.
     * @input  GET legal/config fails
     * @output errorMessage 'web-settings.load_error_message'
     */
    it('reports a failed load', fakeAsync(() => {
      (ctx.dataHandler as any).get.and.callFake((url: string) =>
        url === 'legal/config' ? throwError(() => new Error('x')) : of([]));
      init();
      expect(component.errorMessage).toBe('web-settings.load_error_message');
      discardPeriodicTasks();
    }));
  });

  describe('social links', () => {
    /**
     * @description A new link needs name and URL and is created as multipart.
     * @input  addSocialLink(); save without name; then name 'X', url 'https://x'
     * @output warning 'social_validation_name_message'; then upload('legal/config/social', FormData{ name: 'X', url, position '2' })
     */
    it('validates and creates a new social link', fakeAsync(() => {
      init();
      component.addSocialLink();
      const index = component.socialLinks.length - 1;
      component.saveSocialLink(index);
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('web-settings.social_validation_name_message');
      component.socialLinks[index].name = 'X';
      component.socialLinks[index].url = 'https://x';
      component.saveSocialLink(index);
      const [url, fd] = (ctx.dataHandler as any).upload.calls.mostRecent().args;
      expect(url).toBe('legal/config/social');
      expect(fd.get('name')).toBe('X');
      expect(fd.get('position')).toBe('2');
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description An existing link without a new icon is updated as JSON, with a new icon as multipart PUT.
     * @input  save link 5; then select an icon and save again
     * @output put('legal/config/social/5', { name, url, position, icon_path }); then uploadPut('legal/config/social/5', FormData with icon_file)
     */
    it('updates an existing social link', fakeAsync(() => {
      init();
      component.saveSocialLink(0);
      expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('legal/config/social/5',
        { name: 'LinkedIn', url: 'https://l', position: 1, icon_path: 'li.png' });
      flush();
      const icon = new File([new Uint8Array(10)], 'i.png', { type: 'image/png' });
      component.onIconSelected({ target: { files: [icon], value: 'x' } } as any, 0);
      component.saveSocialLink(0);
      const [url, fd] = (ctx.dataHandler as any).uploadPut.calls.mostRecent().args;
      expect(url).toBe('legal/config/social/5');
      expect((fd.get('icon_file') as File).name).toBe('i.png');
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description An unsaved new link is removed locally; a saved one after confirmation via API.
     * @input  addSocialLink(); deleteSocialLink(new); deleteSocialLink(0) with confirm → true
     * @output 1 link left after the first; delete('legal/config/social/5') after the second
     */
    it('deletes social links', fakeAsync(() => {
      init();
      component.addSocialLink();
      component.deleteSocialLink(1);
      expect(component.socialLinks.length).toBe(1);
      component.deleteSocialLink(0);
      flush();
      expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('legal/config/social/5');
      discardPeriodicTasks();
    }));
  });

  /**
   * @description The page titles tab shows only the administration's title (the web / e-shop titles
   *   live in their modules): the editor is created on the first open with area 'admin' and the
   *   core endpoint, stays created (hidden) on another tab, and its unsaved state sets the tab dot.
   * @input switchTab('page_titles'); dirtyChange(true); switchTab('company').
   * @output app-page-titles-editor area admin, endpoint legal/config/page-titles, permission
   *   core-legal-config-update, labels of web-settings; dot on the tab; editor hidden, not destroyed.
   */
  it('hosts the page titles editor of the administration', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    expect(fixture.nativeElement.querySelector('app-page-titles-editor')).toBeNull();
    component.switchTab('page_titles');
    fixture.detectChanges();
    const el = fixture.debugElement.query(By.css('app-page-titles-editor'));
    const editor = el.componentInstance as PageTitlesEditorComponent;
    expect([editor.area, editor.endpoint, editor.updatePermission, editor.labelSection])
      .toEqual(['admin', 'legal/config/page-titles', 'core-legal-config-update', 'web-settings']);
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('legal/config/page-titles');

    editor.dirtyChange.emit(true);
    fixture.detectChanges();
    expect(component.ptIsDirty).toBeTrue();
    expect(fixture.nativeElement.querySelector('.ws-tab-dot')).not.toBeNull();

    component.switchTab('company');
    fixture.detectChanges();
    expect(el.nativeElement.style.display).toBe('none');
    expect(fixture.debugElement.query(By.css('app-page-titles-editor')).componentInstance).toBe(editor);
    discardPeriodicTasks();
  }));

  /**
   * @description The page renders the company name field value.
   * @input  detectChanges()
   * @output an input contains 'RPSW'
   */
  it('renders the settings form', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    const values = Array.from(fixture.nativeElement.querySelectorAll('input')).map((i: any) => i.value);
    expect(values).toContain('RPSW');
    discardPeriodicTasks();
  }));
  describe('remaining paths', () => {
    const file = (name: string, type: string, size = 100) => { const f = new File(['x'], name, { type }); Object.defineProperty(f, 'size', { value: size }); return f; };
    const input = (f?: File) => ({ target: { files: f ? [f] : [], value: 'x' } } as any);

    /**
     * @description Languages: the current language missing in the list switches to the first;
     *   a failed language load falls back to Czech; inactive languages are hidden; tab / language
     *   switches and language names.
     * @input languages [en, de inactive] (current cz); then languages error; switchLang / switchTab; getLangName.
     * @output currentLang 'en', ['en']; fallback [cz]; switches applied once; 'English' / 'XX'.
     */
    /**
     * @description The "Data retention" tab shows RetentionSettingsComponent (VT-10), which loads
     *   its own settings; the company tab hides it again.
     * @input switchTab('retention'); switchTab('company').
     * @output activeTab 'retention', app-retention-settings rendered (no page titles card), get('core/retention_settings'); then gone.
     */
    it('shows the data retention tab', fakeAsync(() => {
      (ctx.dataHandler as any).get.and.callFake((url: string) => url === 'core/retention_settings' ? of([])
        : url === 'languages/web' ? of([{ code: 'cz', name: 'Čeština', active: true }]) : of(JSON.parse(JSON.stringify(config))));
      fixture.detectChanges();
      component.switchTab('retention');
      fixture.detectChanges();
      expect(component.activeTab).toBe('retention');
      expect(fixture.nativeElement.querySelector('app-retention-settings')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.pt-card')).toBeNull();
      expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('core/retention_settings');
      component.switchTab('company');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-retention-settings')).toBeNull();
      discardPeriodicTasks();
    }));

    it('handles languages, tabs and names', fakeAsync(() => {
      (ctx.dataHandler as any).get.and.callFake((url: string) => url === 'languages/web'
        ? of([{ code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }])
        : of(JSON.parse(JSON.stringify(config))));
      init();
      expect(component.languages.map(l => l.code)).toEqual(['en']);
      expect(component.currentLang).toBe('en');
      expect(component.getLangName('en')).toBe('English');
      expect(component.getLangName('xx')).toBe('XX');
      component.switchLang('en');
      component.switchLang('cz');
      expect(component.currentLang).toBe('cz');
      component.switchTab('company');
      expect(component.activeTab).toBe('company');

      (component as any).resourceCache.invalidate('web-settings:languages:web');
      (ctx.dataHandler as any).get.and.callFake((url: string) => url === 'languages/web' ? throwError(() => new Error('x')) : of({}));
      (component as any).loadLanguages();
      expect(component.languages.map(l => l.code)).toEqual(['cz']);
      expect(component.settings.brand_tagline_i18n).toEqual({ cz: 'Tag' });
      discardPeriodicTasks();
    }));

    /**
     * @description Logo: no file ignored, valid image previewed, a second one replaces the preview,
     *   cancel removes it; a failed save stops the spinner; refresh reloads from the API.
     * @input onLogoSelected without / with png twice; cancel; save with PUT error; refreshData().
     * @output preview blob URL revoked on replace / cancel; logoSrc preview → stored; settingsSaving false; legal/config requested again.
     */
    it('manages the logo preview and failed saves', fakeAsync(() => {
      init();
      spyOn(URL, 'createObjectURL').and.returnValues('blob:1', 'blob:2');
      const revoke = spyOn(URL, 'revokeObjectURL');
      component.onLogoSelected(input());
      component.onLogoSelected(input(file('a.png', 'image/png')));
      component.onLogoSelected(input(file('b.png', 'image/png')));
      expect(revoke).toHaveBeenCalledWith('blob:1');
      expect(component.logoSrc).toBe('blob:2');
      component.cancelLogoSelection();
      expect(revoke).toHaveBeenCalledWith('blob:2');
      expect(component.logoSrc).toBe(`${environment.public_storage_url}/logo.png`);
      component.cancelLogoSelection();

      (ctx.dataHandler as any).put.and.returnValue(throwError(() => new Error('x')));
      component.saveSettings();
      expect(component.settingsSaving).toBeFalse();
      component.settingsSaving = true;
      component.saveSettings();
      component.settingsSaving = false;

      (ctx.dataHandler as any).get.calls.reset();
      component.refreshData();
      expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('legal/config');
      component.settings.logo_path = '';
      expect([component.logoSrc, component.hasLogo]).toEqual([null, false]);
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Social links: new row added (scrolls to the anchor), icon validation (size,
     *   type, replaces a preview), URL required, double save ignored, failed save keeps the row,
     *   a new unsaved row is removed without the API, cancelled delete keeps the link.
     * @input addSocialLink; icons too big / text / png ×2; save without url; save twice; upload error; delete new; confirm false.
     * @output 2 links; 2 warnings; preview replaced; url warning; one request; _saving false; row removed; no DELETE.
     */
    it('validates and saves social links', fakeAsync(async () => {
      init();
      const anchor = document.createElement('div');
      anchor.id = 'social-add-anchor';
      anchor.scrollIntoView = jasmine.createSpy('scrollIntoView');
      document.body.appendChild(anchor);
      component.addSocialLink();
      flush();
      expect(anchor.scrollIntoView).toHaveBeenCalled();
      anchor.remove();
      expect(component.socialLinks.length).toBe(2);

      spyOn(URL, 'createObjectURL').and.returnValues('blob:a', 'blob:b');
      const revoke = spyOn(URL, 'revokeObjectURL');
      component.onIconSelected(input(), 1);
      component.onIconSelected(input(file('big.png', 'image/png', 3 * 1024 * 1024)), 1);
      component.onIconSelected(input(file('a.txt', 'text/plain')), 1);
      expect(ctx.alert.open).toHaveBeenCalledWith('web-settings.logo_too_large_title', 'web-settings.social_icon_too_large_message', 'warning');
      expect(ctx.alert.open).toHaveBeenCalledWith('web-settings.logo_invalid_format_title', 'web-settings.social_icon_invalid_format_message', 'warning');
      component.onIconSelected(input(file('a.png', 'image/png')), 1);
      component.onIconSelected(input(file('b.png', 'image/png')), 1);
      expect(revoke).toHaveBeenCalledWith('blob:a');
      expect(component.iconSrc(component.socialLinks[1])).toBe('blob:b');
      expect(component.iconSrc({ icon_path: '' } as any)).toBeNull();

      component.socialLinks[1].name = 'X';
      component.saveSocialLink(1);
      expect(ctx.alert.open).toHaveBeenCalledWith('web-settings.social_validation_title', 'web-settings.social_validation_url_message', 'warning');
      component.socialLinks[1].url = 'https://x';
      (ctx.dataHandler as any).upload.and.returnValue(throwError(() => new Error('x')));
      component.socialLinks[1]._saving = true;
      component.saveSocialLink(1);
      expect((ctx.dataHandler as any).upload).not.toHaveBeenCalled();
      component.socialLinks[1]._saving = false;
      component.saveSocialLink(1);
      expect(component.socialLinks[1]._saving).toBeFalse();
      expect((ctx.dataHandler as any).upload.calls.mostRecent().args[0]).toBe('legal/config/social');

      await component.deleteSocialLink(1);
      expect(revoke).toHaveBeenCalledWith('blob:b');
      expect(component.socialLinks.length).toBe(1);
      ctx.confirm.open.and.resolveTo(false);
      await component.deleteSocialLink(0);
      expect((ctx.dataHandler as any).delete).not.toHaveBeenCalled();
      expect(component.trackByIndex(3)).toBe(3);
      flush();
      discardPeriodicTasks();
    }));
  });
});
