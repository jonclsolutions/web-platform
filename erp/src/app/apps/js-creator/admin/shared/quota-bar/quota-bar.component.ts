/**
 * @file quota-bar.component.ts
 * @path src/app/apps/js-creator/admin/shared/quota-bar/quota-bar.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Usage bar of the own workspace: used / allowed space and percent, amber from 80 %,
 *   red when full (then nothing can be uploaded or generated), and how much the trash takes.
 *   Loads the usage itself on the first render (WorkspaceUsageService).
 * @usage `<app-quota-bar />` under the header of a workspace page.
 * @dependencies WorkspaceUsageService, AdminLocalizationService (section `js-creator-shared`),
 *   workspace-format.ts.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { WorkspaceUsageService } from '../workspace-usage.service';
import { formatBytes, usageLevel, usagePercent } from '../workspace-format';

@Component({
  selector: 'app-quota-bar',
  standalone: true,
  templateUrl: './quota-bar.component.html',
  styleUrl: './quota-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotaBarComponent implements OnInit {
  private readonly i18n = inject(AdminLocalizationService);
  private readonly usageService = inject(WorkspaceUsageService);

  /** Usage of the workspace (null while loading). */
  readonly usage = this.usageService.usage;

  /** Level of the usage (ok / warning / full). */
  readonly level = computed(() => {
    const u = this.usage();
    return u ? usageLevel(u.used_bytes, u.quota_bytes) : 'ok';
  });

  /** Percent of the quota in use. */
  readonly percent = computed(() => {
    const u = this.usage();
    return u ? usagePercent(u.used_bytes, u.quota_bytes) : 0;
  });

  /** @description Loads the usage. */
  ngOnInit(): void {
    this.usageService.refresh();
  }

  /**
   * @description Text of the shared section.
   * @param key Key in `js-creator-shared`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-shared.${key}`);
  }

  /**
   * @description Size in the locale of the admin.
   * @param bytes Size.
   */
  size(bytes: number): string {
    return formatBytes(bytes, this.i18n.getDateLocale());
  }
}
