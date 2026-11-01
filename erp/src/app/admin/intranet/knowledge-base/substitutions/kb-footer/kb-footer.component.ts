/**
 * @file kb-footer.component.ts
 * @path src/app/admin/intranet/knowledge-base/substitutions/kb-footer/kb-footer.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Footer of the internal Knowledge Base pages.
 */

import { Component, inject } from '@angular/core';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';

@Component({
  selector: 'app-kb-footer',
  imports: [],
  templateUrl: './kb-footer.component.html',
  styleUrl: './kb-footer.component.css',
})
export class KbFooterComponent {
  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('kb-footer'); }
}