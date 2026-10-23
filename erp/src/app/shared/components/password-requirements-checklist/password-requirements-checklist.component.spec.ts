/**
 * @file password-requirements-checklist.component.spec.ts
 * @path src/app/shared/components/password-requirements-checklist/password-requirements-checklist.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PasswordRequirementsChecklistComponent: one item per requirement
 *   with translated label ({min} / {max} filled), "met" state following the password input and
 *   re-render when translations arrive (OnPush).
 * @dependencies
 * - AdminLocalizationService stub (createI18nStub; getValue overridden per test).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PasswordRequirementsChecklistComponent } from './password-requirements-checklist.component';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { createI18nStub, I18nStub } from '../../../../testing/admin-test-helpers';

describe('PasswordRequirementsChecklistComponent', () => {
  let fixture: ComponentFixture<PasswordRequirementsChecklistComponent>;
  let i18n: I18nStub;
  const items = () => Array.from(fixture.nativeElement.querySelectorAll('li')) as HTMLElement[];

  beforeEach(() => {
    i18n = createI18nStub();
    i18n.getValue.and.callFake((key: string) => (key === 'password-policy.length' ? '{min}-{max} chars' : key));
    TestBed.configureTestingModule({
      imports: [PasswordRequirementsChecklistComponent],
      providers: [{ provide: AdminLocalizationService, useValue: i18n }]
    });
    fixture = TestBed.createComponent(PasswordRequirementsChecklistComponent);
    fixture.detectChanges();
  });

  /**
   * @description Labels and met state per requirement for the given password.
   * @input password '' then 'abcdefg1'.
   * @output 4 items, none met, first label '8-16 chars'; then length / letter / digit met, special not.
   */
  it('shows each requirement and whether it is met', () => {
    expect(items().length).toBe(4);
    expect(items()[0].textContent!.trim()).toBe('8-16 chars');
    expect(items().filter(li => li.classList.contains('met')).length).toBe(0);

    fixture.componentRef.setInput('password', 'abcdefg1');
    fixture.detectChanges();
    expect(items().map(li => li.classList.contains('met'))).toEqual([true, true, true, false]);
  });

  /**
   * @description New translations re-render the OnPush labels; a null password counts as ''.
   * @input getValue changed + translations$ emits; password null.
   * @output First label 'Délka'; nothing met.
   */
  it('re-renders when translations change', () => {
    i18n.getValue.and.callFake((key: string) => (key === 'password-policy.length' ? 'Délka' : key));
    i18n.translations$.next({ changed: true });
    fixture.detectChanges();
    expect(items()[0].textContent!.trim()).toBe('Délka');

    fixture.componentRef.setInput('password', null);
    fixture.detectChanges();
    expect(items().some(li => li.classList.contains('met'))).toBeFalse();
  });
});
