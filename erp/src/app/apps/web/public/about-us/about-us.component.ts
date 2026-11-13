/**
 * @file about-us.component.ts
 * @path src/app/apps/web/public/about-us/about-us.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description "About us" page of the public web.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '../../../../shared/imports/web-providers';
import { BasePublicComponent } from '../../../../public/base-public.component';

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './about-us.component.html',
  styleUrls: ['../shared-styles/theme.css', '../shared-styles/animations.css', '../shared-styles/cta.css', '../../../../shared/styles/base.css', '../shared-styles/content-page.css', './about-us.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutUsComponent extends BasePublicComponent {
  
  // Configuration of the base class
  protected readonly translationKey = 'about_us';
  protected override readonly loadSiteSettings = true; 

  // All needed fields (t, socialLinks, settings)
  // and methods (getIconUrl) come from BasePublicComponent.

}