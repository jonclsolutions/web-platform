/**
 * @file services.component.ts
 * @path src/app/public/web-pages/services/services.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @refactor-note (2026-09) BACKLOG "zjednodušení stránky služeb": odstraněny
 *     tech záložky, sidebar stat karty, AI kategorie a s nimi spojená logika
 *     (currentTech, selectTech, currentServices, currentPricing, currentInfoHeader,
 *     currentMainText, technologies array, ActivatedRoute queryParams subscription).
 *     Stránka je nyní jednotný celek - `t.services` pro FAQ, `t.pricing` přímo
 *     (ne per-tech), `t.service_main_text` a `t.info_header` jako scalar klíče.
 *     Tabulka cen zachována ale bez cenového řádku - `pm-pkg-price` odstraněn
 *     ze šablony, data v JSON ho neobsahují.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';
import { Item } from './';

export interface PricingPackage {
  id: string;
  name: string;
  description?: string;
  highlight?: boolean;
}

export interface PricingFeatureRow {
  key: string;
  label: string;
  tooltip?: string;
  values: Record<string, string | boolean | null>;
}

export interface PricingMatrix {
  eyebrow?: string;
  header?: string;
  subheader?: string;
  note?: string;
  packages: PricingPackage[];
  features: PricingFeatureRow[];
}

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesComponent extends BasePublicComponent {

  protected readonly translationKey = 'services';

  activeTooltipKey: string | null = null;

featureCards: Array<{key: string; iconPath: string; title: string; text: string; tags?: string[]}> = [];
smoke: string = 'assets/images/backgrounds/smoke-cropped.svg';

protected override onTranslationsLoaded(): void {
  this.featureCards = [
    {
      key: 'custom',
      iconPath: '<path d="M16 18 22 12 16 6"/><path d="M8 6 2 12 8 18"/>',
      title: this.t?.cards?.custom_title ?? '',
      text: this.t?.cards?.custom_text ?? '',
      tags: ['Web', 'Desktop', 'Mobil'],
    },
    {
      key: 'auth',
      iconPath: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      title: this.t?.cards?.auth_title ?? '',
      text: this.t?.cards?.auth_text ?? '',
      tags: ['Přihlášení', 'Role', 'Oprávnění'],
    },
    {
      key: 'seo',
      iconPath: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
      title: this.t?.cards?.seo_title ?? '',
      text: this.t?.cards?.seo_text ?? '',
      tags: ['Meta tagy', 'Sitemap', 'Core Web Vitals'],
    },
    {
      key: 'hosting',
      iconPath: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
      title: this.t?.cards?.hosting_title ?? '',
      text: this.t?.cards?.hosting_text ?? '',
      tags: ['Server', 'CI/CD', 'SSL'],
    },
    {
      key: 'integrations',
      iconPath: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
      title: this.t?.cards?.integrations_title ?? '',
      text: this.t?.cards?.integrations_text ?? '',
      tags: ['API', 'Platební brána', 'ERP'],
    },
    {
      key: 'security',
      iconPath: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      title: this.t?.cards?.security_title ?? '',
      text: this.t?.cards?.security_text ?? '',
      tags: ['HTTPS', 'Šifrování', 'GDPR'],
    },
    {
      key: 'admin',
      iconPath: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      title: this.t?.cards?.admin_title ?? '',
      text: this.t?.cards?.admin_text ?? '',
      tags: ['CMS', 'Dashboard', 'Správa obsahu'],
    },
    {
      key: 'support',
      iconPath: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2z"/>',
      title: this.t?.cards?.support_title ?? '',
      text: this.t?.cards?.support_text ?? '',
      tags: ['Údržba', 'Aktualizace', 'Monitoring'],
    },
  ];
}

  get pricingPackages(): PricingPackage[] {
    return this.t?.pricing?.packages ?? [];
  }

  get pricingFeatures(): PricingFeatureRow[] {
    return this.t?.pricing?.features ?? [];
  }

  featureCellType(value: string | boolean | null | undefined): 'yes' | 'no' | 'text' {
    if (value === true) return 'yes';
    if (value === false || value === null || value === undefined) return 'no';
    return 'text';
  }

  toggleTooltip(key: string): void {
    this.activeTooltipKey = this.activeTooltipKey === key ? null : key;
    this.cdr.markForCheck();
  }

  readonly workflowNumbers = ['01', '02', '03', '04', '05', '06', '07'];

get workflowSteps() {
  return [
    this.t?.colab?.item_1,
    this.t?.colab?.item_2,
    this.t?.colab?.item_3,
    this.t?.colab?.item_4,
    this.t?.colab?.item_5,
    this.t?.colab?.item_6,
    this.t?.colab?.item_7,
  ];
}
}