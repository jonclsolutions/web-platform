/**
 * @file about-us.component.ts
 * @path src/app/public/web-pages/about-us/about-us.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '../../../shared/imports/web-providers';
import { BasePublicComponent } from '../../base-public.component';

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutUsComponent extends BasePublicComponent {
  
  // 1. Konfigurace pro bázovou třídu
  protected readonly translationKey = 'about_us';
  protected override readonly loadSiteSettings = true; 

  // 2. Všechny potřebné proměnné (t, socialLinks, settings)
  // a metody (getIconUrl) jsou nyní automaticky dostupné z BasePublicComponent.

  // 3. Pokud nepotřebuješ extra logiku v ngOnInit nebo onDestroy,
  // nemusíš je vůbec definovat.
}