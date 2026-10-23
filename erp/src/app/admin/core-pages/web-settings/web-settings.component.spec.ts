/**
 * @file web-settings.component.spec.ts
 * @path src/app/admin/core-pages/web-settings/web-settings.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of WebSettingsComponent – company settings (incl. logo upload and
 *   per-language texts), social links (add / save / delete with icon upload) and the page-titles
 *   tab (load, dirty tracking, save only changed rows, discard, permission).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, confirm/alert spies, permission stub),
 *   ResourceCacheService (real)
 */

import { ComponentFixture, TestBed, fakeAsync, flush, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { WebSettingsComponent } from './web-settings.component';
import { environment } from '../../../../environments/environment';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('WebSettingsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<WebSettingsComponent>;
  let component: WebSettingsComponent;

  const config = {
    settings: { company_name: 'RPSW', ico: '1', dic: 'CZ1', contact_email: 'a@b.cz', brand_tagline: 'Tag', copyright_text: '©', logo_path: 'logo.png' },
    social_links: [{ id: 5, name: 'LinkedIn', url: 'https://l', icon_path: 'li.png', position: 1 }]
  };
  const pageTitles = {
    page_titles: [
      { id: 1, area: 'web', page_key: 'home', route_path: '/home', title_i18n: { cz: 'Domů' } },
      { id: 2, area: 'web', page_key: 'faq', route_path: '/faq', title_i18n: { cz: 'FAQ', en: 'FAQ' } },
      { id: 3, area: 'admin', page_key: 'login', route_path: '/auth/login', title_i18n: { cz: 'Přihlášení' } }
    ]
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    (ctx.dataHandler as any).get.and.callFake((url: string) => {
      if (url === 'languages/web') return of({ languages: [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }] });
      if (url === 'languages/shop') return of({ languages: [] });
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
     * @output settings.company_name 'RPSW'; brand_tagline_i18n { cz: 'Tag', en: '' }; socialLinks 1 (LinkedIn); loading flags false
     */
    it('loads settings with per-language defaults', fakeAsync(() => {
      init();
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
        url === 'legal/config' ? throwError(() => new Error('x')) : of({ languages: [] }));
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

  describe('page titles', () => {
    const openTab = () => { init(); component.switchTab('page_titles'); };

    /**
     * @description The page-titles tab loads on first open; every row gets every language.
     * @input  switchTab('page_titles')
     * @output get('legal/config/page-titles'); areas ['web', 'admin']; row 1 title_i18n { cz: 'Domů', en: '' }; not dirty
     */
    it('loads page titles on first open', fakeAsync(() => {
      openTab();
      expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('legal/config/page-titles');
      expect(component.ptAreas).toEqual(['web', 'admin']);
      expect(component.ptRows[0].title_i18n).toEqual({ cz: 'Domů', en: '' });
      expect(component.ptIsDirty).toBeFalse();
      expect(component.ptVisibleRows.map(r => r.id)).toEqual([1, 2]);
      discardPeriodicTasks();
    }));

    /**
     * @description Only changed rows are saved; discard restores the loaded values.
     * @input  change row 1 cz to 'Úvod'; ptSave(); change again; ptDiscard()
     * @output put('legal/config/page-titles', { titles: [{ id: 1, title_i18n: { cz: 'Úvod', en: '' } }] }); after discard row 1 cz back
     */
    it('saves only changed rows and can discard', fakeAsync(() => {
      openTab();
      component.ptRows[0].title_i18n['cz'] = 'Úvod';
      expect(component.ptDirtyCount).toBe(1);
      expect(component.ptAreaDirty('web')).toBeTrue();
      component.ptSave();
      expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('legal/config/page-titles',
        { titles: [{ id: 1, title_i18n: { cz: 'Úvod', en: '' } }] });
      component.ptRows[1].title_i18n['cz'] = 'Changed';
      component.ptDiscard();
      expect(component.ptRows[1].title_i18n['cz']).toBe('FAQ');
      discardPeriodicTasks();
    }));

    /**
     * @description Without the update permission nothing is saved.
     * @input  granted []; dirty row; ptSave()
     * @output ptCanUpdate false; put not called
     */
    it('needs core-legal-config-update to save', fakeAsync(() => {
      openTab();
      ctx.permissions.granted = new Set();
      component.ptRows[0].title_i18n['cz'] = 'X';
      component.ptSave();
      expect(component.ptCanUpdate).toBeFalse();
      expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description The preview shows the focused row's title in the selected language.
     * @input  ptOnFocus(row 2); ptSwitchLang('en'); ptSwitchArea('admin')
     * @output ptPreviewText 'FAQ'; after area switch preview row reset and text 'Přihlášení' for cz
     */
    it('previews titles per area and language', fakeAsync(() => {
      openTab();
      component.ptOnFocus(component.ptRows[1]);
      component.ptSwitchLang('en');
      expect(component.ptPreviewText).toBe('FAQ');
      component.ptSwitchArea('admin');
      expect(component.ptPreviewRowId).toBeNull();
      expect(component.ptPreviewText).toBe('Přihlášení');
      discardPeriodicTasks();
    }));

    /**
     * @description A failed load shows the error state.
     * @input  GET legal/config/page-titles fails
     * @output ptLoadError true; ptLoading false
     */
    it('reports a failed page-titles load', fakeAsync(() => {
      init();
      (ctx.dataHandler as any).get.and.callFake((url: string) =>
        url === 'legal/config/page-titles' ? throwError(() => new Error('x')) : of({ languages: [] }));
      component.switchTab('page_titles');
      expect(component.ptLoadError).toBeTrue();
      expect(component.ptLoading).toBeFalse();
      discardPeriodicTasks();
    }));
  });

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
});
