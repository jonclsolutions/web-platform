/**
 * @file password-requirements-checklist.component.ts
 * @path src/app/shared/components/password-requirements-checklist/password-requirements-checklist.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Live checklist of the password rules - every requirement (length, letter, digit,
 * special character) turns green as soon as the typed password meets it. Purely presentational,
 * no extra validation logic - the source of truth is PASSWORD_REQUIREMENTS.
 * @usage `<app-password-requirements-checklist [password]="formData['user_password_hash']" />`
 * @dependencies
 * - AdminLocalizationService: Texts of the requirements (section `password-policy`).
 */

import { Component, Input, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PASSWORD_REQUIREMENTS, PasswordRequirement, fillPasswordLimits } from '../../constants/password-policy';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

@Component({
  selector: 'app-password-requirements-checklist',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './password-requirements-checklist.component.html',
  styleUrl: './password-requirements-checklist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PasswordRequirementsChecklistComponent {
  @Input() password: string = '';

  readonly requirements: PasswordRequirement[] = PASSWORD_REQUIREMENTS;

  private readonly i18n = inject(AdminLocalizationService);

  constructor() {
    const cd = inject(ChangeDetectorRef);
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => cd.markForCheck());
  }

  isMet(req: PasswordRequirement): boolean {
    return req.test(this.password || '');
  }

  /**
   * @description Requirement text in the current admin language, length limits filled in.
   * @param req Requirement from PASSWORD_REQUIREMENTS.
   * @returns Translated text.
   */
  label(req: PasswordRequirement): string {
    return fillPasswordLimits(this.i18n.getValue(req.labelKey));
  }
}