/**
 * @file retention-settings.component.ts
 * @path src/app/admin/core-pages/web-settings/retention-settings/retention-settings.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description "Data retention" tab of the web settings (GDPR Art. 5(1)(e) storage limitation,
 * VT-10): the retention period of every kind of personal data (job applications, inquiries,
 * leads, tickets, web orders, projects, cookie consents), the result of the last clean-up and an
 * immediate run of the clean-up that otherwise runs every night (`retention:purge`).
 * @note The period runs from the last change of a record; "off" keeps the records until they are
 * deleted by hand. Editing and running need `core-legal-config-update`, otherwise the values are
 * read-only. A destructive run is always confirmed first.
 * @dependencies
 * - DataHandler: `core/retention_settings` (GET / PUT) and `core/retention_settings/purge` (POST).
 * - AdminLocalizationService: texts of the section `retention-settings`.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../../core/auth/services/permission.service';

/** @description One retention setting of the API (core_retention_settings). */
export interface RetentionSetting {
  data_key: string;
  /** Period in days; null = automatic deletion off. */
  retention_days: number | null;
  last_run_at: string | null;
  last_deleted_count: number | null;
}

/** @description Answer of the immediate clean-up. */
interface PurgeResult {
  deleted: Record<string, number | null>;
  settings: RetentionSetting[];
}

/** @description Periods offered in the select (days); null = off. A custom value of the API is added. */
export const RETENTION_OPTIONS: (number | null)[] = [null, 30, 90, 180, 365, 730, 1095, 1825, 3650];

@Component({
  selector: 'app-retention-settings',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './retention-settings.component.html',
  styleUrl: './retention-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RetentionSettingsComponent implements OnInit {
  private dataHandler = inject(DataHandler);
  private i18n = inject(AdminLocalizationService);
  private alert = inject(AlertDialogService);
  private confirm = inject(ConfirmDialogService);
  private permissions = inject(PermissionService);
  private cd = inject(ChangeDetectorRef);

  settings: RetentionSetting[] = [];
  loading = true;
  loadError = false;
  saving = false;
  purging = false;

  /** Whether the user may change the periods and run the clean-up. */
  readonly canEdit = this.permissions.hasPermission('core-legal-config-update');

  /** @description Translated text of the section `retention-settings`. */
  t(key: string): string {
    return this.i18n.getValue(`retention-settings.${key}`);
  }

  ngOnInit(): void {
    this.load();
  }

  /** @description Loads the settings. */
  load(): void {
    this.loading = true;
    this.loadError = false;
    this.cd.markForCheck();
    this.dataHandler.get<RetentionSetting[]>('core/retention_settings').subscribe({
      next: (rows) => { this.settings = this.copy(rows); this.loading = false; this.cd.markForCheck(); },
      error: () => { this.loading = false; this.loadError = true; this.cd.markForCheck(); }
    });
  }

  /**
   * @description Periods of the select of one setting - the standard ones plus its own value
   * when the API holds another one.
   * @param setting Setting of the row.
   * @returns Days (null = off).
   */
  optionsFor(setting: RetentionSetting): (number | null)[] {
    const custom = setting.retention_days;
    if (RETENTION_OPTIONS.includes(custom)) return RETENTION_OPTIONS;
    const days = [...RETENTION_OPTIONS.filter((d): d is number => d !== null), custom as number].sort((x, y) => x - y);
    return [null, ...days];
  }

  /**
   * @description Readable period: "off", a translated standard period or "{n} days".
   * @param days Days (null = off).
   * @returns Text of the option.
   */
  periodLabel(days: number | null): string {
    if (days === null) return this.t('option_off');
    return RETENTION_OPTIONS.includes(days) ? this.t(`option_${days}`) : this.t('option_days').replace('{n}', String(days));
  }

  /** @description Stores all periods. */
  save(): void {
    if (this.saving || !this.canEdit) return;
    this.saving = true;
    this.cd.markForCheck();
    const payload = { settings: this.settings.map(s => ({ data_key: s.data_key, retention_days: s.retention_days })) };
    this.dataHandler.put<RetentionSetting[]>('core/retention_settings', payload).subscribe({
      next: (rows) => {
        this.settings = this.copy(rows);
        this.saving = false;
        this.alert.open(this.t('saved_title'), this.t('saved_message'), 'success');
        this.cd.markForCheck();
      },
      error: () => { this.saving = false; this.cd.markForCheck(); }
    });
  }

  /**
   * @description Runs the clean-up at once with the STORED periods (unsaved edits are not used),
   * after a confirmation; shows how many records were deleted.
   */
  async purgeNow(): Promise<void> {
    if (this.purging || !this.canEdit) return;
    const confirmed = await this.confirm.open(this.t('purge_confirm_title'), this.t('purge_confirm_message'));
    if (!confirmed) return;

    this.purging = true;
    this.cd.markForCheck();
    this.dataHandler.post<PurgeResult>('core/retention_settings/purge', {}).subscribe({
      next: (res) => {
        this.purging = false;
        this.settings = this.copy(res?.settings ?? this.settings);
        const total = Object.values(res?.deleted ?? {}).reduce<number>((sum, n) => sum + (n ?? 0), 0);
        this.alert.open(this.t('purge_done_title'), this.t('purge_done_message').replace('{count}', String(total)), 'success');
        this.cd.markForCheck();
      },
      error: () => { this.purging = false; this.cd.markForCheck(); }
    });
  }

  /** @description Copies the rows, so the form edits never change the API answer. */
  private copy(rows: RetentionSetting[] | null | undefined): RetentionSetting[] {
    return (rows ?? []).map(r => ({ ...r }));
  }
}
