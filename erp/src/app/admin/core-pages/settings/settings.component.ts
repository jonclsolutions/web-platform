/**
 * @file settings.component.ts
 * @path src/app/admin/core-pages/settings/settings.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manages global web configuration including company details, localized brand assets, site branding, and social media links;
 * the "Page titles" tab hosts PageTitlesEditorComponent with the browser title of the administration
 * (the web / e-shop titles: web/edit-website, shop/edit-eshop), the "Data retention" tab
 * RetentionSettingsComponent (GDPR retention periods, VT-10).
 * @dependencies
 * - BaseDataComponent: Provides base CRUD and state management.
 * - ConfirmDialogService: Orchestrates user confirmation for destructive actions (e.g., deleting social links).
 * - ResourceCacheService: TTL cache of the languages (10 min) / settings (2 min) fetch.
 * @note After EVERY successful mutation the cache key `settings:all` is invalidated
 * explicitly BEFORE `loadAll()` is called.
 */

import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StickyBarDirective } from '../../../shared/directives/sticky-bar.directive';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { environment } from '../../../../environments/environment';
import { CompanyOptionalField, LangMeta, SiteSetting, SocialLink } from './'
import { RetentionSettingsComponent } from './retention-settings/retention-settings.component';
import { PageTitlesEditorComponent } from '../../components/page-titles-editor/page-titles-editor.component';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RetentionSettingsComponent, PageTitlesEditorComponent, PageHelpComponent, StickyBarDirective],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent extends BaseDataComponent<any> implements OnInit {
  override apiEndpoint = 'legal/config';
  /** One settings object (no paginated list) - loaded by `loadAll()` / `refreshData()`. */
  override usesPaginatedList = false;
  protected override translationSection: string = 'settings';

  private readonly LANG_TTL_MS = 10 * 60 * 1000;
  private readonly SETTINGS_TTL_MS = 2 * 60 * 1000;
  private readonly SETTINGS_CACHE_KEY = 'settings:all';

  private resourceCache = inject(ResourceCacheService);

  public override t(key: string): string {
    return this.i18n.getValue(`settings.${key}`);
  }
  languages: LangMeta[] = [];
  currentLang: string = 'cz';

  /** Active page tab: company details (default), browser tab titles per page or data retention. */
  activeTab: 'company' | 'page_titles' | 'retention' = 'company';

  /**
   * Unsaved edits in the page titles tab (PageTitlesEditorComponent, area 'admin' - the web /
   * e-shop titles are managed by web/edit-website and shop/edit-eshop) - dot on the tab.
   */
  ptIsDirty = false;
  /** The page titles tab was opened - its editor stays created (hidden) from then on. */
  ptOpened = false;

  settings: SiteSetting = {
    company_name: '', ico: '', dic: '',
    google_analytics_id: null,
    contact_email: '', contact_phone: '',
    address: '', footer_text: '',
    logo_path: null,
    brand_tagline: '', brand_tagline_i18n: {},
    copyright_text: '', copyright_text_i18n: {},
    hidden_fields: [],
  };

  /** Label key (strings.field_*) of every optional field - order of the validation message. */
  private readonly optionalFieldLabels: Record<CompanyOptionalField, string> = {
    brand_tagline: 'field_brand_tagline',
    copyright_text: 'field_copyright_text',
    ico: 'field_ico',
    dic: 'field_dic',
    google_analytics_id: 'field_ga_label',
    contact_phone: 'field_phone',
    address: 'field_address',
    footer_text: 'field_footer_text',
  };

  settingsLoading = true;
  settingsSaving  = false;
  settingsSaved   = false;

  logoFile: File | null       = null;
  logoPreview: string | null  = null; 

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
      'settings:languages',
      () => this.dataHandler.get<LangMeta[]>('languages'),
      this.LANG_TTL_MS
    ).subscribe({
      next: (res) => {
        this.languages = (Array.isArray(res) ? res : []).filter(l => l.active !== false);

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
   * @description Switches the page tab. The page titles editor is created (and loads) on the
   * first open and only hidden afterwards - unsaved edits are kept.
   */
  switchTab(tab: 'company' | 'page_titles' | 'retention'): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    if (tab === 'page_titles') this.ptOpened = true;
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

  /**
   * @description Whether an optional field is switched on (shown on the public pages).
   * @param field Optional field key.
   * @returns True unless the field is in `settings.hidden_fields`.
   */
  isFieldOn(field: CompanyOptionalField): boolean {
    return !(this.settings.hidden_fields ?? []).includes(field);
  }

  /**
   * @description Switches an optional field on / off (checkbox next to its label).
   * @param field Optional field key.
   * @param on New state of the checkbox.
   */
  setFieldOn(field: CompanyOptionalField, on: boolean): void {
    const hidden = (this.settings.hidden_fields ?? []).filter(f => f !== field);
    this.settings = { ...this.settings, hidden_fields: on ? hidden : [...hidden, field] };
    this.cd.markForCheck();
  }

  /**
   * @description Labels of the required fields that are empty: company name, contact e-mail and
   *   every switched-on optional field (an i18n field needs a text in at least one language).
   * @returns Labels without the "*" mark; empty when everything is filled in.
   */
  missingFieldLabels(): string[] {
    const filled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';
    const anyText = (map: Record<string, string> | undefined): boolean => Object.values(map ?? {}).some(filled);
    const label = (key: string): string => (this.strings[key] ?? key).replace(/\s*\*$/, '');

    const missing: string[] = [];
    if (!filled(this.settings.company_name))  missing.push(label('field_company_name'));
    if (!filled(this.settings.contact_email)) missing.push(label('field_email'));

    for (const [field, labelKey] of Object.entries(this.optionalFieldLabels) as [CompanyOptionalField, string][]) {
      if (!this.isFieldOn(field)) continue;
      const ok = field === 'brand_tagline'  ? anyText(this.settings.brand_tagline_i18n)
               : field === 'copyright_text' ? anyText(this.settings.copyright_text_i18n)
               : filled(this.settings[field]);
      if (!ok) missing.push(label(labelKey));
    }
    return missing;
  }

  saveSettings(): void {
    if (this.settingsSaving) return;

    const missing = this.missingFieldLabels();
    if (missing.length) {
      this.alertDialogService.open(
        this.t('validation_required_title'),
        this.t('validation_required_message').replace('{fields}', missing.join(', ')),
        'warning'
      );
      return;
    }

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
      fd.append('hidden_fields', JSON.stringify(this.settings.hidden_fields ?? []));
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
        hidden_fields:        this.settings.hidden_fields ?? [],
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
   * @description Clean-up after a failed settings save - the toast was already shown by
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

  iconSrc(link: SocialLink): string | null {
    if (link._iconPreview) return link._iconPreview;
    if (link.icon_path)    return environment.public_storage_url+`/${link.icon_path}`;
    return null;
  }

  trackByIndex(index: number): number { return index; }
}
