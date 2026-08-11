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
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PASSWORD_REQUIREMENTS, PasswordRequirement } from '../../constants/password-policy';

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

  isMet(req: PasswordRequirement): boolean {
    return req.test(this.password || '');
  }
}