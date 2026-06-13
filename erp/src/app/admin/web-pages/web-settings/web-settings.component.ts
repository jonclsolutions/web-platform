import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

interface SiteSetting {
  id?: number;
  company_name: string;
  ico: string;
  dic: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  footer_text: string;
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

  settings: SiteSetting = {
    company_name: '', ico: '', dic: '',
    contact_email: '', contact_phone: '',
    address: '', footer_text: '',
  };
  settingsLoading = true;
  settingsSaving  = false;
  settingsSaved   = false;

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
          position:     s.position ?? 0,
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

  // ============================================================
  // FIREMNÍ ÚDAJE — OPRAVA: Po uložení voláme loadAll()
  // ============================================================
  saveSettings(): void {
    if (this.settingsSaving) return;
    this.settingsSaving = true;
    this.settingsSaved  = false;

    this.dataHandler.put<SiteSetting>('legal/config/settings', this.settings as any).subscribe({
      next: () => {
        this.settingsSaving = false;
        this.settingsSaved  = true;
        this.alertDialogService.open('Uloženo', 'Firemní údaje byly úspěšně uloženy.', 'success');
        
        // OPRAVA: Znovu načteme data pro konzistenci
        this.loadAll();
        
        setTimeout(() => { this.settingsSaved = false; this.cd.markForCheck(); }, 2500);
        this.cd.markForCheck();
      },
      error: (err: any) => {
        this.settingsSaving = false;
        const msg = err?.error?.message ?? 'Uložení selhalo.';
        this.alertDialogService.open('Chyba', msg, 'danger');
        this.cd.markForCheck();
      }
    });
  }

  addSocialLink(): void {
    this.socialLinks = [...this.socialLinks, {
      name:         '',
      url:          '',
      icon_path:    '',
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
      this.alertDialogService.open('Příliš velký soubor', 'Ikonka může mít maximálně 2 MB.', 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.alertDialogService.open('Neplatný formát', 'Vyberte prosím obrázek.', 'warning');
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

    if (!link.name?.trim() || !link.url?.trim()) {
      this.alertDialogService.open('Validace', 'Vyplňte název a URL.', 'warning');
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

      const endpoint = link._isNew ? 'legal/config/social' : `legal/config/social/${link.id}`;
      this.dataHandler.upload<SocialLink>(endpoint, fd).subscribe({ next: onSuccess, error: onError });
    } else {
      this.dataHandler.put<SocialLink>(`legal/config/social/${link.id}`, {
        name:      link.name.trim(),
        url:       link.url.trim(),
        position:  link.position,
        icon_path: link.icon_path,
      }).subscribe({ next: onSuccess, error: onError });
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

    const confirmed = await this.confirmDialog.open('Smazat', `Smazat „${link.name}"?`);
    if (!confirmed) return;

    this.dataHandler.delete(`legal/config/social/${link.id}`).subscribe({
      next: () => {
        this.alertDialogService.open('Smazáno', 'Odkaz smazán.', 'success');
        this.loadAll();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err?.error?.message ?? 'Chyba.', 'danger')
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
    if (link.icon_path) return `http://127.0.0.1:8000/storage/${link.icon_path}`;
    return null;
  }

  trackByIndex(index: number): number { return index; }
}