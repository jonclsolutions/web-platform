/**
 * @file admin-date.pipe.ts
 * @path src/app/admin/shared-date/admin-date.pipe.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description `adminDate` pipe - a date in the ONE format of the administration (see
 *   admin-date-format.ts) and in the locale of the admin language; '' for an empty value.
 * @usage `{{ order.paid_at | adminDate:'datetime' }}`, `{{ release.date | adminDate }}` (date only).
 * @note Not pure: the result follows a switch of the admin language without a new input value
 *   (the formatting is cheap - DatePipe with a cached locale).
 * @dependencies AdminLocalizationService, DatePipe.
 */

import { Pipe, PipeTransform, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminLocalizationService } from '../../core/services/admin-localization.service';
import { AdminDateKind, adminDateFormat } from './admin-date-format';

@Pipe({ name: 'adminDate', standalone: true, pure: false })
export class AdminDatePipe implements PipeTransform {
  private readonly i18n = inject(AdminLocalizationService);

  /**
   * @description Formats a date of the administration.
   * @param value Date, ISO text or timestamp.
   * @param kind 'date' (default), 'datetime' or 'datetime_seconds'.
   * @returns Formatted date, '' when empty or invalid.
   */
  transform(value: string | number | Date | null | undefined, kind: AdminDateKind = 'date'): string {
    if (value === null || value === undefined || value === '') return '';
    try {
      return new DatePipe(this.i18n.getDateLocale()).transform(value, adminDateFormat(this.i18n, kind)) ?? '';
    } catch {
      return '';
    }
  }
}
