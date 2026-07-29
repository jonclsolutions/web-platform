/**
 * @file services.component.ts
 * @path src/app/public/web-pages/services/services.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @pricing-matrix-note (2026) Původní jednoduchá mřížka karet (`priceItems` / `item_1..6`)
 *      nahrazena rozsáhlejší srovnávací maticí balíček × funkce (`pricingPackages` /
 *      `pricingFeatures`), protože přibyly další služby (Custom ERP/CRM apod.) s
 *      podstatně větším počtem funkcí než předchozích 6 karet uneslo přehledně.
 *      Matice je jeden univerzální ceník (nezávislý na záložkách Web/Desktop/Mobil/AI),
 *      s volitelným tooltipem u řádků, jejichž název sám o sobě nemusí být jasný
 *      (např. "Uživatelské role a oprávnění").
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';
import { Item, Technology } from './';
import { takeUntil } from 'rxjs/operators';

/** Jeden sloupec cenové matice (balíček/služba). */
export interface PricingPackage {
  id: string;
  name: string;
  priceLabel: string;
  description?: string;
  highlight?: boolean;
}

/** Jeden řádek cenové matice (funkce/vlastnost) s hodnotou pro každý balíček. */
export interface PricingFeatureRow {
  key: string;
  label: string;
  tooltip?: string;
  values: Record<string, string | boolean | null>;
}

@Component({
selector: 'app-main-content',
standalone: true,
imports: [CommonModule, RouterModule, KeyValuePipe],
templateUrl: './services.component.html',
styleUrls: ['./services.component.css'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesComponent extends BasePublicComponent {

protected readonly translationKey = 'services';
private route = inject(ActivatedRoute);

currentTech = 'web-dev';
technologies: Technology[] = [];

readonly workflowNumbers = ['01', '02', '03', '04'];

/** Klíč aktuálně otevřeného tooltipu v cenové matici (null = žádný). */
activeTooltipKey: string | null = null;

protected override onInit(): void {
this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
const techId = params['tech'];
if (techId && this.technologies.some(t => t.id === techId)) {
this.currentTech = techId;
this.cdr.markForCheck();
        }
      });
  }

protected override onTranslationsLoaded(): void {
this.technologies = [
      { id: 'web-dev',     name: this.t.web_dev_header },
      { id: 'desktop-dev', name: this.t.desktop_dev_header },
      { id: 'mobile-dev',  name: this.t.mobile_dev_header },
      { id: 'ai-dev',      name: this.t.ai_dev_header },
    ];
  }

get currentInfoHeader(): string {
const map: any = { 'web-dev': this.t?.info_header_web, 'desktop-dev': this.t?.info_header_desktop, 'mobile-dev': this.t?.info_header_mobile, 'ai-dev': this.t?.info_header_ai };
return map[this.currentTech] || '';
  }

get currentMainText(): string {
const map: any = { 'web-dev': this.t?.service_main_text_1, 'desktop-dev': this.t?.service_main_text_2, 'mobile-dev': this.t?.service_main_text_3, 'ai-dev': this.t?.service_main_text_4 };
return map[this.currentTech] || '';
  }

get currentServices() {
const map: any = { 'web-dev': this.t?.webServices, 'desktop-dev': this.t?.desktopServices, 'mobile-dev': this.t?.mobileServices, 'ai-dev': this.t?.aiServices };
return map[this.currentTech] || [];
  }

/**
   * @description Balíčky (sloupce) cenové matice - jeden univerzální ceník napříč
   *              celou nabídkou služeb, nezávislý na zvolené technologické záložce.
   */
get pricingPackages(): PricingPackage[] {
return this.t?.pricing?.packages ?? [];
  }

/**
   * @description Řádky (funkce/vlastnosti) cenové matice, každý s hodnotou pro
   *              každý balíček (true/false pro fajfku, nebo text jako konkrétní hodnota).
   */
get pricingFeatures(): PricingFeatureRow[] {
return this.t?.pricing?.features ?? [];
  }

/**
   * @description Rozliší, jak se má hodnota buňky v matici vykreslit.
   * @param value Hodnota z `PricingFeatureRow.values[packageId]`.
   */
featureCellType(value: string | boolean | null | undefined): 'yes' | 'no' | 'text' {
if (value === true) return 'yes';
if (value === false || value === null || value === undefined) return 'no';
return 'text';
  }

/**
   * @description Přepne zobrazení tooltipu u daného řádku matice (pro dotyková zařízení
   *              bez hoveru - na desktopu se navíc zobrazuje i při najetí myší).
   */
toggleTooltip(key: string): void {
this.activeTooltipKey = this.activeTooltipKey === key ? null : key;
this.cdr.markForCheck();
  }

get workflowSteps() {
return [this.t?.colab?.item_1, this.t?.colab?.item_2, this.t?.colab?.item_3, this.t?.colab?.item_4];
  }

toggleFaq(item: Item): void {
item.isActive = !item.isActive;
this.cdr.markForCheck();
  }

selectTech(techId: string): void {
this.currentTech = techId;
this.cdr.markForCheck();
  }
}