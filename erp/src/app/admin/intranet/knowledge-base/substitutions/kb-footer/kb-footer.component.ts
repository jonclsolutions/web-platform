/**
 * @file kb-footer.component.ts
 * @path src/app/admin/intranet/knowledge-base/substitutions/kb-footer/kb-footer.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * Komponenta NEdědí BaseDataComponent, proto ruční injection AdminLocalizationService,
 * stejný vzor jako ostatní drobné buildery. Nemá `ChangeDetectionStrategy.OnPush`,
 * takže na rozdíl od TableBuilderComponent zde není potřeba `translations$` subscribe.
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