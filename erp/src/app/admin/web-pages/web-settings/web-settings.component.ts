import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

interface SiteSetting {
  id?: number;
  company_name: string;
  brand_tagline: string;
  copyright_text: string;
  ico: string;
  dic: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  footer_text: string;
  logo_path?: string | null;
}

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

  // ---- Firemní nastavení ----
  settings: SiteSetting = {
    company_name: '', ico: '', dic: '',
    contact_email: '', contact_phone: '',
    address: '', footer_text: '',
    logo_path: null,brand_tagline: '', copyright_text: ''
  };
  settingsLoading = true;
  settingsSaving  = false;
  settingsSaved   = false;

  // ---- Logo ----
  logoFile: File | null       = null;
  logoPreview: string | null  = null;  // Blob URL pro okamžitý náhled
  logoRemoving                = false; // Příznak mazání loga

  // ---- Sociální sítě ----
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
    this.loadAll();
  }

  // ============================================================
  // NAČTENÍ  —  GET /api/legal/config
  // ============================================================
  private loadAll(): void {
    this.settingsLoading = true;
    this.socialLoading   = true;
    this.cd.markForCheck();

    this.dataHandler.get<any>('legal/config').subscribe({
      next: (res) => {
        if (res.settings) {
          this.settings = { ...res.settings };
        }
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
        // Reset loga po novém načtení (blob preview zůstane dokud nerefreshneme)
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

  // ============================================================
  // LOGO — výběr souboru
  // ============================================================
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

    // Uvolnit starý blob URL
    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);

    this.logoFile    = file;
    this.logoPreview = URL.createObjectURL(file);
    this.cd.markForCheck();
  }

  // Zrušit výběr nového loga (bez uložení)
  cancelLogoSelection(): void {
    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoFile    = null;
    this.logoPreview = null;
    this.cd.markForCheck();
  }

  // ============================================================
  // FIREMNÍ ÚDAJE + LOGO  —  PUT/POST /api/legal/config/settings
  // Pokud je nové logo, posíláme FormData; jinak čistý JSON.
  // ============================================================
  saveSettings(): void {
    if (this.settingsSaving) return;
    this.settingsSaving = true;
    this.settingsSaved  = false;

    if (this.logoFile) {
      // ---- Verze s logem (FormData) ----
      const fd = new FormData();
      fd.append('company_name',  this.settings.company_name  ?? '');
      fd.append('brand_tagline', this.settings.brand_tagline ?? '');
      fd.append('copyright_text', this.settings.brand_tagline ?? '');
      fd.append('ico',           this.settings.ico           ?? '');
      fd.append('dic',           this.settings.dic           ?? '');
      fd.append('contact_email', this.settings.contact_email ?? '');
      fd.append('contact_phone', this.settings.contact_phone ?? '');
      fd.append('address',       this.settings.address       ?? '');
      fd.append('footer_text',   this.settings.footer_text   ?? '');
      fd.append('logo_file',     this.logoFile, this.logoFile.name);
      // Laravel method spoofing pro PUT přes multipart
      fd.append('_method', 'PUT');

      this.dataHandler.upload<SiteSetting>('legal/config/settings', fd).subscribe({
        next: (res: any) => this.onSettingsSaved(res),
        error: (err: any) => this.onSettingsError(err),
      });
    } else {
      // ---- Verze bez loga (čistý JSON) ----
      const payload = {
        company_name:  this.settings.company_name,
        brand_tagline: this.settings.brand_tagline,
        copyright_text: this.settings.copyright_text,
        ico:           this.settings.ico,
        dic:           this.settings.dic,
        contact_email: this.settings.contact_email,
        contact_phone: this.settings.contact_phone,
        address:       this.settings.address,
        footer_text:   this.settings.footer_text,
      };

      this.dataHandler.put<SiteSetting>('legal/config/settings', payload as any).subscribe({
        next: (res: any) => this.onSettingsSaved(res),
        error: (err: any) => this.onSettingsError(err),
      });
    }
  }

  private onSettingsSaved(res: any): void {
    if (res) this.settings = { ...res };
    // Uvolnit blob URL loga, již nepotřebujeme
    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoFile    = null;
    this.logoPreview = null;
    this.settingsSaving = false;
    this.settingsSaved  = true;
    this.alertDialogService.open('Uloženo', 'Firemní údaje byly úspěšně uloženy.', 'success');
    setTimeout(() => { this.settingsSaved = false; this.cd.markForCheck(); }, 2500);
    this.loadAll();
  }

  private onSettingsError(err: any): void {
    this.settingsSaving = false;
    const msg = err?.error?.message ?? err?.error?.errors
      ? Object.values(err.error.errors).flat().join(', ')
      : 'Uložení selhalo.';
    this.alertDialogService.open('Chyba', String(msg), 'danger');
    this.cd.markForCheck();
  }

  // ---- Helper: URL existujícího loga ze serveru ----
  get logoSrc(): string | null {
    if (this.logoPreview)        return this.logoPreview;
    if (this.settings.logo_path) return `http://127.0.0.1:8000/storage/${this.settings.logo_path}`;
    return null;
  }

  get hasLogo(): boolean {
    return !!(this.logoPreview || this.settings.logo_path);
  }

  // ============================================================
  // SOCIÁLNÍ SÍTĚ — přidat řádek
  // ============================================================
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

  // ---- Výběr ikony sociální sítě ----
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

  // ---- Uložení jednoho řádku sociální sítě ----
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

  // ---- Smazání řádku ----
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

  // ============================================================
  // HELPERS
  // ============================================================
  markDirty(index: number): void {
    if (!this.socialLinks[index]?._dirty) {
      const updated = [...this.socialLinks];
      updated[index] = { ...updated[index], _dirty: true };
      this.socialLinks = updated;
    }
  }

  iconSrc(link: SocialLink): string | null {
    if (link._iconPreview) return link._iconPreview;
    if (link.icon_path)    return `http://127.0.0.1:8000/storage/${link.icon_path}`;
    return null;
  }

  trackByIndex(index: number): number { return index; }
}