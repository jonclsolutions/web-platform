/**
 * @file admin-error-page.component.ts
 * @path src/app/admin/error-pages/admin-error-page.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-27
 * @description Error pages of the administration, rendered inside the admin layout (header and
 *   menu stay usable). The route data `adminErrorPage` decides which page:
 *   - `not-found` (404): the catch-all `**` route of the admin - an address no admin route knows.
 *     The URL stays as typed.
 *   - `forbidden` (403): `/admin/forbidden` - AuthGuard / sysadminGuard send the user here when a
 *     page EXISTS but the user lacks its permission (the refused address is passed in the
 *     navigation state, never in the URL).
 *   New kind of page = one entry in ADMIN_ERROR_PAGES + a route with its `adminErrorPage` value +
 *   texts in the admin i18n section `error-pages`.
 * @note Shows only the path (no query / fragment - they may carry personal data) and never says
 *   which permission is missing (no hints about the permission model to whoever probes URLs).
 * @dependencies
 * - AdminLocalizationService: texts of the section `error-pages`.
 * - AuthGuard constants: route data key and the navigation state key of the refused address.
 * - Router / Location: the requested path (404) or the refused one from the navigation state (403).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AdminLocalizationService } from '../../core/services/admin-localization.service';
import { ADMIN_ERROR_PAGE_KEY, DENIED_URL_STATE_KEY } from '../../core/auth/guards/auth.guard';

/** Kinds of admin error pages. */
export type AdminErrorPageKind = 'not-found' | 'forbidden';

/** Status code shown and the text keys (inside `error-pages`) of each kind. */
export const ADMIN_ERROR_PAGES: Record<AdminErrorPageKind, { code: string; prefix: string }> = {
  'not-found': { code: '404', prefix: 'not_found' },
  forbidden: { code: '403', prefix: 'forbidden' },
};

/**
 * @description 404 / 403 page of the admin.
 * @usage Only as a routed page (admin-routing.module.ts), with `data: { adminErrorPage: … }`.
 */
@Component({
  selector: 'app-admin-error-page',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './admin-error-page.component.html',
  styleUrls: ['./admin-error-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminErrorPageComponent {
  private readonly i18n = inject(AdminLocalizationService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Kind of the page (unknown / missing route data = 404). */
  readonly kind: AdminErrorPageKind;
  /** Status code shown in the page. */
  readonly code: string;
  /** Path the user asked for: the current URL (404) or the refused one (403); '' = unknown. */
  readonly requestedPath: string;

  constructor() {
    const value = inject(ActivatedRoute).snapshot.data?.[ADMIN_ERROR_PAGE_KEY];
    this.kind = value === 'forbidden' ? 'forbidden' : 'not-found';
    this.code = ADMIN_ERROR_PAGES[this.kind].code;
    this.requestedPath = AdminErrorPageComponent.pathOnly(this.kind === 'forbidden'
      ? (this.location.getState() as Record<string, unknown> | null)?.[DENIED_URL_STATE_KEY]
      : this.router.url);

    const cdr = inject(ChangeDetectorRef);
    this.i18n.translations$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => cdr.markForCheck());
  }

  /**
   * @description Text of the page in the current admin language.
   * @param key `title` | `message` | `hint` (kind-specific), or a common key of the section.
   */
  text(key: string): string {
    const kindKeys = ['title', 'message', 'hint'];
    const path = kindKeys.includes(key) ? `${ADMIN_ERROR_PAGES[this.kind].prefix}_${key}` : key;
    return this.i18n.getValue(`error-pages.${path}`);
  }

  /** @description Goes one step back in the browser history (the page before the refused one). */
  goBack(): void {
    this.location.back();
  }

  /**
   * @description A path without query and fragment.
   * @param value URL (unknown type: comes from the history state).
   * @returns The path, or '' for a non-string / empty value.
   */
  private static pathOnly(value: unknown): string {
    return typeof value === 'string' ? value.split(/[?#]/)[0] : '';
  }
}
