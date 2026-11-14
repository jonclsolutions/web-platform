/**
 * @file activate-account.component.spec.ts
 * @path src/app/admin/auth/activate-account/activate-account.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ActivateAccountComponent – activating a new admin account from the
 *   e-mailed link: token check, setting the first password, error states and redirect to login.
 * @dependencies
 * - HttpTestingController (account-activation API), ActivatedRoute (stub with :token)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';

import { By } from '@angular/platform-browser';

import { ActivateAccountComponent } from './activate-account.component';
import { SetPasswordFormComponent, SetPasswordValue } from '../set-password-form/set-password-form.component';
import { environment } from '../../../../environments/environment';
import { createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ActivateAccountComponent', () => {
  let fixture: ComponentFixture<ActivateAccountComponent>;
  let component: ActivateAccountComponent;
  let http: HttpTestingController;
  let router: Router;
  const VALID = 'Heslo123!';
  const value: SetPasswordValue = { password: VALID, password_confirmation: VALID };
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
   * @output state 'invalid'; errorKey 'error_token_missing' (translated, finding #39); no HTTP request
   */
  it('shows invalid without token', async () => {
    await setup('');
    expect(component.state).toBe('invalid');
    expect(component.errorKey).toBe('error_token_missing');
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
    req.flush({ data: { email: 'new@x.cz', full_name: 'N' } });
    expect(component.state).toBe('form');
    expect(component.email).toBe('new@x.cz');
  });

  /**
   * @description An invalid or expired token shows the translated invalid-link text (not the English API text).
   * @input  GET answered 410 { message: 'Expired.' }
   * @output state 'invalid'; errorKey 'error_invalid_link'
   */
  it('shows the invalid-link text for a bad token', async () => {
    await setup('tok');
    http.expectOne(url('tok')).flush({ message: 'Expired.' }, { status: 410, statusText: 'Gone' });
    expect(component.state).toBe('invalid');
    expect(component.errorKey).toBe('error_invalid_link');
  });

  /**
   * @description A valid password is posted; success counts down 4 s and opens the login page.
   * @input  VALID twice; POST answered 200
   * @output POST body { password, password_confirmation }; state 'success'; navigate to the login
   *   page after 4 s
   */
  it('activates the account and redirects to login', fakeAsync(() => {
    setup('tok');
    tick();
    http.expectOne(url('tok')).flush({ data: { email: 'e', full_name: 'n' } });
    component.onSubmit(value);
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
   * @description Leaving the success page earlier (the "go to login" link) stops the countdown -
   *   it must not pull the user back to the login page later (it did, out of the admin).
   * @input success; ngOnDestroy after 1 s; 5 s more.
   * @output navigate never called.
   */
  it('stops the redirect when the page is left', fakeAsync(() => {
    setup('tok');
    tick();
    http.expectOne(url('tok')).flush({ data: { email: 'e', full_name: 'n' } });
    component.onSubmit(value);
    http.expectOne(r => r.method === 'POST').flush({});
    tick(1000);
    component.ngOnDestroy();
    tick(5000);
    expect(router.navigate).not.toHaveBeenCalled();
    component.ngOnDestroy();
  }));

  /**
   * @description Submit errors: 410 → invalid state, 422 → password not accepted, 0 → no connection.
   * @input  POST answered 410, then 422, then status 0
   * @output fieldErrorKey 'error_password_rejected'; 'error_network'; state 'invalid' with 'error_invalid_link'
   */
  it('maps submit errors', async () => {
    await setup('tok');
    http.expectOne(url('tok')).flush({ data: { email: 'e', full_name: 'n' } });
    component.onSubmit(value);
    http.expectOne(r => r.method === 'POST').flush({}, { status: 422, statusText: 'Unprocessable' });
    expect(component.fieldErrorKey).toBe('error_password_rejected');

    component.onSubmit(value);
    http.expectOne(r => r.method === 'POST').error(new ProgressEvent('error'), { status: 0 });
    expect(component.fieldErrorKey).toBe('error_network');

    component.onSubmit(value);
    http.expectOne(r => r.method === 'POST').flush({ message: 'Used already.' }, { status: 410, statusText: 'Gone' });
    expect(component.state).toBe('invalid');
    expect(component.errorKey).toBe('error_invalid_link');
  });

  /**
   * @description Other server errors give the generic message; a second submit while one runs
   *   is ignored.
   * @input POST answered 500; then submitting true, onSubmit.
   * @output fieldErrorKey 'error_generic'; no second POST.
   */
  it('reports other errors', async () => {
    await setup('tok');
    http.expectOne(url('tok')).flush({ data: { email: 'e', full_name: 'n' } });
    component.onSubmit(value);
    http.expectOne(r => r.method === 'POST').flush({}, { status: 500, statusText: 'Error' });
    expect(component.fieldErrorKey).toBe('error_generic');

    component.submitting = true;
    component.onSubmit(value);
    http.expectNone(r => r.method === 'POST');
  });

  /**
   * @description The page renders its texts from the `activate-account` translations (no English copy).
   * @input  token 'tok', form state; detectChanges(); error 'error_generic'; success state.
   * @output title / labels / submit keys; the form gets the section and the error; success text.
   */
  it('renders translated texts', async () => {
    await setup('tok');
    fixture.detectChanges();  // first render runs ngOnInit once more → answer both token checks
    http.match(url('tok')).forEach(r => r.flush({ data: { email: 'e@x.cz', full_name: 'n' } }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    for (const key of ['title_form', 'label_password', 'label_confirmation', 'submit']) {
      expect(el.textContent).toContain(`activate-account.${key}`);
    }
    expect(el.textContent).not.toContain('Set your password');

    component.fieldErrorKey = 'error_generic';
    (component as any).cd.markForCheck();
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(SetPasswordFormComponent)).componentInstance as SetPasswordFormComponent;
    expect([form.section, form.errorKey]).toEqual(['activate-account', 'error_generic']);

    component.state = 'success';
    component.redirectCountdown = 3;
    (component as any).cd.markForCheck();
    fixture.detectChanges();
    expect(el.textContent).toContain('activate-account.success_message');
  });
});
