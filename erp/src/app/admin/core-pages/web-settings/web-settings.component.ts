/**
 * @file web-settings.component.ts
 * @path src/app/admin/web-pages/web-settings/web-settings.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages global web configuration including company details, localized brand assets, site branding, and social media links.
 * @dependencies
 * - BaseDataComponent: Provides base CRUD and state management.
 * - ConfirmDialogService: Orchestrates user confirmation for destructive actions (e.g., deleting social links).
 * - ResourceCacheService: TTL cache pro languages (10 min) / settings (2 min) fetch.
 * Po KAŽDÉ úspěšné mutaci se cache klíč `web-settings:all` explicitně invaliduje
 * PŘED voláním `loadAll()`.
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z HTTP `error:` callbacků (onSettingsError, saveSocialLink onError,
 * deleteSocialLink error) - `DataHandler.handleError()` je jediné autoritativní místo
 * pro chybový toast. Reset stavových flagů (`settingsSaving`, `_saving`) ZŮSTÁVÁ.
 * `onSettingsError()` je teď jen cleanup metoda bez vlastní zprávy.
 *  * @howto Add a page to "Názvy stránek":
 *   1) app.routes.ts – route gets `title: 'area.page_key'` (e.g. 'web.blog').
 *   2) DB – INSERT row into `legal_page_titles` (area + page_key = route key).
 *   3) Optional – translation key `pt_page_{area}_{page_key}` for the admin label.
 */


import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { environment } from '../../../../environments/environment';
import { LangMeta, SiteSetting, SocialLink } from './'
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  PageTitleArea, PageTitleLang, PageTitleRow, PageTitlesResponse, PageTitlesUpdatePayload
} from './page-titles.model';

