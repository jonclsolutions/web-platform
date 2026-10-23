/**
 * @file turnstile.service.spec.ts
 * @path src/app/core/services/turnstile.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of TurnstileService: the Cloudflare script is injected only once and
 *   only when window.turnstile is missing, a load error rejects, render() passes the site key,
 *   theme and callbacks, reset / remove delegate (and are safe without the script).
 * @dependencies
 * - document.head.appendChild spied (no real network request), fake window.turnstile.
 */

import { TestBed } from '@angular/core/testing';

import { TurnstileService } from './turnstile.service';
import { environment } from '../../../environments/environment';

describe('TurnstileService', () => {
  let service: TurnstileService;
  let scripts: HTMLScriptElement[];
  let api: { render: jasmine.Spy; reset: jasmine.Spy; remove: jasmine.Spy };

  beforeEach(() => {
    delete (window as any).turnstile;
    scripts = [];
    spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(node: T) => { scripts.push(node as any); return node; });
    api = {
      render: jasmine.createSpy('render').and.returnValue('widget-1'),
      reset: jasmine.createSpy('reset'),
      remove: jasmine.createSpy('remove')
    };
    TestBed.configureTestingModule({});
    service = TestBed.inject(TurnstileService);
  });
  afterEach(() => delete (window as any).turnstile);

  /**
   * @description Script injected once for concurrent renders; after load render() gets the site
   *   key, dark theme and callbacks; expired / error callbacks call onExpired (optional).
   * @input Two render() calls before the script loads; script onload; callbacks invoked.
   * @output 1 async/defer script with the Cloudflare URL; both resolve 'widget-1'; callbacks wired.
   */
  it('loads the script once and renders the widget', async () => {
    const onSuccess = jasmine.createSpy('onSuccess');
    const onExpired = jasmine.createSpy('onExpired');
    const first = service.render(document.body, onSuccess, onExpired);
    const second = service.render(document.body, onSuccess);

    expect(scripts.length).toBe(1);
    expect(scripts[0].src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js');
    expect(scripts[0].async).toBeTrue();
    (window as any).turnstile = api;
    scripts[0].onload!(new Event('load'));

    expect(await first).toBe('widget-1');
    expect(await second).toBe('widget-1');
    const options = api.render.calls.first().args[1];
    expect(options.sitekey).toBe(environment.turnstileSiteKey);
    expect(options.theme).toBe('dark');
    options.callback('tok');
    options['expired-callback']();
    options['error-callback']();
    expect(onSuccess).toHaveBeenCalledWith('tok');
    expect(onExpired).toHaveBeenCalledTimes(2);
    expect(() => api.render.calls.mostRecent().args[1]['expired-callback']()).not.toThrow();

    await service.render(document.body, onSuccess);
    expect(scripts.length).toBe(1);
  });

  /**
   * @description A failed script load rejects render().
   * @input render(); script onerror.
   * @output Rejected with 'Failed to load security verification.'.
   */
  it('rejects when the script cannot be loaded', async () => {
    const result = service.render(document.body, () => undefined);
    scripts[0].onerror!(new Event('error'));
    await expectAsync(result).toBeRejectedWithError('Failed to load security verification.');
  });

  /**
   * @description reset / remove delegate to the API and are no-ops without it.
   * @input reset / remove without API; with API.
   * @output No error; api.reset('w'), api.remove('w').
   */
  it('resets and removes widgets', () => {
    expect(() => { service.reset('w'); service.remove('w'); }).not.toThrow();
    (window as any).turnstile = api;
    service.reset('w');
    service.remove('w');
    expect(api.reset).toHaveBeenCalledWith('w');
    expect(api.remove).toHaveBeenCalledWith('w');
  });
});
