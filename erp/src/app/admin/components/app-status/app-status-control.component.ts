/**
 * @file app-status-control.component.ts
 * @path src/app/admin/components/app-status/app-status-control.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Status of an application with its maintenance switch: a coloured dot with
 *   online / maintenance / problem and, for a user with the switch permission, the button that
 *   opens the shared password dialog (target state, warning, password of the signed-in user). The
 *   same control in the header of every application dashboard and on the page Applications.
 * @usage `<app-status-control appId="web" />`; `[showState]="false"` = only the button (the
 *   page Applications shows the state itself).
 * @dependencies AppStatusService (state, switch), AdminLocalizationService (section `app-status`,
 *   names of the applications in `admin-layout`), PasswordDialogService (the confirmation),
 *   AlertDialogService (success; a refusal of the API is announced by DataHandler).
 */

import { ChangeDetectionStrategy, Component, Input, OnInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { PasswordDialogService } from '../../../core/services/password-dialog.service';
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
  private readonly passwordDialog = inject(PasswordDialogService);

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

  /**
   * @description Asks for the password to switch to the opposite state (shared password dialog)
   *   and saves the change; the API checks the password. A refusal (e.g. a wrong password) is
   *   announced by the API error dialog of DataHandler and the dialog stays open for another try.
   * @returns Promise - true = switched, false = cancelled.
   */
  async open(): Promise<boolean> {
    const app = this.app;
    if (!app) return false;
    const targetActive = !this.active;
    const done = await this.passwordDialog.open({
      title: this.t('modal_title'),
      message: this.t('modal_intro'),
      highlight: targetActive ? this.t('modal_state_active') : this.t('modal_state_maintenance'),
      highlightTone: targetActive ? 'success' : 'warning',
      warning: targetActive ? this.t('modal_warning_on') : this.t('modal_warning_off'),
      label: this.t('modal_password_label'),
      confirmLabel: this.t('modal_confirm'),
      submit: password => firstValueFrom(this.status.setActive(app, targetActive, password, this.t('default_message')))
        .then(() => null, () => ''),
    });
    if (done) {
      this.alerts.open(this.t('success_title'), targetActive ? this.t('success_active') : this.t('success_maintenance'), 'success');
    }
    return done;
  }
}
