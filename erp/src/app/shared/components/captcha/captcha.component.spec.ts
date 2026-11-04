/**
 * @file captcha.component.spec.ts
 * @path src/app/shared/components/captcha/captcha.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of CaptchaComponent (invisible bot protection of the public forms):
 *   invisible Turnstile render, token on submit (immediate / awaited / unavailable / timeout),
 *   reset after a refusal, honeypot field, load error text and removal of the widget (also when
 *   it finishes rendering after the form was closed).
 * @dependencies
 * - TurnstileService replaced by spies (no Cloudflare script in a test).
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CAPTCHA_TOKEN_TIMEOUT_MS, CaptchaComponent, HONEYPOT_FIELD } from './captcha.component';
import { TurnstileService } from '../../../core/services/turnstile.service';
import { CaptchaUnavailableError } from '../../utils/public-form-errors';

describe('CaptchaComponent', () => {
  let fixture: ComponentFixture<CaptchaComponent>;
  let component: CaptchaComponent;
  let turnstile: { render: jasmine.Spy; reset: jasmine.Spy; remove: jasmine.Spy };

  /** Creates the component; `render` is the answer of TurnstileService.render(). */
  function create(render: Promise<string>): void {
    turnstile = {
      render: jasmine.createSpy('render').and.returnValue(render),
      reset: jasmine.createSpy('reset'),
      remove: jasmine.createSpy('remove')
    };
    TestBed.configureTestingModule({ imports: [CaptchaComponent], providers: [{ provide: TurnstileService, useValue: turnstile }] });
    fixture = TestBed.createComponent(CaptchaComponent);
    component = fixture.componentInstance;
    component.loadErrorText = 'No captcha';
    fixture.detectChanges();
  }

  /** Callback arguments of the render() call: [onSuccess, onExpired]. */
  const callbacks = () => turnstile.render.calls.mostRecent().args.slice(1, 3) as [(t: string) => void, () => void];

  /**
   * @description Invisible widget; nextToken() waits for the background check and emits at once
   *   when it is done; expiry and reset() drop the token (reset also restarts the check); the
   *   honeypot is hidden from people and its value is sent; destroy removes the widget.
   * @input render 'w1'; nextToken before / after the success callback; expired; reset; destroy.
   * @output render(container, …, {auto, interaction-only}); tokens 'tok' (awaited) and 'tok'
   *   (immediate); no token after expiry / reset; reset('w1'); FormData captcha_token + website; remove('w1').
   */
  it('supplies the token of the invisible check', async () => {
    create(Promise.resolve('w1'));
    await fixture.whenStable();
    const [container, , , options] = turnstile.render.calls.mostRecent().args;
    expect(container).toBe(fixture.nativeElement.querySelector('.captcha-widget'));
    expect(options).toEqual({ theme: 'auto', appearance: 'interaction-only' });
    const [onSuccess, onExpired] = callbacks();

    const got: string[] = [];
    component.nextToken().subscribe(t => got.push(t));
    expect(got).toEqual([]);
    onSuccess('tok');
    component.nextToken().subscribe(t => got.push(t));
    expect(got).toEqual(['tok', 'tok']);

    onExpired();
    const late: string[] = [];
    const sub = component.nextToken().subscribe(t => late.push(t));
    component.reset();
    expect(late).toEqual([]);
    expect(turnstile.reset).toHaveBeenCalledWith('w1');
    sub.unsubscribe();

    const trap = fixture.nativeElement.querySelector('input[name="website"]') as HTMLInputElement;
    expect(HONEYPOT_FIELD).toBe('website');
    expect(trap.tabIndex).toBe(-1);
    expect(trap.getAttribute('autocomplete')).toBe('off');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    trap.value = 'bot';
    const fd = new FormData();
    component.appendTo(fd, 'tok');
    expect([fd.get('captcha_token'), fd.get('website')]).toEqual(['tok', 'bot']);

    fixture.destroy();
    expect(turnstile.remove).toHaveBeenCalledWith('w1');
  });

  /**
   * @description A script that cannot be loaded shows the translated error; a waiting and a later
   *   nextToken() fail with CaptchaUnavailableError; reset() does not touch the widget.
   * @input nextToken() before the load fails; render rejects; nextToken() after.
   * @output '.captcha-error' 'No captcha'; two CaptchaUnavailableError; no turnstile.reset.
   */
  it('reports a captcha that cannot be loaded', async () => {
    let reject!: (e: Error) => void;
    create(new Promise<string>((_, r) => (reject = r)));
    const errors: unknown[] = [];
    component.nextToken().subscribe({ error: e => errors.push(e) });
    reject(new Error('blocked'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.captcha-error').textContent.trim()).toBe('No captcha');
    component.nextToken().subscribe({ error: e => errors.push(e) });
    expect(errors.length).toBe(2);
    expect(errors.every(e => e instanceof CaptchaUnavailableError)).toBeTrue();
    component.reset();
    expect(turnstile.reset).not.toHaveBeenCalled();
  });

  /**
   * @description A check that gives no token within the limit fails with CaptchaUnavailableError.
   * @input nextToken(); no callback for CAPTCHA_TOKEN_TIMEOUT_MS.
   * @output CaptchaUnavailableError.
   */
  it('gives up after the timeout', fakeAsync(() => {
    create(Promise.resolve('w1'));
    tick();
    let error: unknown;
    component.nextToken().subscribe({ error: e => (error = e) });
    tick(CAPTCHA_TOKEN_TIMEOUT_MS);
    expect(error instanceof CaptchaUnavailableError).toBeTrue();
    fixture.destroy();
  }));

  /**
   * @description A widget finishing its render after the form was closed is removed at once.
   * @input Destroy before render resolves 'late'.
   * @output remove('late').
   */
  it('removes a widget rendered after destroy', async () => {
    let resolve!: (id: string) => void;
    create(new Promise<string>(r => (resolve = r)));
    fixture.destroy();
    resolve('late');
    await Promise.resolve();
    await Promise.resolve();
    expect(turnstile.remove).toHaveBeenCalledWith('late');
  });
});
