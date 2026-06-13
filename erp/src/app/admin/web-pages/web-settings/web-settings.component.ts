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
  // Lokální UI stav — nepřenáší se na server
  _iconFile?: File | null;
  _iconPreview?: string | null;
  _saving?: boolean;
  _isNew?: boolean;
  _dirty?: boolean; // Označí řádek jako upravený (aby bylo jasné že je potřeba uložit)
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
  };
  settingsLoading = true;
  settingsSaving  = false;
  settingsSaved   = false;

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
  // NAČTENÍ DAT  —  GET /api/legal/config
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
        // Mapování ze serveru: zachováme jen serverová data + resetujeme lokální UI stav
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
  // FIREMNÍ ÚDAJE  —  PUT /api/legal/config/settings
  // ============================================================
  saveSettings(): void {
    if (this.settingsSaving) return;
    this.settingsSaving = true;
    this.settingsSaved  = false;

    this.dataHandler.put<SiteSetting>('legal/config/settings', this.settings as any).subscribe({
      next: (res: any) => {
        this.settings       = { ...res };
        this.settingsSaving = false;
        this.settingsSaved  = true;
        this.alertDialogService.open('Uloženo', 'Firemní údaje byly úspěšně uloženy.', 'success');
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

  // ============================================================
  // SOCIÁLNÍ SÍTĚ — PŘIDAT PRÁZDNÝ ŘÁDEK
  // ============================================================
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

  // ============================================================
  // VÝBĚR IKONY ZE SOUBORU
  // ============================================================
  onIconSelected(event: Event, index: number): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Validace velikosti (max 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      this.alertDialogService.open('Příliš velký soubor', 'Ikonka může mít maximálně 2 MB.', 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }

    // Validace typu
    if (!file.type.startsWith('image/')) {
      this.alertDialogService.open('Neplatný formát', 'Vyberte prosím obrázek (JPG, PNG, SVG…).', 'warning');
      (event.target as HTMLInputElement).value = '';
      return;
    }

    const updated = [...this.socialLinks];
    // Uvolnit starý blob URL aby nedošlo k memory leaku
    if (updated[index]._iconPreview) {
      URL.revokeObjectURL(updated[index]._iconPreview!);
    }
    updated[index] = {
      ...updated[index],
      _iconFile:    file,
      _iconPreview: URL.createObjectURL(file),
      _dirty:       true,
    };
    this.socialLinks = updated;
    this.cd.markForCheck();
  }

  // ============================================================
  // ULOŽENÍ JEDNOHO SOCIÁLNÍHO ODKAZU
  //   Nový:                  POST /api/legal/config/social (FormData)
  //   Existující + soubor:   PUT  /api/legal/config/social/{id} (FormData)
  //   Existující bez souboru: PUT /api/legal/config/social/{id} (JSON)
  // ============================================================
  saveSocialLink(index: number): void {
    const link = this.socialLinks[index];
    if (link._saving) return;

    // Validace povinných polí
    if (!link.name?.trim()) {
      this.alertDialogService.open('Validace', 'Zadejte název sociální sítě.', 'warning');
      return;
    }
    if (!link.url?.trim()) {
      this.alertDialogService.open('Validace', 'Zadejte URL odkazu.', 'warning');
      return;
    }

    // Označit jako "ukládá se" — immutabilně, aby OnPush detekoval změnu
    const withSaving = [...this.socialLinks];
    withSaving[index] = { ...withSaving[index], _saving: true };
    this.socialLinks = withSaving;
    this.cd.markForCheck();

    // Po úspěchu: znovu načíst ze serveru (=jediná spolehlivá cesta jak
    // zaručit konzistenci dat bez manuálního patchování pole)
    const onSuccess = () => {
      this.alertDialogService.open('Uloženo', `Odkaz „${link.name}" byl uložen.`, 'success');
      this.loadAll(); // ← opravuje bug s prázdnými poli po uložení
    };

    const onError = (err: any) => {
      const msg = err?.error?.message ?? 'Uložení selhalo.';
      this.alertDialogService.open('Chyba', msg, 'danger');
      // Vrátit saving = false bez reloadu
      const failed = [...this.socialLinks];
      failed[index] = { ...failed[index], _saving: false };
      this.socialLinks = failed;
      this.cd.markForCheck();
    };

    if (link._isNew) {
      // ---- POST — nový záznam ----
      const fd = new FormData();
      fd.append('name',     link.name.trim());
      fd.append('url',      link.url.trim());
      fd.append('position', String(link.position));
      if (link._iconFile) fd.append('icon_file', link._iconFile, link._iconFile.name);

      this.dataHandler.upload<SocialLink>('legal/config/social', fd)
        .subscribe({ next: onSuccess, error: onError });

    } else if (link._iconFile) {
      // ---- PUT s novým souborem (FormData) ----
      const fd = new FormData();
      fd.append('name',      link.name.trim());
      fd.append('url',       link.url.trim());
      fd.append('position',  String(link.position));
      fd.append('icon_file', link._iconFile, link._iconFile.name);

      this.dataHandler.upload<SocialLink>(`legal/config/social/${link.id}`, fd)
        .subscribe({ next: onSuccess, error: onError });

    } else {
      // ---- PUT bez souboru (čistý JSON) ----
      this.dataHandler.put<SocialLink>(`legal/config/social/${link.id}`, {
        name:      link.name.trim(),
        url:       link.url.trim(),
        position:  link.position,
        icon_path: link.icon_path,
      } as any).subscribe({ next: onSuccess, error: onError });
    }
  }

  // ============================================================
  // SMAZÁNÍ ODKAZU  —  DELETE /api/legal/config/social/{id}
  // ============================================================
  async deleteSocialLink(index: number): Promise<void> {
    const link = this.socialLinks[index];

    // Nový, ještě neuložený záznam — jen odebrat z pole bez dotazu
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
      error: (err: any) => {
        const msg = err?.error?.message ?? 'Smazání selhalo.';
        this.alertDialogService.open('Chyba', msg, 'danger');
      }
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  // Označí řádek jako dirty (uživatel editoval pole)
  markDirty(index: number): void {
    if (!this.socialLinks[index]?._dirty) {
      const updated = [...this.socialLinks];
      updated[index] = { ...updated[index], _dirty: true };
      this.socialLinks = updated;
    }
  }

// V souboru web-settings.component.ts

iconSrc(link: SocialLink): string | null {
  // 1. Přednost má náhled (Blob)
  if (link._iconPreview) return link._iconPreview;
  
  // 2. Pokud je v DB cesta, přidej k ní doménu API serveru
  if (link.icon_path) {
    // Předpokládáme, že tvé API běží na localhost:8000
    const baseUrl = 'http://127.0.0.1:8000'; 
    return `${baseUrl}/storage/${link.icon_path}`;
  }
  
  return null;
}

  trackByIndex(index: number): number { return index; }
}