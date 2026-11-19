/**
 * @file portal-account.component.ts
 * @path src/app/apps/project-portal/public/sections/account/portal-account.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description My account of the project portal (/projects/:token/account): the account data
 *   (managed by the supplier) and the client's own settings - e-mail, language of the e-mails and
 *   the e-mail notifications (all off by default; they need an e-mail). The form starts from the
 *   saved settings every time the section opens and after a refresh of the portal.
 * @dependencies PortalSessionService (provided by PortalLayoutComponent)
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { PortalSessionService } from '../../portal-session.service';
import { PORTAL_NOTIFICATIONS, PortalAccountSettings, PublicProject } from '../../portal.models';
import { portalTexts } from '../../portal-ui';

@Component({
  selector: 'app-portal-account',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './portal-account.component.html',
  styleUrls: ['../portal-section.css', './portal-account.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalAccountComponent implements OnInit, OnDestroy {
  readonly session = inject(PortalSessionService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  readonly t = portalTexts();

  /** Kinds of notifications offered. */
  readonly notificationKinds = PORTAL_NOTIFICATIONS;
  /** Draft of the settings (filled from the account when the section opens). */
  accountSettings: PortalAccountSettings = PortalAccountComponent.settingsOf(undefined);
  accountSaving = false;
  /** Result of the last save: 'saved' | 'error' | 'email_required' | null. */
  accountSaveResult: 'saved' | 'error' | 'email_required' | null = null;

  /**
   * @description Settings draft of an account (empty e-mail, Czech, all notifications off when unknown).
   * @param account Account of the API.
   */
  static settingsOf(account: PublicProject['account']): PortalAccountSettings {
    return {
      email: account?.email ?? '',
      language: account?.language ?? 'cz',
      notify_replies: !!account?.notify_replies,
      notify_checkpoint_status: !!account?.notify_checkpoint_status,
      notify_checkpoint_dates: !!account?.notify_checkpoint_dates,
      notify_updates: !!account?.notify_updates,
      notify_approvals: !!account?.notify_approvals,
    };
  }

  ngOnInit(): void {
    this.resetAccountSettings();
    // Refresh / another signed-in account: the form shows the settings of the account signed in now.
    this.session.refreshed$.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetAccountSettings());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** @description Puts the saved settings of the account into the form. */
  resetAccountSettings(): void {
    this.accountSettings = PortalAccountComponent.settingsOf(this.session.project()?.account);
    this.accountSaveResult = null;
    this.cdr.markForCheck();
  }

  /** @description The form differs from the saved settings. */
  get accountSettingsDirty(): boolean {
    return JSON.stringify(this.accountSettings) !== JSON.stringify(PortalAccountComponent.settingsOf(this.session.project()?.account));
  }

  /** @description Notifications need an e-mail - clearing it turns them all off in the form. */
  onAccountEmailChange(): void {
    if (!this.accountSettings.email.trim()) {
      for (const kind of PORTAL_NOTIFICATIONS) this.accountSettings[kind] = false;
    }
    this.accountSaveResult = null;
  }

  /**
   * @description Saves the own settings; the answer (project with the account) replaces the
   *   loaded one. A notification without an e-mail is refused already here.
   */
  saveAccountSettings(): void {
    if (!this.session.active || this.accountSaving || !this.accountSettingsDirty) return;
    const settings = { ...this.accountSettings, email: this.accountSettings.email.trim() };
    if (!settings.email && PORTAL_NOTIFICATIONS.some(kind => settings[kind])) {
      this.accountSaveResult = 'email_required';
      this.cdr.markForCheck();
      return;
    }
    this.accountSaving = true;
    this.accountSaveResult = null;
    this.cdr.markForCheck();
    this.session.post<PublicProject>(this.session.path('account'), settings)
      .pipe(finalize(() => { this.accountSaving = false; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (project) => {
          if (project) this.session.project.set(project);
          this.accountSettings = PortalAccountComponent.settingsOf(this.session.project()?.account);
          this.accountSaveResult = 'saved';
        },
        error: () => { this.accountSaveResult = 'error'; },
      });
  }
}
