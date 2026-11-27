/**
 * @file settings.component.spec.ts
 * @path src/app/admin/core-pages/settings/settings.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of SettingsComponent - the company profile in three tabs (company
 *   details / brand and texts / social media and measuring): the tab of the address, the dots of
 *   unsaved tabs, saving one tab without touching the others, reloads that keep unsaved edits,
 *   leaving with unsaved edits, the logo, the social links (order, address check, delete), the
 *   texts per language (counts, missing marks, `?lang=`, Czech required) and the permissions.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, confirm/alert spies, permission stub),
 *   ResourceCacheService (real), ActivatedRoute stub (query parameter `tab`)
 */

import { ComponentFixture, TestBed, fakeAsync, flush, discardPeriodicTasks, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { SettingsComponent } from './settings.component';
import { environment } from '../../../../environments/environment';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { AdminNotificationsService } from '../../../core/services/admin-notifications.service';

describe('SettingsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let params$: BehaviorSubject<any>;

  const config = () => ({
    settings: {
      id: 1, company_name: 'RPSW', ico: '1', dic: 'CZ1', contact_email: 'a@b.cz', brand_tagline: 'Tag', logo_path: 'logo.png',
      hidden_fields: ['google_analytics_id', 'contact_phone', 'address']
    },
    social_links: [
      { id: 5, name: 'LinkedIn', url: 'https://l.cz', icon_path: 'li.png', position: 1 },
      { id: 6, name: 'Facebook', url: 'https://f.cz', icon_path: '', position: 2 },
    ]
  });

  const languages = [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }];

  const setup = async (options: { granted?: string[] | 'all' } = {}) => {
    ctx = createAdminTestContext(options);
    params$ = new BehaviorSubject(convertToParamMap({}));
    (ctx.dataHandler as any).get.and.callFake((url: string) => {
      if (url === 'languages') return of(languages);
      if (url === 'legal/config') return of(config());
      return of({});
    });
    // the API answers a settings save with the stored values (the body it got)
    (ctx.dataHandler as any).put.and.callFake((url: string, body: any) =>
      of(url === 'legal/config/settings' ? { ...config().settings, ...body } : { id: +url.split('/').pop()!, ...body }));
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: { queryParamMap: params$, snapshot: { data: {} } } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
  };

  afterEach(() => fixture?.destroy());

  const init = () => component.ngOnInit();
  const put = () => (ctx.dataHandler as any).put;

  describe('loading and tabs', () => {
    beforeEach(() => setup());

    /**
     * @description The first load reads the languages and the settings once (cache), fills every
     *   language and never reads legal/config as a paginated list.
     * @input  ngOnInit(); languages cz, en; settings with tagline 'Tag' and no i18n
     * @output company_name 'RPSW'; brand_tagline_i18n { cz: 'Tag', en: '' }; 2 social links;
     *   loaded true, loading false; one GET legal/config; nothing dirty
     */
    it('loads the settings once with per-language defaults', fakeAsync(() => {
      init();
      expect(ctx.genericTable.getPaginatedData).not.toHaveBeenCalled();
      expect((ctx.dataHandler as any).get.calls.allArgs().filter((a: any[]) => a[0] === 'legal/config').length).toBe(1);
      expect(component.settings.company_name).toBe('RPSW');
      expect(component.settings.brand_tagline_i18n).toEqual({ cz: 'Tag', en: '' });
      expect(component.socialLinks.map(s => s.name)).toEqual(['LinkedIn', 'Facebook']);
      expect([component.loaded, component.loading, component.hasUnsavedChanges]).toEqual([true, false, false]);
      discardPeriodicTasks();
    }));

    /**
     * @description The open tab follows the address; switching navigates with `?tab=` (none for
     *   the company details); the same tab does not navigate.
     * @input  ?tab=social, ?tab=nonsense; switchTab('brand' / 'company' / current)
     * @output activeTab social, then company; navigate with { tab: 'brand' } and { tab: null }; one call each
     */
    it('follows and switches the tab of the address', fakeAsync(() => {
      init();
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      params$.next(convertToParamMap({ tab: 'social' }));
      expect(component.activeTab).toBe('social');
      params$.next(convertToParamMap({ tab: 'nonsense' }));
      expect(component.activeTab).toBe('company');

      component.switchTab('brand');
      component.switchTab('company');
      expect(navigate.calls.allArgs().map(a => (a[1] as any).queryParams)).toEqual([{ tab: 'brand' }]);
      params$.next(convertToParamMap({ tab: 'brand' }));
      component.switchTab('company');
      expect((navigate.calls.mostRecent().args[1] as any).queryParams).toEqual({ tab: null });
      discardPeriodicTasks();
    }));

    /**
     * @description Every tab renders its own card: company fields, brand (logo + language bar),
     *   social (rows + GA with the consent note); the tab row has three tabs.
     * @input  render the three tabs
     * @output company: company name input 'RPSW', no logo; brand: logo image and the language bar;
     *   social: 2 social rows and the GA field with its note
     */
    it('renders the card of the open tab', fakeAsync(() => {
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(component.tabItems.map(item => item.value)).toEqual(['company', 'brand', 'social']);
      expect((el.querySelector('#settings-company-name') as HTMLInputElement).value).toBe('RPSW');
      expect(el.querySelector('label[for="settings-company-name"]')).not.toBeNull();
      expect(el.querySelector('.ws-logo-img')).toBeNull();

      params$.next(convertToParamMap({ tab: 'brand' }));
      fixture.detectChanges();
      expect(el.querySelector('.ws-logo-img')).not.toBeNull();
      expect(el.querySelector('.ws-i18n-bar')).not.toBeNull();

      params$.next(convertToParamMap({ tab: 'social' }));
      fixture.detectChanges();
      expect(el.querySelectorAll('.ws-social-row').length).toBe(2);
      expect(el.querySelector('[name="google_analytics_id"]')?.getAttribute('aria-describedby')).toBe('settings-ga-note');
      discardPeriodicTasks();
    }));

    /**
     * @description A switched-off field is greyed out with a disabled input; unticking a checkbox
     *   switches its field off and marks the tab unsaved (dot on the tab, Save enabled).
     * @input  rendered company tab (address off, DIČ on); untick DIČ
     * @output address .ws-field--off + disabled; after the click DIČ off, tab company dot, Save enabled
     */
    it('switches optional fields and marks the tab unsaved', fakeAsync(() => {
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      const field = (name: string): HTMLElement =>
        (fixture.nativeElement.querySelector(`[name="${name}"]`) as HTMLElement).closest('.ws-field') as HTMLElement;
      expect(field('address').classList).toContain('ws-field--off');
      expect((field('address').querySelector('.ws-input') as HTMLInputElement).disabled).toBeTrue();
      const save = fixture.nativeElement.querySelector('.ws-card-header--actions .ws-btn-primary') as HTMLButtonElement;
      expect(save.disabled).toBeTrue();

      const box = field('dic').querySelector('.ws-field-toggle') as HTMLInputElement;
      box.checked = false;
      box.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(component.isFieldOn('dic')).toBeFalse();
      expect(field('dic').classList).toContain('ws-field--off');
      expect(component.tabItems.map(item => !!item.dot)).toEqual([true, false, false]);
      expect(save.disabled).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description A failed first load shows the error with "Zkusit znovu" instead of an empty
     *   form; retrying loads past the cache.
     * @input  GET legal/config fails; then succeeds and retryLoad()
     * @output errorMessage 'settings.load_error_message', no card; after retry loaded, no error
     */
    it('offers a retry after a failed first load', fakeAsync(() => {
      (ctx.dataHandler as any).get.and.callFake((url: string) =>
        url === 'legal/config' ? throwError(() => new Error('x')) : of(languages));
      fixture.detectChanges();
      fixture.detectChanges();
      expect(component.errorMessage).toBe('settings.load_error_message');
      expect(fixture.nativeElement.querySelector('.ws-card')).toBeNull();
      expect(fixture.nativeElement.querySelector('.ws-error .ws-btn')).not.toBeNull();

      (ctx.dataHandler as any).get.and.callFake((url: string) => url === 'languages' ? of(languages) : of(config()));
      component.retryLoad();
      fixture.detectChanges();
      expect([component.loaded, component.errorMessage]).toEqual([true, null]);
      expect(fixture.nativeElement.querySelector('.ws-card')).not.toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description Languages: a missing current language switches to the first; switched off
     *   languages are offered muted; a failed language load falls back to Czech.
     * @input  languages [en, de inactive]; then a reload with a languages error and no languages kept
     * @output currentLang 'en'; muted [false, true]; names; fallback [cz]
     */
    it('handles the languages', fakeAsync(() => {
      (ctx.dataHandler as any).get.and.callFake((url: string) => url === 'languages'
        ? of([{ code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }])
        : of(config()));
      init();
      expect(component.languages.map(l => l.code)).toEqual(['en', 'de']);
      expect(component.langItems.map(item => !!item.muted)).toEqual([false, true]);
      expect(component.currentLang).toBe('en');
      expect([component.getLangName('en'), component.getLangName('xx')]).toEqual(['English', 'XX']);
      component.switchLang('en');
      component.switchLang('cz');
      expect(component.currentLang).toBe('cz');

      component.languages = [];
      (ctx.dataHandler as any).get.and.callFake((url: string) => url === 'languages' ? throwError(() => new Error('x')) : of(config()));
      component.refreshData();
      expect(component.languages.map(l => l.code)).toEqual(['cz']);
      discardPeriodicTasks();
    }));
  });

  describe('saving one tab', () => {
    beforeEach(() => setup());

    /**
     * @description Saving the company tab sends the stored values of the other tabs - the unsaved
     *   brand edit stays only in the form (and its tab stays dirty); no reload, one mark, no dialog.
     * @input  name 'New', Czech tagline 'Typed' (brand); saveTab('company')
     * @output PUT body company_name 'New', brand_tagline_i18n cz 'Tag' (stored); afterwards company
     *   clean, brand dirty, tagline still 'Typed'; GET legal/config not repeated; savedTab 'company';
     *   no success alert; no copyright / footer text in the body
     */
    it('saves the company tab without the edits of the others', fakeAsync(() => {
      init();
      (ctx.dataHandler as any).get.calls.reset();
      component.settings.company_name = 'New';
      component.settings.brand_tagline_i18n['cz'] = 'Typed';
      component.saveTab('company');
      const [url, body] = put().calls.mostRecent().args;
      expect(url).toBe('legal/config/settings');
      expect(body).toEqual(jasmine.objectContaining({ company_name: 'New', brand_tagline_i18n: { cz: 'Tag', en: '' }, google_analytics_id: null }));
      expect([body.footer_text, body.footer_text_i18n, body.copyright_text_i18n]).toEqual([undefined, undefined, undefined]);
      expect([component.tabDirty('company'), component.tabDirty('brand')]).toEqual([false, true]);
      expect(component.settings.brand_tagline_i18n['cz']).toBe('Typed');
      expect((ctx.dataHandler as any).get).not.toHaveBeenCalled();
      expect(component.savedTab).toBe('company');
      expect(ctx.alert.open).not.toHaveBeenCalled();
      tick(2500);
      expect(component.savedTab).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description The brand tab saves the chosen logo with its texts (multipart); the logo
     *   selection is cleared after the save.
     * @input  onLogoSelected(logo.png); saveTab('brand') with upload answering the stored values
     * @output upload('legal/config/settings', FormData{ logo_file, _method PUT, tagline JSON });
     *   logoFile null, logo_path from the answer, brand clean
     */
    it('saves the logo with the brand tab', fakeAsync(() => {
      init();
      (ctx.dataHandler as any).upload.and.returnValue(of({ ...config().settings, logo_path: 'new.png' }));
      const file = new File([new Uint8Array(1024)], 'logo.png', { type: 'image/png' });
      component.onLogoSelected({ target: { files: [file], value: 'x' } } as any);
      expect(component.logoSrc).toMatch(/^blob:/);
      expect(component.tabDirty('brand')).toBeTrue();
      component.saveTab('brand');
      const [url, fd] = (ctx.dataHandler as any).upload.calls.mostRecent().args;
      expect(url).toBe('legal/config/settings');
      expect((fd.get('logo_file') as File).name).toBe('logo.png');
      expect(fd.get('_method')).toBe('PUT');
      expect(JSON.parse(fd.get('brand_tagline_i18n'))).toEqual({ cz: 'Tag', en: '' });
      expect(component.logoFile).toBeNull();
      expect(component.logoSrc).toBe(`${environment.public_storage_url}/new.png`);
      expect(component.tabDirty('brand')).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Validation: empty switched-on fields of the tab are listed; an empty stored
     *   field of another tab blocks the save with the name of that tab; nothing is sent.
     * @input  company: name ' ', phone switched on and empty; brand: stored name empty + tagline typed
     * @output warning validation_required_message (name, phone); then validation_other_tab_message; no PUT
     */
    it('refuses empty required fields', fakeAsync(() => {
      init();
      component.settings.company_name = ' ';
      component.setFieldOn('contact_phone', true);
      component.saveTab('company');
      expect(ctx.alert.open.calls.mostRecent().args).toEqual(['settings.validation_required_title', 'settings.validation_required_message', 'warning']);
      expect(component.missingFieldLabels(component.settings, 'company')).toEqual(['settings.field_company_name', 'settings.field_phone']);

      (component as any).saved = { ...(component as any).saved, company_name: '' };
      component.settings.brand_tagline_i18n['cz'] = 'Typed';
      component.saveTab('brand');
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('settings.validation_other_tab_message');
      expect(put()).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description The social tab saves the GA ID (format checked) and the changed / new / moved
     *   links together; a failed request keeps its edits and no mark is shown.
     * @input  GA on 'bad' → warning; GA 'G-ABC1234'; move Facebook up; add 'X' https://x.cz;
     *   upload of the new link fails
     * @output warning field_ga_invalid; PUT settings with GA; PUT social 6 position 1, 5 position 2;
     *   upload social; new row still new (dirty), others clean; savedTab null
     */
    it('saves the social tab together and keeps failed rows', fakeAsync(() => {
      init();
      component.setFieldOn('google_analytics_id', true);
      component.settings.google_analytics_id = 'bad';
      component.saveTab('social');
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('settings.validation_required_message');
      expect(component.missingFieldLabels(component.settings, 'social')).toEqual(['settings.field_ga_invalid']);

      component.settings.google_analytics_id = 'G-ABC1234';
      component.moveSocialLink(1, -1);
      component.addSocialLink();
      flush();
      const added = component.socialLinks[2];
      added.name = 'X';
      added.url = 'https://x.cz';
      (ctx.dataHandler as any).upload.and.returnValue(throwError(() => new Error('x')));
      component.saveTab('social');

      expect(put().calls.allArgs().map((a: any[]) => a[0])).toEqual(['legal/config/settings', 'legal/config/social/6', 'legal/config/social/5']);
      expect(put().calls.argsFor(1)[1]).toEqual(jasmine.objectContaining({ position: 1 }));
      expect((ctx.dataHandler as any).upload.calls.mostRecent().args[0]).toBe('legal/config/social');
      expect(component.socialLinks.map(link => link.name)).toEqual(['Facebook', 'LinkedIn', 'X']);
      expect(component.socialLinks.map(link => component.rowDirty(link) || !!link._isNew)).toEqual([false, false, true]);
      expect(component.settings.google_analytics_id).toBe('G-ABC1234');
      expect(component.tabDirty('social')).toBeTrue();
      expect([component.saving, component.savedTab]).toEqual([null, null]);
      discardPeriodicTasks();
    }));

    /**
     * @description Social link checks: a name and a full web address are needed; the invalid
     *   address is shown under the field; nothing is sent.
     * @input  add a row without a name; then name 'X' and url 'facebook.com'
     * @output warnings social_validation_name_message, social_validation_url_message; urlInvalid true; no upload
     */
    it('validates new social links', fakeAsync(() => {
      init();
      component.addSocialLink();
      flush();
      component.saveTab('social');
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('settings.social_validation_name_message');
      const row = component.socialLinks[2];
      row.name = 'X';
      row.url = 'facebook.com';
      expect(component.urlInvalid(row)).toBeTrue();
      component.saveTab('social');
      expect(ctx.alert.open.calls.mostRecent().args[1]).toBe('settings.social_validation_url_message');
      expect((ctx.dataHandler as any).upload).not.toHaveBeenCalled();
      expect(row.position).toBe(3);
      discardPeriodicTasks();
    }));

    /**
     * @description A second save while one runs, or a save without changes, sends nothing.
     * @input  saveTab('company') clean; saving set and a dirty tab
     * @output no PUT
     */
    it('ignores saves without changes or while saving', fakeAsync(() => {
      init();
      component.saveTab('company');
      component.settings.company_name = 'New';
      component.saving = 'brand';
      component.saveTab('company');
      expect(put()).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));
  });

  describe('reloads and leaving', () => {
    beforeEach(() => setup());

    /**
     * @description "Refresh all" (and the background refresh) reloads past the cache and keeps
     *   unsaved edits: a dirty tab keeps the typed values, clean tabs and clean rows take the
     *   loaded values, a new row stays.
     * @input  typed name (company dirty); renamed LinkedIn; a new row; the API now has tagline 'T2',
     *   Facebook 'FB2'; refreshAll$
     * @output name 'Typed'; Czech tagline 'T2'; rows LinkedIn typed, 'FB2', new row; GET legal/config again
     */
    it('keeps unsaved edits when the page reloads', fakeAsync(() => {
      init();
      component.settings.company_name = 'Typed';
      component.socialLinks[0].name = 'LinkedIn typed';
      component.addSocialLink();
      flush();
      (ctx.dataHandler as any).get.and.callFake((url: string) => {
        if (url === 'languages') return of(languages);
        const fresh = config();
        fresh.settings.brand_tagline = 'T2';
        fresh.social_links[1].name = 'FB2';
        return of(fresh);
      });
      ctx.refreshAll$.next();
      expect(component.settings.company_name).toBe('Typed');
      expect(component.settings.brand_tagline_i18n['cz']).toBe('T2');
      expect(component.socialLinks.map(link => link.name)).toEqual(['LinkedIn typed', 'FB2', '']);
      expect([component.tabDirty('company'), component.tabDirty('brand')]).toEqual([true, false]);
      discardPeriodicTasks();
    }));

    /**
     * @description Leaving: at once without unsaved edits; otherwise the confirmation names the
     *   unsaved tabs and its answer decides; the browser asks on beforeunload.
     * @input  clean page; then brand + social dirty, confirm false / true; beforeunload events
     * @output true; confirm open with leave labels, promises false / true; preventDefault only when dirty
     */
    it('asks before leaving with unsaved edits', fakeAsync(async () => {
      init();
      expect(component.confirmLeave()).toBeTrue();
      const clean = { preventDefault: jasmine.createSpy('preventDefault') } as any;
      component.onBeforeUnload(clean);
      expect(clean.preventDefault).not.toHaveBeenCalled();

      component.settings.brand_tagline_i18n['en'] = 'Typed';
      component.moveSocialLink(0, 1);
      ctx.confirm.open.and.resolveTo(false);
      expect(await component.confirmLeave()).toBeFalse();
      expect(ctx.confirm.open).toHaveBeenCalledWith('settings.leave_confirm_title', 'settings.leave_confirm_message',
        { confirm: 'settings.leave_confirm_button', cancel: 'settings.leave_stay_button' });
      ctx.confirm.open.and.resolveTo(true);
      expect(await component.confirmLeave()).toBeTrue();

      const dirty = { preventDefault: jasmine.createSpy('preventDefault') } as any;
      component.onBeforeUnload(dirty);
      expect(dirty.preventDefault).toHaveBeenCalled();
      discardPeriodicTasks();
    }));
  });

  describe('logo and social links', () => {
    const file = (name: string, type: string, size = 100) => { const f = new File(['x'], name, { type }); Object.defineProperty(f, 'size', { value: size }); return f; };
    const input = (f?: File) => ({ target: { files: f ? [f] : [], value: 'x' } } as any);

    beforeEach(() => setup());

    /**
     * @description Logo: too large / not an allowed image refused; a second choice replaces the
     *   preview; cancel removes it; the stored logo is shown otherwise.
     * @input  3 MB png; svg; no file; a.png, b.png; cancel; logo_path ''
     * @output 2 warnings; blob:1 revoked; logoSrc blob:2 → stored URL; no logo → null / false
     */
    it('manages the logo choice', fakeAsync(() => {
      init();
      component.onLogoSelected(input(file('big.png', 'image/png', 3 * 1024 * 1024)));
      component.onLogoSelected(input(file('a.svg', 'image/svg+xml')));
      expect(ctx.alert.open.calls.allArgs().map(a => a[1])).toEqual(['settings.logo_too_large_message', 'settings.logo_invalid_format_message']);
      expect(component.logoAccept).toBe('image/jpeg,image/png,image/webp');

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
      component.settings.logo_path = '';
      expect([component.logoSrc, component.hasLogo]).toEqual([null, false]);
      discardPeriodicTasks();
    }));

    /**
     * @description Icons: size / type checked, a second icon replaces the preview and marks the
     *   row dirty; a stored icon comes from public storage.
     * @input  big png, svg, a.png, b.png on row 0
     * @output 2 warnings; blob:a revoked; iconSrc blob:b; row 0 dirty; stored icon URL of row 1 none
     */
    it('checks and previews social icons', fakeAsync(() => {
      init();
      spyOn(URL, 'createObjectURL').and.returnValues('blob:a', 'blob:b');
      const revoke = spyOn(URL, 'revokeObjectURL');
      component.onIconSelected(input(), 0);
      component.onIconSelected(input(file('big.png', 'image/png', 3 * 1024 * 1024)), 0);
      component.onIconSelected(input(file('a.svg', 'image/svg+xml')), 0);
      expect(component.socialIconAccept).toBe('image/jpeg,image/png,image/webp,image/gif');
      expect(ctx.alert.open).toHaveBeenCalledWith('settings.logo_too_large_title', 'settings.social_icon_too_large_message', 'warning');
      expect(ctx.alert.open).toHaveBeenCalledWith('settings.logo_invalid_format_title', 'settings.social_icon_invalid_format_message', 'warning');
      component.onIconSelected(input(file('a.png', 'image/png')), 0);
      component.onIconSelected(input(file('b.png', 'image/png')), 0);
      expect(revoke).toHaveBeenCalledWith('blob:a');
      expect(component.iconSrc(component.socialLinks[0])).toBe('blob:b');
      expect(component.rowDirty(component.socialLinks[0])).toBeTrue();
      expect(component.iconSrc(component.socialLinks[1])).toBeNull();
      expect(component.iconSrc({ icon_path: 'x.png' } as any)).toBe(`${environment.public_storage_url}/x.png`);
      discardPeriodicTasks();
    }));

    /**
     * @description Moving: the ends do not move, a move renumbers the positions; moving back
     *   makes the rows clean again.
     * @input  move row 0 up; move row 0 down; move row 0 down again (back)
     * @output order unchanged, then [Facebook, LinkedIn] with positions [1, 2] dirty; back → clean
     */
    it('moves social links', fakeAsync(() => {
      init();
      component.moveSocialLink(0, -1);
      expect(component.tabDirty('social')).toBeFalse();
      component.moveSocialLink(0, 1);
      expect(component.socialLinks.map(link => [link.name, link.position])).toEqual([['Facebook', 1], ['LinkedIn', 2]]);
      expect(component.tabDirty('social')).toBeTrue();
      component.moveSocialLink(0, 1);
      expect(component.tabDirty('social')).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Deleting: a new row at once; a stored one after a confirmation, removed locally
     *   (no reload) while the other rows keep their edits; a cancelled confirmation keeps it.
     * @input  new row deleted; Facebook renamed; LinkedIn deleted (confirm true); Facebook (confirm false)
     * @output rows [Facebook typed]; delete('legal/config/social/5'); no GET; no second delete
     */
    it('deletes social links without a reload', fakeAsync(async () => {
      init();
      component.addSocialLink();
      flush();
      await component.deleteSocialLink(2);
      expect(component.socialLinks.length).toBe(2);

      component.socialLinks[1].name = 'Facebook typed';
      (ctx.dataHandler as any).get.calls.reset();
      await component.deleteSocialLink(0);
      expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('legal/config/social/5');
      expect(component.socialLinks.map(link => link.name)).toEqual(['Facebook typed']);
      expect((ctx.dataHandler as any).get).not.toHaveBeenCalled();

      ctx.confirm.open.and.resolveTo(false);
      await component.deleteSocialLink(0);
      expect((ctx.dataHandler as any).delete).toHaveBeenCalledTimes(1);
      await component.deleteSocialLink(9);
      flush();
      discardPeriodicTasks();
    }));
  });

  describe('texts per language', () => {
    beforeEach(() => setup());

    /**
     * @description The language tabs and the brand tab count the tagline missing in a language
     *   (orange; the brand tab grey when only a switched-off language misses it); a missing tagline
     *   of the open language is marked with its note; switching the tagline off removes it.
     * @input  languages cz, en (en without the tagline); then en filled and a switched-off
     *   language de; tagline switched off
     * @output en 1 (attention), brand tab 1; mark on the field in en; later de 1 neutral, brand
     *   tab 1 neutral; with the tagline off de none
     */
    it('counts and marks the missing tagline', fakeAsync(() => {
      fixture.detectChanges();
      flush();
      params$.next(convertToParamMap({ tab: 'brand' }));
      component.switchLang('en');
      fixture.detectChanges();
      const lang = (code: string) => component.langItems.find(item => item.value === code)!;
      expect([lang('cz').count, lang('en').count, lang('en').countTone]).toEqual([null, 1, 'attention']);
      const brand = component.tabItems.find(item => item.value === 'brand')!;
      expect([brand.count, brand.countTone]).toEqual([1, 'attention']);
      expect(fixture.nativeElement.querySelectorAll('.ws-field--missing').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.ws-field-missing')?.textContent).toContain('settings.missing_field_active');
      expect(fixture.nativeElement.querySelector('[name="copyright_text"], [name="footer_text"]')).toBeNull();

      component.settings.brand_tagline_i18n['en'] = 'x';
      component.languages = [...component.languages, { code: 'de', name: 'Deutsch', active: false }];
      expect([lang('en').count, lang('de').count, lang('de').countTone]).toEqual([null, 1, 'neutral']);
      expect([component.brandMissing.count, component.brandMissing.tone]).toEqual([1, 'neutral']);
      component.switchLang('de');
      expect(component.missingFieldNote).toBe('settings.missing_field_inactive');
      component.setFieldOn('brand_tagline', false);
      expect(lang('de').count).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description `?lang=` (a link of the window Jazyky) opens the language once it is loaded; an
     *   unknown one is ignored.
     * @input  ?tab=brand&lang=EN before the load; then ?lang=xx
     * @output activeTab brand, currentLang en; stays en
     */
    it('opens the language of the address', fakeAsync(() => {
      params$.next(convertToParamMap({ tab: 'brand', lang: 'EN' }));
      init();
      expect([component.activeTab, component.currentLang]).toEqual(['brand', 'en']);
      params$.next(convertToParamMap({ tab: 'brand', lang: 'xx' }));
      expect(component.currentLang).toBe('en');
      discardPeriodicTasks();
    }));

    /**
     * @description A switched-on text needs its Czech text (the other languages are counted, not
     *   required); the tagline is sent per language; a saved brand tab refreshes the dots.
     * @input  Czech tagline emptied, English filled; saveTab('brand'); Czech filled; saveTab('brand')
     * @output warning listing 'settings.field_brand_tagline (CZ)', no PUT; then PUT with
     *   brand_tagline_i18n and notifications.refresh() called
     */
    it('requires the Czech text and refreshes the dots after a save', fakeAsync(() => {
      init();
      const refresh = spyOn(TestBed.inject(AdminNotificationsService), 'refresh');
      component.settings.brand_tagline_i18n['cz'] = ' ';
      component.settings.brand_tagline_i18n['en'] = 'Tag EN';
      component.saveTab('brand');
      expect(component.missingFieldLabels(component.settings, 'brand')).toEqual(['settings.field_brand_tagline (CZ)']);
      expect(put()).not.toHaveBeenCalled();

      component.settings.brand_tagline_i18n['cz'] = 'Tag';
      component.saveTab('brand');
      expect(put().calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ brand_tagline_i18n: { cz: 'Tag', en: 'Tag EN' } }));
      expect(refresh).toHaveBeenCalled();
      discardPeriodicTasks();
    }));
  });

  describe('permissions', () => {
    /**
     * @description Only adding social links: the company fields are read-only without a Save
     *   button; the social tab saves new rows but stored rows are locked.
     * @input  granted core-legal-config-view + create; render company and social tabs
     * @output company fieldset disabled, no Save; social Save shown; stored rows disabled; new row editable
     */
    it('locks what the account may not change', fakeAsync(async () => {
      await setup({ granted: ['core-legal-config-view', 'core-legal-config-create'] });
      fixture.detectChanges();
      flush();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect((el.querySelector('.ws-card-body.ws-fieldset') as HTMLFieldSetElement).disabled).toBeTrue();
      expect(el.querySelector('.ws-card-header--actions .ws-btn-primary')).toBeNull();
      expect(component.canSaveTab('company')).toBeFalse();

      params$.next(convertToParamMap({ tab: 'social' }));
      component.addSocialLink();
      flush();
      fixture.detectChanges();
      expect(el.querySelector('.ws-card-header--actions .ws-btn-primary')).not.toBeNull();
      const rows = Array.from(el.querySelectorAll('fieldset.ws-social-row')) as HTMLFieldSetElement[];
      expect(rows.map(row => row.disabled)).toEqual([true, true, false]);
      expect(el.querySelectorAll('.ws-btn-delete').length).toBe(1);
      discardPeriodicTasks();
    }));
  });
});
