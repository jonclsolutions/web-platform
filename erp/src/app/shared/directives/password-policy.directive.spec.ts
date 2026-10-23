/**
 * @file password-policy.directive.spec.ts
 * @path src/app/shared/directives/password-policy.directive.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-23
 * @description Unit tests of PasswordPolicyDirective: a template-driven `ngModel` input gets the
 *   password policy (Unicode rules, finding #37) when `[appPasswordPolicy]` is true.
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule, NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { PasswordPolicyDirective } from './password-policy.directive';

@Component({
  standalone: true,
  imports: [FormsModule, PasswordPolicyDirective],
  template: `<input name="pw" [(ngModel)]="value" [appPasswordPolicy]="enabled">`,
})
class HostComponent {
  value = '';
  enabled = true;
}

describe('PasswordPolicyDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  const model = () => fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
  const set = (value: string, enabled = true) => {
    fixture.componentInstance.value = value;
    fixture.componentInstance.enabled = enabled;
    fixture.detectChanges();
    tick();
    model().control.updateValueAndValidity();
  };

  beforeEach(() => {
    fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
    fixture.detectChanges();
  });

  /**
   * @description Policy breaches set the `pattern` error, valid Unicode passwords pass, disabled checks nothing.
   * @input 'abc'; 'žluťoučký1€'; 'abc' with appPasswordPolicy false.
   * @output errors.pattern; valid; valid.
   */
  it('validates the bound model', fakeAsync(() => {
    set('abc');
    expect(model().errors?.['pattern']).toEqual({ requiredPattern: 'password-policy' });
    set('žluťoučký1€');
    expect(model().valid).toBeTrue();
    set('abc', false);
    expect(model().valid).toBeTrue();
  }));
});
