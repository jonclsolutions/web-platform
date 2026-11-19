/**
 * @file release-notice.component.ts
 * @path src/app/admin/components/releases/release-notice.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notice above the admin page after an update: "Updated to v… - N changes here",
 *   with "What's new" (page Core → Releases filtered to this module) and a close button. Shown
 *   only when a release newer than the one the user saw in this module changed THIS module (the
 *   core, or the application the user is in) - ReleaseNotesService.unseenFor().
 * @usage `<app-release-notice [module]="currentModule" />` in the admin layout.
 * @dependencies ReleaseNotesService, AdminLocalizationService (section `releases`), Router.
 */

import { ChangeDetectionStrategy, Component, Input, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { Release, ReleaseNotesService } from './release-notes.service';

@Component({
  selector: 'app-release-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './release-notice.component.html',
  styleUrl: './release-notice.component.css',
})
export class ReleaseNoticeComponent implements OnInit {
  /** Module the user is in: `core` or an application id. */
  @Input({ required: true }) module!: string;

  private readonly notes = inject(ReleaseNotesService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.notes.load();
  }

  /** Unseen releases that changed the module (empty = no notice). */
  get releases(): Release[] {
    return this.notes.unseenFor(this.module);
  }

  /**
   * @description Text of the notice: running version and the number of changes of the module.
   * @param releases Unseen releases of the module.
   */
  text(releases: Release[]): string {
    const count = releases.reduce((sum, release) => sum + release.changes.length, 0);
    return this.t('notice_text').replace('{version}', this.notes.current()).replace('{count}', String(count));
  }

  /** @description Opens the release notes of this module and hides the notice. */
  open(): void {
    this.notes.markSeen(this.module);
    this.router.navigate(['/admin/core/releases'], { queryParams: { area: this.module } });
  }

  /** @description Hides the notice until the next release that changes this module. */
  close(): void {
    this.notes.markSeen(this.module);
  }

  /**
   * @description Text of the section `releases`.
   * @param key Key.
   */
  t(key: string): string {
    return this.i18n.getValue(`releases.${key}`);
  }
}
