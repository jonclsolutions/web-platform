/**
 * @file app-status-control.component.ts
 * @path src/app/admin/components/app-status/app-status-control.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Status of an application with its maintenance switch: a coloured dot with
 *   online / maintenance / problem and, for a user with the switch permission, the button that
 *   opens the confirmation window (target state, warning, password of the signed-in user). The
 *   same control in the header of every application dashboard and on the page Applications.
 * @usage `<app-status-control appId="web" />`; `[showState]="false"` = only the button (the
 *   page Applications shows the state itself).
 * @dependencies AppStatusService (state, switch), AdminLocalizationService (section `app-status`,
 *   names of the applications in `admin-layout`), AlertDialogService (missing password, success;
 *   a refusal of the API is announced by DataHandler).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { AppManifest, appById } from '../../../apps/apps.registry';
import { AppHealth, AppStatusService } from './app-status.service';

@Component({
  selector: 'app-status-control',
  standalone: true,
  templateUrl: './app-status-control.component.html',
  styleUrl: './app-status-control.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppStatusControlComponent implements OnInit {
  /** Id of the application. */
  @Input({ required: true }) appId!: string;
  /** Show the dot and the state text (false = only the switch button). */
  @Input() showState = true;

  readonly status = inject(AppStatusService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly alerts = inject(AlertDialogService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Confirmation window open. */
  modalOpen = false;
  /** Target state of the open window. */
  targetActive = true;
  /** Password typed in the window. */
  password = '';
  /** The change is being saved. */
  saving = false;

  ngOnInit(): void {
    this.status.load();
  }

  /** Manifest of the application. */
  get app(): AppManifest | undefined {
    return appById(this.appId);
  }

  /** Health shown (unknown while loading). */
  get health(): AppHealth | 'unknown' {
    return this.status.statusOf(this.appId)?.health ?? 'unknown';
  }

  /** The public part is online (unknown = true, the switch then offers maintenance). */
  get active(): boolean {
    return this.status.statusOf(this.appId)?.active !== false;
  }

  /** The control has something to show: a known state, or a switch. */
  get visible(): boolean {
    return !!this.app?.maintenance && (this.status.statusOf(this.appId) !== undefined || this.status.canSwitch(this.appId));
  }

  /**
   * @description Text of the section `app-status` with the application name filled in.
   * @param key Key in the section.
   */
  t(key: string): string {
    const name = this.app ? this.i18n.getValue(`admin-layout.${this.app.nameKey}`) : this.appId;
    return this.i18n.getValue(`app-status.${key}`).replace('{app}', name);
  }

  /** @description Opens the confirmation of the opposite state. */
  open(): void {
    this.targetActive = !this.active;
    this.password = '';
    this.modalOpen = true;
  }

  /** @description Closes the window without a change (not while saving). */
  cancel(): void {
    if (this.saving) return;
    this.modalOpen = false;
    this.password = '';
  }

  /** @description Saves the change after the password is typed; the API checks it. */
  submit(): void {
    if (this.saving || !this.app) return;
    if (!this.password.trim()) {
      this.alerts.open(this.t('error_title'), this.t('error_missing_password'), 'danger');
      return;
    }
    this.saving = true;
    this.status.setActive(this.app, this.targetActive, this.password, this.t('default_message')).subscribe({
      next: () => {
        this.saving = false;
        this.modalOpen = false;
        this.password = '';
        this.cd.markForCheck();
        this.alerts.open(this.t('success_title'), this.targetActive ? this.t('success_active') : this.t('success_maintenance'), 'success');
      },
      // The refusal (e.g. a wrong password) is announced by the API error dialog of DataHandler;
      // the window stays open for another try.
      error: () => {
        this.saving = false;
        this.cd.markForCheck();
      },
    });
  }
}
