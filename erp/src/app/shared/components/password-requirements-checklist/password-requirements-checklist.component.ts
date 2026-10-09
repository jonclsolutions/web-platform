/**
 * @file password-requirements-checklist.component.ts
 * @path src/app/shared/components/password-requirements-checklist/password-requirements-checklist.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Live checklist pravidel hesla - každý požadavek (délka, písmeno, číslice,
 * speciální znak) se zvýrazní zeleně, jakmile je aktuálně zadané heslo splňuje. Čistě
 * prezentační, žádná validační logika navíc - zdroj pravdy je PASSWORD_REQUIREMENTS.
 * @usage `<app-password-requirements-checklist [password]="formData['user_password_hash']" />`
 * @dependencies
 * - AdminLocalizationService: Texts of the requirements (section `password-policy`).
 * @refactor-note (2026-10-09) i18n: requirement texts come from the admin translations
 * (`labelKey`) and follow a language switch. The component is OnPush, so it re-renders on
 * `translations$` - also covers pages outside the admin layout (account activation), where
 * the language file is only downloaded once this component asks for it. Look unchanged.
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