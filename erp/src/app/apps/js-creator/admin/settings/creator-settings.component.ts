/**
 * @file creator-settings.component.ts
 * @path src/app/apps/js-creator/admin/settings/creator-settings.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Settings" (js-creator/settings): the default quota of an account and the
 *   overview of the accounts with access to the application or with data in it - used space,
 *   numbers of folders / images / fonts and the quota, which can be set per account. Nobody sees
 *   the content of another workspace here (only numbers). Changes need
 *   `js-creator-settings-update`.
 * @dependencies JsCreatorApiService, AdminModalComponent, PermissionService,
 *   AdminLocalizationService (section `js-creator-settings`), workspace-format.ts.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { PermissionService } from '../../../../core/auth/services/permission.service';
import { PageHeaderComponent } from '../../../../admin/components/page-header/page-header.component';
import { AdminModalComponent } from '../../../../admin/components/admin-modal/admin-modal.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { JsCreatorApiService } from '../shared/js-creator-api.service';
import { QuotaAccount } from '../shared/js-creator.models';
import { formatBytes, usageLevel, usagePercent } from '../shared/workspace-format';

/** Highest quota (MB) - the limit of the API. */
export const MAX_QUOTA_MB = 102400;

/** Open quota popup of an account. */
interface QuotaDialog {
  account: QuotaAccount;
  useDefault: boolean;
  quotaMb: number;
  error: string;
}

@Component({
  selector: 'app-js-creator-settings',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, AdminModalComponent, IconComponent],
  templateUrl: './creator-settings.component.html',
  styleUrls: ['../../../../admin/shared-styles/modal.css', '../shared-styles/workspace.css', './creator-settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatorSettingsComponent implements OnInit {
  private readonly api = inject(JsCreatorApiService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly permissions = inject(PermissionService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Id of the quota form (submit button in the footer). */
  readonly formId = 'jc-quota-form';
  /** Highest quota (MB). */
  readonly maxQuota = MAX_QUOTA_MB;
  /** May change the quotas. */
  readonly canUpdate = this.permissions.hasPermission('js-creator-settings-update');

  /** Saved default quota (MB, null until loaded). */
  defaultQuota: number | null = null;
  /** Edited default quota (MB). */
  defaultDraft = 0;
  /** Error of the default quota field. */
  defaultError = '';
  /** Accounts of the overview. */
  accounts: QuotaAccount[] = [];
  /** A change is running. */
  busy = false;
  /** The default quota was just saved. */
  saved = false;
  /** Open quota popup. */
  dialog: QuotaDialog | null = null;

  /** @description Loads the settings and the overview. */
  ngOnInit(): void {
    this.api.settings().subscribe(settings => {
      this.defaultQuota = settings.default_quota_mb;
      this.defaultDraft = settings.default_quota_mb;
      this.cd.markForCheck();
    });
    this.loadAccounts();
  }

  /**
   * @description Text of the page section.
   * @param key Key in `js-creator-settings`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-settings.${key}`);
  }

  /**
   * @description Size in the locale of the admin.
   * @param bytes Size.
   */
  size(bytes: number): string {
    return formatBytes(bytes, this.i18n.getDateLocale());
  }

  /**
   * @description Level of the usage of an account (ok / warning / full).
   * @param account Account.
   */
  level(account: QuotaAccount): string {
    return usageLevel(account.used_bytes, account.quota_bytes);
  }

  /**
   * @description Percent of the quota in use.
   * @param account Account.
   */
  percent(account: QuotaAccount): number {
    return usagePercent(account.used_bytes, account.quota_bytes);
  }

  /** @description Saves the default quota. */
  saveDefault(): void {
    const value = Number(this.defaultDraft);
    this.defaultError = this.quotaError(value);
    this.saved = false;
    if (this.defaultError || this.busy) {
      this.cd.markForCheck();
      return;
    }
    this.busy = true;
    this.api.updateSettings({ default_quota_mb: value }).subscribe({
      next: settings => {
        this.busy = false;
        this.saved = true;
        this.defaultQuota = settings.default_quota_mb;
        this.defaultDraft = settings.default_quota_mb;
        this.loadAccounts();
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Opens the quota popup of an account.
   * @param account Account.
   */
  openQuota(account: QuotaAccount): void {
    this.dialog = { account, useDefault: account.quota_mb === null, quotaMb: account.quota_mb ?? this.defaultQuota ?? 1024, error: '' };
    this.cd.markForCheck();
  }

  /** @description Closes the popup (not while saving). */
  closeDialog(): void {
    if (!this.busy) this.dialog = null;
    this.cd.markForCheck();
  }

  /** @description Saves the quota of the account of the popup. */
  submitQuota(): void {
    const dialog = this.dialog;
    if (!dialog || this.busy) return;
    const value = dialog.useDefault ? null : Number(dialog.quotaMb);
    dialog.error = value === null ? '' : this.quotaError(value);
    if (dialog.error) {
      this.cd.markForCheck();
      return;
    }
    this.busy = true;
    this.api.updateQuota(dialog.account.id, value).subscribe({
      next: updated => {
        this.busy = false;
        this.dialog = null;
        this.accounts = this.accounts.map(a => (a.id === updated.id ? updated : a));
        this.cd.markForCheck();
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Error of a quota value, or ''.
   * @param value MB.
   */
  private quotaError(value: number): string {
    return Number.isInteger(value) && value >= 1 && value <= MAX_QUOTA_MB ? '' : this.t('error_quota_range');
  }

  /** @description Loads the overview of the accounts. */
  private loadAccounts(): void {
    this.api.quotaAccounts().subscribe(accounts => {
      this.accounts = accounts;
      this.cd.markForCheck();
    });
  }
}