@Component({
  selector: 'app-web-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './web-settings.component.html',
  styleUrl: './web-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebSettingsComponent extends BaseDataComponent<any> implements OnInit {
  override apiEndpoint = 'legal/config';
  protected override translationSection: string = 'web-settings';

  private readonly LANG_MODULE = 'web';
  private readonly LANG_TTL_MS = 10 * 60 * 1000;
  private readonly SETTINGS_TTL_MS = 2 * 60 * 1000;
  private readonly SETTINGS_CACHE_KEY = 'web-settings:all';

  private resourceCache = inject(ResourceCacheService);

  /**
   * @refactor-note (2026-09) BUGFIX "Cannot load text" - stejná chyba jako
   * EditRolesComponent (viz jeho refactor-note stejné datum): `this.t(key)` volání
   * v tomto souboru všude předávají KRÁTKÝ klíč (např. 'load_error_message'), ale
   * zděděná `BaseDataComponent.t(path)` očekává PLNOU tečkovanou cestu včetně
   * sekce ('web-settings.load_error_message'). Přidán lokální override doplňující
   * prefix 'web-settings.' automaticky.
   */
  public override t(key: string): string {
    return this.i18n.getValue(`web-settings.${key}`);
  }
  languages: LangMeta[] = [];
  currentLang: string = 'cz';

  /** Active page tab: company details (default) or browser tab titles per page. */
  activeTab: 'company' | 'page_titles' = 'company';

  // ── Page titles tab state (see section "PAGE TITLES") ─────────────
  /** Google shows roughly this many characters, longer titles get cut. */
  readonly PT_RECOMMENDED_LENGTH = 60;
  /** Hard limit, same as backend validation (PageTitleController::MAX_LENGTH). */
  readonly PT_MAX_LENGTH = 120;
  ptRows: PageTitleRow[] = [];
  ptAreas: PageTitleArea[] = [];
  ptActiveArea: PageTitleArea = 'web';
  ptLanguages: Record<PageTitleArea, PageTitleLang[]> = { web: [], shop: [], admin: [] };
  ptCurrentLang: Record<PageTitleArea, string> = { web: 'cz', shop: 'cz', admin: 'cz' };
  ptLoaded    = false;
  ptLoading   = false;
  ptSaving    = false;
  ptLoadError = false;
  /** Row shown in the browser-tab preview (last focused input). */
  ptPreviewRowId: number | null = null;
  /** Original JSON of every row's title_i18n – base for dirty detection. */
  private ptSnapshot = new Map<number, string>();

  settings: SiteSetting = {
    company_name: '', ico: '', dic: '',
    google_analytics_id: null,
    contact_email: '', contact_phone: '',
    address: '', footer_text: '',
    logo_path: null,
    brand_tagline: '', brand_tagline_i18n: {},
    copyright_text: '', copyright_text_i18n: {},
  };

  settingsLoading = true;
  settingsSaving  = false;
  settingsSaved   = false;

  logoFile: File | null       = null;
  logoPreview: string | null  = null; 
  logoRemoving                = false;

  socialLinks: SocialLink[] = [];
  socialLoading = true;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router,
    private confirmDialog: ConfirmDialogService
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    this.initWithAuthCheck(this.router);
    this.loadLanguages();
  }

  private loadLanguages(): void {
    this.resourceCache.get(
      `web-settings:languages:${this.LANG_MODULE}`,
      () => this.dataHandler.get<{ languages: LangMeta[] }>(`languages/${this.LANG_MODULE}`),
      this.LANG_TTL_MS
    ).subscribe({
      next: (res) => {
        this.languages = (res?.languages ?? []).filter(l => l.active !== false);

        if (this.languages.length > 0 && !this.languages.find(l => l.code === this.currentLang)) {
          this.currentLang = this.languages[0].code;
        }

        this.loadAll();
      },
      error: () => {
        this.languages = [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }];
        this.loadAll();
      }
    });
  }

  /**
   * @description Switches the page tab. Page titles load lazily on first open;
   * unsaved page title edits are kept (state lives in this component).
   */
  switchTab(tab: 'company' | 'page_titles'): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    if (tab === 'page_titles' && !this.ptLoaded && !this.ptLoading) this.ptLoad();
    this.cd.markForCheck();
  }

  switchLang(code: string): void {
    if (this.currentLang === code) return;
    this.currentLang = code;
    this.cd.markForCheck();
  }

  getLangName(code: string): string {
    return this.languages.find(l => l.code === code)?.name ?? code.toUpperCase();
  }

  private ensureI18nDefaults(): void {
    if (!this.settings.brand_tagline_i18n)  this.settings.brand_tagline_i18n  = {};
    if (!this.settings.copyright_text_i18n) this.settings.copyright_text_i18n = {};

    for (const lang of this.languages) {
      if (this.settings.brand_tagline_i18n[lang.code] === undefined) {
        this.settings.brand_tagline_i18n[lang.code] = (lang.code === 'cz')
          ? (this.settings.brand_tagline ?? '')
          : '';
      }
      if (this.settings.copyright_text_i18n[lang.code] === undefined) {
        this.settings.copyright_text_i18n[lang.code] = (lang.code === 'cz')
          ? (this.settings.copyright_text ?? '')
          : '';
      }
    }
  }

  private loadAll(): void {
    this.settingsLoading = true;
    this.socialLoading   = true;
    this.cd.markForCheck();

    this.resourceCache.get(
      this.SETTINGS_CACHE_KEY,
      () => this.dataHandler.get<any>('legal/config'),
      this.SETTINGS_TTL_MS
    ).subscribe({
      next: (res) => {
        if (res.settings) {
          this.settings = {
            ...this.settings,
            ...res.settings,
            brand_tagline_i18n:  res.settings.brand_tagline_i18n  ?? {},
            copyright_text_i18n: res.settings.copyright_text_i18n ?? {},
          };
        }
        this.ensureI18nDefaults();

        this.socialLinks = (res.social_links ?? []).map((s: any) => ({
          id:           s.id,
          name:         s.name,
          url:          s.url,
          icon_path:    s.icon_path ?? '',
          position:     s.position  ?? 0,
          _iconFile:    null,
          _iconPreview: null,
          _saving:      false,
          _isNew:       false,
          _dirty:       false,
        }));

        this.settingsLoading = false;
        this.socialLoading   = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.settingsLoading = false;
        this.socialLoading   = false;
        this.errorMessage    = this.t('load_error_message');
        this.cd.markForCheck();
      }
    });
  }

  override refreshData(): void {
    this.resourceCache.invalidate(this.SETTINGS_CACHE_KEY);
    this.loadAll();
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.alertDialogService.open(this.t('logo_too_large_title'), this.t('logo_too_large_message'), 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.alertDialogService.open(this.t('logo_invalid_format_title'), this.t('logo_invalid_format_message'), 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }

    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoFile    = file;
    this.logoPreview = URL.createObjectURL(file);
    this.cd.markForCheck();
  }

  cancelLogoSelection(): void {
    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoFile    = null;
    this.logoPreview = null;
    this.cd.markForCheck();
  }

  saveSettings(): void {
    if (this.settingsSaving) return;
    this.settingsSaving = true;
    this.settingsSaved  = false;

    if (this.logoFile) {
      const fd = new FormData();
      fd.append('company_name',  this.settings.company_name  ?? '');
      fd.append('brand_tagline_i18n',  JSON.stringify(this.settings.brand_tagline_i18n  ?? {}));
      fd.append('copyright_text_i18n', JSON.stringify(this.settings.copyright_text_i18n ?? {}));
      fd.append('ico',           this.settings.ico           ?? '');
      fd.append('dic',           this.settings.dic           ?? '');
      fd.append('google_analytics_id', this.settings.google_analytics_id ?? '');
      fd.append('contact_email', this.settings.contact_email ?? '');
      fd.append('contact_phone', this.settings.contact_phone ?? '');
      fd.append('address',       this.settings.address       ?? '');
      fd.append('footer_text',   this.settings.footer_text   ?? '');
      fd.append('logo_file',     this.logoFile, this.logoFile.name);
      fd.append('_method', 'PUT');

      this.dataHandler.upload<SiteSetting>('legal/config/settings', fd).subscribe({
        next: (res: any) => this.onSettingsSaved(res),
        error: () => this.onSettingsError(),
      });
    } else {
      const payload = {
        company_name:         this.settings.company_name,
        brand_tagline_i18n:   this.settings.brand_tagline_i18n  ?? {},
        copyright_text_i18n:  this.settings.copyright_text_i18n ?? {},
        ico:                  this.settings.ico,
        dic:                  this.settings.dic,
        google_analytics_id:  this.settings.google_analytics_id || null,
        contact_email:        this.settings.contact_email,
        contact_phone:        this.settings.contact_phone,
        address:              this.settings.address,
        footer_text:          this.settings.footer_text,
      };

      this.dataHandler.put<SiteSetting>('legal/config/settings', payload as any).subscribe({
        next: (res: any) => this.onSettingsSaved(res),
        error: () => this.onSettingsError(),
      });
    }
  }

  private onSettingsSaved(res: any): void {
    if (res) {
      this.settings = {
        ...this.settings,
        ...res,
        brand_tagline_i18n:  res.brand_tagline_i18n  ?? {},
        copyright_text_i18n: res.copyright_text_i18n ?? {},
      };
      this.ensureI18nDefaults();
    }

    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoFile    = null;
    this.logoPreview = null;

    this.settingsSaving = false;
    this.settingsSaved  = true;

    this.alertDialogService.open(this.t('save_success_title'), this.t('save_success_message'), 'success');
    setTimeout(() => { this.settingsSaved = false; this.cd.markForCheck(); }, 2500);

    this.resourceCache.invalidate(this.SETTINGS_CACHE_KEY);
    this.loadAll();
  }

  /**
   * @description Cleanup po neúspěšném uložení nastavení - toast už zobrazil
   * `DataHandler.handleError()`.
   */
  private onSettingsError(): void {
    this.settingsSaving = false;
    this.cd.markForCheck();
  }

  get logoSrc(): string | null {
    if (this.logoPreview)        return this.logoPreview;
    if (this.settings.logo_path) return environment.public_storage_url+`/${this.settings.logo_path}`;
    return null;
  }

  get hasLogo(): boolean {
    return !!(this.logoPreview || this.settings.logo_path);
  }

  addSocialLink(): void {
    this.socialLinks = [...this.socialLinks, {
      name: '', url: '', icon_path: '',
      position:     this.socialLinks.length + 1,
      _iconFile:    null,
      _iconPreview: null,
      _saving:      false,
      _isNew:       true,
      _dirty:       true,
    }];
    this.cd.markForCheck();

    setTimeout(() => {
      document.getElementById('social-add-anchor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  onIconSelected(event: Event, index: number): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.alertDialogService.open(this.t('logo_too_large_title'), this.t('social_icon_too_large_message'), 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.alertDialogService.open(this.t('logo_invalid_format_title'), this.t('social_icon_invalid_format_message'), 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    const updated = [...this.socialLinks];
    if (updated[index]._iconPreview) URL.revokeObjectURL(updated[index]._iconPreview!);
    updated[index] = {
      ...updated[index],
      _iconFile:    file,
      _iconPreview: URL.createObjectURL(file),
      _dirty:       true,
    };
    this.socialLinks = updated;
    this.cd.markForCheck();
  }

  saveSocialLink(index: number): void {
    const link = this.socialLinks[index];
    if (link._saving) return;

    if (!link.name?.trim()) {
      this.alertDialogService.open(this.t('social_validation_title'), this.t('social_validation_name_message'), 'warning');
      return;
    }
    if (!link.url?.trim()) {
      this.alertDialogService.open(this.t('social_validation_title'), this.t('social_validation_url_message'), 'warning');
      return;
    }

    const withSaving = [...this.socialLinks];
    withSaving[index] = { ...withSaving[index], _saving: true };
    this.socialLinks = withSaving;
    this.cd.markForCheck();

    const onSuccess = () => {
      this.alertDialogService.open(this.t('save_success_title'), this.t('social_saved_message').replace('{name}', link.name), 'success');
      this.resourceCache.invalidate(this.SETTINGS_CACHE_KEY);
      this.loadAll();
    };
    const onError = () => {
      const failed = [...this.socialLinks];
      failed[index] = { ...failed[index], _saving: false };
      this.socialLinks = failed;
      this.cd.markForCheck();
    };

    if (link._isNew || link._iconFile) {
  const fd = new FormData();
  fd.append('name',     link.name.trim());
  fd.append('url',      link.url.trim());
  fd.append('position', String(link.position));
  if (link._iconFile) fd.append('icon_file', link._iconFile, link._iconFile.name);

  const endpoint = link._isNew
    ? 'legal/config/social'
    : `legal/config/social/${link.id}`;

  const request$ = link._isNew
    ? this.dataHandler.upload<SocialLink>(endpoint, fd)
    : this.dataHandler.uploadPut<SocialLink>(endpoint, fd);

  request$.subscribe({ next: onSuccess, error: onError });
} else {
  this.dataHandler.put<SocialLink>(`legal/config/social/${link.id}`, {
    name:      link.name.trim(),
    url:       link.url.trim(),
    position:  link.position,
    icon_path: link.icon_path,
  } as any).subscribe({ next: onSuccess, error: onError });
}
  }

  async deleteSocialLink(index: number): Promise<void> {
    const link = this.socialLinks[index];

    if (link._isNew) {
      if (link._iconPreview) URL.revokeObjectURL(link._iconPreview);
      this.socialLinks = this.socialLinks.filter((_, i) => i !== index);
      this.cd.markForCheck();
      return;
    }

    const confirmed = await this.confirmDialog.open(
      this.t('social_delete_confirm_title'),
      this.t('social_delete_confirm_message').replace('{name}', link.name)
    );
    if (!confirmed) return;

    this.dataHandler.delete(`legal/config/social/${link.id}`).subscribe({
      next: () => {
        if (link._iconPreview) URL.revokeObjectURL(link._iconPreview);
        this.alertDialogService.open(this.t('social_deleted_title'), this.t('social_deleted_message').replace('{name}', link.name), 'success');
        this.resourceCache.invalidate(this.SETTINGS_CACHE_KEY);
        this.loadAll();
      }
    });
  }

  markDirty(index: number): void {
    if (!this.socialLinks[index]?._dirty) {
      const updated = [...this.socialLinks];
      updated[index] = { ...updated[index], _dirty: true };
      this.socialLinks = updated;
    }
  }

  iconSrc(link: SocialLink): string | null {
    if (link._iconPreview) return link._iconPreview;
    if (link.icon_path)    return environment.public_storage_url+`/${link.icon_path}`;
    return null;
  }

  trackByIndex(index: number): number { return index; }

  // ═══════════════════════════════════════════════════════════════
  // PAGE TITLES – browser <title> per public page (tab "page_titles")
  // ═══════════════════════════════════════════════════════════════

  /** @description Loads web + shop languages and all page titles in parallel. */
  private ptLoad(): void {
    this.ptLoading   = true;
    this.ptLoadError = false;
    this.cd.markForCheck();

    forkJoin({
      web:  this.ptLoadLanguages('web'),
      shop: this.ptLoadLanguages('shop'),
      data: this.dataHandler.get<PageTitlesResponse>('legal/config/page-titles'),
    }).subscribe({
      next: ({ web, shop, data }) => {
        const fallback: PageTitleLang[] = [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }];
        this.ptLanguages = {
          web:   web.length  ? web  : fallback,
          shop:  shop.length ? shop : (web.length ? web : fallback),
          admin: web.length  ? web  : fallback,
        };
        for (const area of ['web', 'shop', 'admin'] as PageTitleArea[]) {
          const langs = this.ptLanguages[area];
          if (!langs.find(l => l.code === this.ptCurrentLang[area])) {
            this.ptCurrentLang[area] = langs[0].code;
          }
        }
        this.ptSetRows((data as any)?.page_titles ?? []);
        this.ptLoaded  = true;
        this.ptLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.ptLoading   = false;
        this.ptLoadError = true;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Active languages of one public module, cached with the same key/TTL
   * as loadLanguages(). Failure = empty list (caller falls back to web languages).
   */
  private ptLoadLanguages(module: 'web' | 'shop'): Observable<PageTitleLang[]> {
    return this.resourceCache.get(
      `web-settings:languages:${module}`,
      () => this.dataHandler.get<{ languages: PageTitleLang[] }>(`languages/${module}`),
      this.LANG_TTL_MS
    ).pipe(
      map((res: any) => ((res?.languages ?? []) as PageTitleLang[]).filter(l => l.active !== false)),
      catchError(() => of([] as PageTitleLang[]))
    );
  }

  /** @description Stores rows, fills missing languages with '' and snapshots them. */
  private ptSetRows(rows: PageTitleRow[]): void {
    this.ptRows = rows.map(r => {
      const titles: Record<string, string> = { ...(r.title_i18n ?? {}) };
      for (const lang of this.ptLanguages[r.area] ?? []) {
        if (typeof titles[lang.code] !== 'string') titles[lang.code] = '';
      }
      return { ...r, title_i18n: titles };
    });

    this.ptSnapshot.clear();
    for (const r of this.ptRows) this.ptSnapshot.set(r.id, JSON.stringify(r.title_i18n));

    this.ptAreas = (['web', 'shop', 'admin'] as PageTitleArea[]).filter(a => this.ptRows.some(r => r.area === a));
    if (!this.ptAreas.includes(this.ptActiveArea) && this.ptAreas.length) this.ptActiveArea = this.ptAreas[0];
    this.ptPreviewRowId = null;
  }

  /** Tab label of an area (Web / E-shop / Administrace). */
  ptAreaLabel(area: PageTitleArea): string {
    const key = area === 'web' ? 'pt_area_web' : area === 'shop' ? 'pt_area_shop' : 'pt_area_admin';
    return this.strings?.[key] || area;
  }

  get ptCanUpdate(): boolean {
    return this.hasAnyPermission('core-legal-config-update');
  }

  get ptVisibleRows(): PageTitleRow[] {
    return this.ptRows.filter(r => r.area === this.ptActiveArea);
  }

  get ptActiveLanguages(): PageTitleLang[] {
    return this.ptLanguages[this.ptActiveArea] ?? [];
  }

  get ptLang(): string {
    return this.ptCurrentLang[this.ptActiveArea];
  }

  get ptDirtyCount(): number {
    return this.ptRows.filter(r => this.ptIsRowDirty(r)).length;
  }

  get ptIsDirty(): boolean {
    return this.ptDirtyCount > 0;
  }

  /** "Unsaved changes: 3" badge text. */
  get ptUnsavedLabel(): string {
    return (this.strings?.pt_unsaved_count ?? '').replace('{count}', String(this.ptDirtyCount));
  }

  /** Tab preview text: last focused row, otherwise the first visible one. */
  get ptPreviewText(): string {
    const rows = this.ptVisibleRows;
    const row  = rows.find(r => r.id === this.ptPreviewRowId) ?? rows[0];
    const text = row?.title_i18n[this.ptLang]?.trim();
    return text || this.strings?.pt_preview_empty || '';
  }

  /** Human page name from translations ('pt_page_web_about_us'), fallback = URL. */
  ptLabelFor(row: PageTitleRow): string {
    const value = this.strings?.[`pt_page_${row.area}_${row.page_key.replace(/-/g, '_')}`];
    return typeof value === 'string' && value ? value : row.route_path;
  }

  ptPlaceholderFor(): string {
    const name = this.ptActiveLanguages.find(l => l.code === this.ptLang)?.name ?? this.ptLang.toUpperCase();
    return (this.strings?.pt_input_placeholder ?? '').replace('{lang}', name);
  }

  ptLengthOf(row: PageTitleRow): number {
    return (row.title_i18n[this.ptLang] ?? '').length;
  }

  ptIsRowDirty(row: PageTitleRow): boolean {
    return JSON.stringify(row.title_i18n) !== this.ptSnapshot.get(row.id);
  }

  ptAreaDirty(area: PageTitleArea): boolean {
    return this.ptRows.some(r => r.area === area && this.ptIsRowDirty(r));
  }

  ptSwitchArea(area: PageTitleArea): void {
    if (this.ptActiveArea === area) return;
    this.ptActiveArea = area;
    this.ptPreviewRowId = null;
    this.cd.markForCheck();
  }

  ptSwitchLang(code: string): void {
    this.ptCurrentLang = { ...this.ptCurrentLang, [this.ptActiveArea]: code };
    this.cd.markForCheck();
  }

  ptOnFocus(row: PageTitleRow): void {
    this.ptPreviewRowId = row.id;
    this.cd.markForCheck();
  }

  ptOnInput(row: PageTitleRow): void {
    this.ptPreviewRowId = row.id;
    this.cd.markForCheck();
  }

  /** @description Reverts all unsaved page title edits to the last loaded state. */
  ptDiscard(): void {
    this.ptRows = this.ptRows.map(r => ({ ...r, title_i18n: JSON.parse(this.ptSnapshot.get(r.id) ?? '{}') }));
    this.cd.markForCheck();
  }

  /** @description Sends only changed rows; the API returns the fresh full list. */
  ptSave(): void {
    if (!this.ptCanUpdate || this.ptSaving || !this.ptIsDirty) return;

    const payload: PageTitlesUpdatePayload = {
      titles: this.ptRows
        .filter(r => this.ptIsRowDirty(r))
        .map(r => ({ id: r.id, title_i18n: r.title_i18n })),
    };

    this.ptSaving = true;
    this.cd.markForCheck();

    this.dataHandler.put<PageTitlesResponse>('legal/config/page-titles', payload as any).subscribe({
      next: (res: any) => {
        this.ptSetRows(res?.page_titles ?? this.ptRows);
        this.ptSaving = false;
        this.alertDialogService.open(this.t('save_success_title'), this.t('pt_saved_message'), 'success');
        this.cd.markForCheck();
      },
      error: () => {
        // Toast already shown by DataHandler.handleError().
        this.ptSaving = false;
        this.cd.markForCheck();
      }
    });
  }
}