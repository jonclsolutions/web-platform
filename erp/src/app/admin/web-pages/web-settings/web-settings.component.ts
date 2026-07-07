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
 * - CommonModule/FormsModule: Standard Angular modules for structural directives and two-way data binding.
 */

import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { environment } from '../../../../environments/environment';

/** Metadata of supported languages — corresponds to the API response from languages/{module} */
interface LangMeta {
  code: string;
  name: string;
  iconUrl?: string | null;
  active: boolean;
  isBuiltIn?: boolean;
}

/** Internationalized string map: { "cz": "...", "en": "...", "sk": "..." } */
type I18nMap = Record<string, string>;

/** Structure representing the global site settings */
interface SiteSetting {
  id?: number;
  company_name: string;
  brand_tagline: string;
  brand_tagline_i18n: I18nMap;
  copyright_text: string;
  copyright_text_i18n: I18nMap;
  ico: string;
  dic: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  footer_text: string;
  logo_path?: string | null;
}

/** Structure representing a social network reference */
interface SocialLink {
  id?: number;
  name: string;
  url: string;
  icon_path: string;
  position: number;
  _iconFile?: File | null;
  _iconPreview?: string | null;
  _saving?: boolean;
  _isNew?: boolean;
  _dirty?: boolean;
}

/**
 * @description Component for managing site-wide configuration.
 * @usage Provides an interface to update company profile, localized site text, branding (logo), and a dynamic list of social links.
 * @note Implements lazy loading of languages to ensure localized fields are correctly initialized for two-way binding.
 */
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

  private readonly LANG_MODULE = 'web';

  languages: LangMeta[] = [];
  currentLang: string = 'cz';

  settings: SiteSetting = {
    company_name: '', ico: '', dic: '',
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

  /**
   * @description Fetches available active languages for the module to enable localization support.
   */
  private loadLanguages(): void {
    this.dataHandler.get<{ languages: LangMeta[] }>(`languages/${this.LANG_MODULE}`).subscribe({
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
   * @description Updates the currently active language code for localized fields.
   * @param code The target language code.
   */
  switchLang(code: string): void {
    if (this.currentLang === code) return;
    this.currentLang = code;
    this.cd.markForCheck();
  }

  /**
   * @description Resolves the display name for a specific language code.
   * @param code The language identifier.
   * @returns The human-readable name of the language or the uppercase code as a fallback.
   */
  getLangName(code: string): string {
    return this.languages.find(l => l.code === code)?.name ?? code.toUpperCase();
  }

  /**
   * @description Populates missing translation keys to avoid runtime binding errors in the template.
   * @note Ensures every configured language has an entry in the i18n maps.
   */
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

  /**
   * @description Synchronizes all site settings and social links from the server.
   */
  private loadAll(): void {
    this.settingsLoading = true;
    this.socialLoading   = true;
    this.cd.markForCheck();

    this.dataHandler.get<any>('legal/config').subscribe({
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
        this.errorMessage    = 'Nepodařilo se načíst nastavení.';
        this.cd.markForCheck();
      }
    });
  }

  override refreshData(): void { this.loadAll(); }

  /**
   * @description Handles local selection and validation of a new logo file.
   * @param event The file input change event.
   */
  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.alertDialogService.open('Příliš velký soubor', 'Logo může mít maximálně 2 MB.', 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.alertDialogService.open('Neplatný formát', 'Vyberte obrázek (JPG, PNG, SVG…).', 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }

    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoFile    = file;
    this.logoPreview = URL.createObjectURL(file);
    this.cd.markForCheck();
  }

  /**
   * @description Discards the locally selected logo file and its temporary preview.
   */
  cancelLogoSelection(): void {
    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoFile    = null;
    this.logoPreview = null;
    this.cd.markForCheck();
  }

  /**
   * @description Saves company settings. Uses FormData if a logo file is present for multi-part upload, otherwise uses JSON.
   */
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
      fd.append('contact_email', this.settings.contact_email ?? '');
      fd.append('contact_phone', this.settings.contact_phone ?? '');
      fd.append('address',       this.settings.address       ?? '');
      fd.append('footer_text',   this.settings.footer_text   ?? '');
      fd.append('logo_file',     this.logoFile, this.logoFile.name);
      fd.append('_method', 'PUT');

      this.dataHandler.upload<SiteSetting>('legal/config/settings', fd).subscribe({
        next: (res: any) => this.onSettingsSaved(res),
        error: (err: any) => this.onSettingsError(err),
      });
    } else {
      const payload = {
        company_name:         this.settings.company_name,
        brand_tagline_i18n:   this.settings.brand_tagline_i18n  ?? {},
        copyright_text_i18n:  this.settings.copyright_text_i18n ?? {},
        ico:                  this.settings.ico,
        dic:                  this.settings.dic,
        contact_email:        this.settings.contact_email,
        contact_phone:        this.settings.contact_phone,
        address:              this.settings.address,
        footer_text:          this.settings.footer_text,
      };

      this.dataHandler.put<SiteSetting>('legal/config/settings', payload as any).subscribe({
        next: (res: any) => this.onSettingsSaved(res),
        error: (err: any) => this.onSettingsError(err),
      });
    }
  }

  /**
   * @description Handles successful settings save and cleanup of local file states.
   * @param res The updated settings returned by the server.
   */
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

    this.alertDialogService.open('Uloženo', 'Firemní údaje byly úspěšně uloženy.', 'success');
    setTimeout(() => { this.settingsSaved = false; this.cd.markForCheck(); }, 2500);

    this.loadAll();
  }

  /**
   * @description Parses and notifies the user of server-side validation or processing errors.
   * @param err The error response object.
   */
  private onSettingsError(err: any): void {
    this.settingsSaving = false;
    const msg = err?.error?.message ?? err?.error?.errors
      ? Object.values(err.error.errors).flat().join(', ')
      : 'Uložení selhalo.';
    this.alertDialogService.open('Chyba', String(msg), 'danger');
    this.cd.markForCheck();
  }

  /**
   * @description Resolves the URI for the current logo; falls back to default if no file is selected.
   */
  get logoSrc(): string | null {
    if (this.logoPreview)        return this.logoPreview;
    if (this.settings.logo_path) return environment.public_storage_url+`/${this.settings.logo_path}`;
    return null;
  }

  /**
   * @description Checks if a logo currently exists (either locally selected or saved).
   */
  get hasLogo(): boolean {
    return !!(this.logoPreview || this.settings.logo_path);
  }

  /**
   * @description Appends a new empty row to the social links list to allow user entry.
   */
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

  /**
   * @description Validates and processes a new icon file for a specific social link row.
   * @param event The input event.
   * @param index The index of the link within the list.
   */
  onIconSelected(event: Event, index: number): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.alertDialogService.open('Příliš velký soubor', 'Ikonka může mít maximálně 2 MB.', 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.alertDialogService.open('Neplatný formát', 'Vyberte obrázek.', 'warning');
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

  /**
   * @description Submits a single social link row update or creation to the server.
   * @param index The index of the row to save.
   */
  saveSocialLink(index: number): void {
    const link = this.socialLinks[index];
    if (link._saving) return;

    if (!link.name?.trim()) {
      this.alertDialogService.open('Validace', 'Zadejte název sociální sítě.', 'warning');
      return;
    }
    if (!link.url?.trim()) {
      this.alertDialogService.open('Validace', 'Zadejte URL odkazu.', 'warning');
      return;
    }

    const withSaving = [...this.socialLinks];
    withSaving[index] = { ...withSaving[index], _saving: true };
    this.socialLinks = withSaving;
    this.cd.markForCheck();

    const onSuccess = () => {
      this.alertDialogService.open('Uloženo', `Odkaz „${link.name}" byl uložen.`, 'success');
      this.loadAll();
    };
    const onError = (err: any) => {
      const msg = err?.error?.message ?? 'Uložení selhalo.';
      this.alertDialogService.open('Chyba', msg, 'danger');
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

      this.dataHandler.upload<SocialLink>(endpoint, fd)
        .subscribe({ next: onSuccess, error: onError });
    } else {
      this.dataHandler.put<SocialLink>(`legal/config/social/${link.id}`, {
        name:      link.name.trim(),
        url:       link.url.trim(),
        position:  link.position,
        icon_path: link.icon_path,
      } as any).subscribe({ next: onSuccess, error: onError });
    }
  }

  /**
   * @description Requests confirmation and deletes a social network link from the server.
   * @param index The index of the row to delete.
   */
  async deleteSocialLink(index: number): Promise<void> {
    const link = this.socialLinks[index];

    if (link._isNew) {
      if (link._iconPreview) URL.revokeObjectURL(link._iconPreview);
      this.socialLinks = this.socialLinks.filter((_, i) => i !== index);
      this.cd.markForCheck();
      return;
    }

    const confirmed = await this.confirmDialog.open(
      'Smazat odkaz',
      `Opravdu chcete smazat odkaz „${link.name}"? Bude smazána i ikonka.`
    );
    if (!confirmed) return;

    this.dataHandler.delete(`legal/config/social/${link.id}`).subscribe({
      next: () => {
        if (link._iconPreview) URL.revokeObjectURL(link._iconPreview);
        this.alertDialogService.open('Smazáno', `Odkaz „${link.name}" byl smazán.`, 'success');
        this.loadAll();
      },
      error: (err: any) =>
        this.alertDialogService.open('Chyba', err?.error?.message ?? 'Smazání selhalo.', 'danger')
    });
  }

  /**
   * @description Marks a social link row as modified.
   * @param index The row index.
   */
  markDirty(index: number): void {
    if (!this.socialLinks[index]?._dirty) {
      const updated = [...this.socialLinks];
      updated[index] = { ...updated[index], _dirty: true };
      this.socialLinks = updated;
    }
  }

  /**
   * @description Resolves the URI for a social link icon.
   * @param link The social link object.
   * @returns The resolved icon URL or null if undefined.
   */
  iconSrc(link: SocialLink): string | null {
    if (link._iconPreview) return link._iconPreview;
    if (link.icon_path)    return environment.public_storage_url+`/${link.icon_path}`;
    return null;
  }

  /**
   * @description Tracks row rendering by index for optimal performance.
   * @param index Row index.
   * @returns The index.
   */
  trackByIndex(index: number): number { return index; }
}