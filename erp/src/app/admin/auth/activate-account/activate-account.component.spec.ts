/**
 * @file activate-account.component.spec.ts
 * @path src/app/admin/auth/activate-account/activate-account.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ActivateAccountComponent – activating a new admin account from the
 *   e-mailed link: token check, setting the first password, error states and redirect to login.
 * @dependencies
 * - HttpTestingController (account-activation API), ActivatedRoute (stub with :token)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';

import { ActivateAccountComponent } from './activate-account.component';
import { environment } from '../../../../environments/environment';
import { createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ActivateAccountComponent', () => {
  let fixture: ComponentFixture<ActivateAccountComponent>;
  let component: ActivateAccountComponent;
  let http: HttpTestingController;
  let router: Router;
  const VALID = 'Heslo123!';
  const url = (token: string) => `${environment.base_api_url}/account-activation/${encodeURIComponent(token)}`;

  const setup = async (token: string) => {
    const ctx = createAdminTestContext({ loggedIn: false });
    await TestBed.configureTestingModule({
      imports: [ActivateAccountComponent],
      providers: [...ctx.providers, {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(token ? { token } : {}) } }
      }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(ActivateAccountComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
  };

  afterEach(() => http.verify());

  /**
   * @description A missing token shows the invalid state without any request.
   * @input  route without :token
   * @output state 'invalid'; errorMessage 'The activation token is missing.'; no HTTP request
   */
  it('shows invalid without token', async () => {
    await setup('');
    expect(component.state).toBe('invalid');
    expect(component.errorMessage).toBe('The activation token is missing.');
  });

  /**
   * @description A valid token loads the account e-mail and shows the form.
   * @input  token 'tok/1'; GET returns { email: 'new@x.cz', full_name: 'N' }
   * @output GET <api>/account-activation/tok%2F1 (token URL-encoded); state 'form'; email 'new@x.cz'
   */
  it('checks the token and shows the form', async () => {
    await setup('tok/1');
    const req = http.expectOne(url('tok/1'));
    expect(req.request.method).toBe('GET');
    expect(req.request.url).toContain('tok%2F1');
    req.flush({ email: 'new@x.cz', full_name: 'N' });
    expect(component.state).toBe('form');
    expect(component.email).toBe('new@x.cz');
  });

  /**
   * @description An invalid or expired token shows the server message (or a default).
   * @input  GET answered 410 { message: 'Expired.' }
   * @output state 'invalid'; errorMessage 'Expired.'
   */
  it('shows the server message for a bad token', async () => {
    await setup('tok');
    http.expectOne(url('tok')).flush({ message: 'Expired.' }, { status: 410, statusText: 'Gone' });
    expect(component.state).toBe('invalid');
    expect(component.errorMessage).toBe('Expired.');
  });

  /**
   * @description Submit needs a policy-compliant password and an equal confirmation.
   * @input  'weak'/'weak'; VALID/'other'; VALID/VALID
   * @output canSubmit false, false (passwordsMismatch true), true
   */
  it('canSubmit follows the password rules', async () => {
    await setup('tok');
    http.expectOne(url('tok')).flush({ email: 'e', full_name: 'n' });
    component.password = 'weak'; component.passwordConfirmation = 'weak';
    expect(component.canSubmit).toBeFalse();
    component.password = VALID; component.passwordConfirmation = 'other';
    expect(component.canSubmit).toBeFalse();
    expect(component.passwordsMismatch).toBeTrue();
    component.passwordConfirmation = VALID;
    expect(component.canSubmit).toBeTrue();
  });

  /**
   * @description A valid password is posted; success counts down 4 s and opens the login page.
   * @input  VALID twice; POST answered 200
   * @output POST body { password, password_confirmation }; state 'success'; navigate(['/auth/login']) after 4 s
   */
  it('activates the account and redirects to login', fakeAsync(() => {
    setup('tok');
    tick();
    http.expectOne(url('tok')).flush({ email: 'e', full_name: 'n' });
    component.password = VALID;
    component.passwordConfirmation = VALID;
    component.onSubmit();
    const req = http.expectOne(r => r.method === 'POST');
    expect(req.request.body).toEqual({ password: VALID, password_confirmation: VALID });
    req.flush({});
    expect(component.state).toBe('success');
    tick(3000);
    expect(router.navigate).not.toHaveBeenCalled();
    tick(1000);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  }));

  /**
   * @description Submit errors: 410 → invalid state, 422 → password not accepted, 0 → no connection.
   * @input  POST answered 410, then 422, then status 0
   * @output state 'invalid'; fieldError about the password; fieldError about the connection
   */
  it('maps submit errors', async () => {
    await setup('tok');
    http.expectOne(url('tok')).flush({ email: 'e', full_name: 'n' });
    component.password = VALID;
    component.passwordConfirmation = VALID;

    component.onSubmit();
    http.expectOne(r => r.method === 'POST').flush({}, { status: 422, statusText: 'Unprocessable' });
    expect(component.fieldError).toContain('could not be accepted');

    component.onSubmit();
    http.expectOne(r => r.method === 'POST').error(new ProgressEvent('error'), { status: 0 });
    expect(component.fieldError).toContain('Unable to connect');

    component.onSubmit();
    http.expectOne(r => r.method === 'POST').flush({ message: 'Used already.' }, { status: 410, statusText: 'Gone' });
    expect(component.state).toBe('invalid');
    expect(component.errorMessage).toBe('Used already.');
  });

  /**
   * @description An invalid form is never posted.
   * @input  password 'weak'; onSubmit()
   * @output no POST request
   */
  it('does not post an invalid form', async () => {
    await setup('tok');
    http.expectOne(url('tok')).flush({ email: 'e', full_name: 'n' });
    component.password = 'weak';
    component.onSubmit();
    http.expectNone(r => r.method === 'POST');
  });
  /**
   * @description Other server errors give the generic message; the password fields can be shown.
   * @input POST answered 500; toggle both visibility switches.
   * @output fieldError 'Setting the password failed…'; showPassword / showPasswordConfirmation true.
   */
  it('reports other errors and toggles the password fields', async () => {
    await setup('tok');
    http.expectOne(url('tok')).flush({ email: 'e', full_name: 'n' });
    component.password = VALID;
    component.passwordConfirmation = VALID;
    component.onSubmit();
    http.expectOne(r => r.method === 'POST').flush({}, { status: 500, statusText: 'Error' });
    expect(component.fieldError).toContain('Setting the password failed');

    component.togglePasswordVisibility();
    component.toggleConfirmationVisibility();
    expect([component.showPassword, component.showPasswordConfirmation]).toEqual([true, true]);
  });
});
