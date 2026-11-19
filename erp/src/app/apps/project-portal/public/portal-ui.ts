/**
 * @file portal-ui.ts
 * @path src/app/apps/project-portal/public/portal-ui.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Small helpers shared by the layout and the section components of the project
 *   portal: the texts of the portal language (re-rendered after a language switch) and the date /
 *   file size formats of the portal.
 * @usage `readonly t = portalTexts();` in a component (injection context), then `t('key')` in the
 *   template; `formatPortalDate(iso, lang)`, `formatFileSize(bytes)`.
 * @dependencies ProjectPortalLocalizationService
 */

import { ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectPortalLocalizationService } from './project-portal-localization.service';

/** Text lookup of the portal language. */
export type PortalTexts = (key: string) => string;

/**
 * @description Text lookup of the portal language for an OnPush component: the component is
 *   marked for check whenever the texts change (language switch, texts loaded).
 * @returns `t(key)` - the text, or the fallback of the localization service.
 */
export function portalTexts(): PortalTexts {
  const i18n = inject(ProjectPortalLocalizationService);
  const cdr = inject(ChangeDetectorRef);
  i18n.translations$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => cdr.markForCheck());
  return (key: string) => i18n.getValue(key);
}

/**
 * @description Date (Y-m-d or ISO) in the portal language, e.g. "24. prosince 2026" / "December 24, 2026".
 * @param iso Date; empty = ''.
 * @param language Portal language ('en' = English, otherwise Czech).
 */
export function formatPortalDate(iso: string | null | undefined, language: string): string {
  if (!iso) return '';
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString(
    language === 'en' ? 'en-US' : 'cs-CZ',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

/**
 * @description Size of a file: "12 KB" below 1 MB, otherwise "1.5 MB".
 * @param bytes Size in bytes.
 */
export function formatFileSize(bytes: number): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
