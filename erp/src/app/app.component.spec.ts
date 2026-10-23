/**
 * @file app.component.spec.ts
 * @path src/app/app.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Unit tests of AppComponent (root shell): session check on start, favicon from
 *   the site logo (created once, then updated), the initial loader fades out and is removed
 *   once the app is stable, and the router outlet.
 * @refactor-note (2026-10-23) The old spec mocked `PublicDataService.get('public/legal/config')`,
 *   which the component no longer calls (settings come through `siteSettingsValue$`, filled by
 *   AppBootstrapService) - three tests failed on `undefined.subscribe`. Rewritten to the real
 *   contract.
 * @dependencies
 * - AuthService / PublicDataService stubs; ApplicationRef.isStable replaced by a Subject.
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { AppComponent } from './app.component';
import { AuthService } from './core/auth/auth.service';
import { PublicDataService } from './shared/services/public-data.service';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let auth: { checkAuth: jasmine.Spy };
  let settings$: BehaviorSubject<any>;
  let stable$: Subject<boolean>;

  beforeEach(() => {
    document.getElementById('dynamic-favicon')?.remove();
    auth = { checkAuth: jasmine.createSpy('checkAuth').and.returnValue(of(true)) };
    settings$ = new BehaviorSubject<any>(null);
    stable$ = new Subject<boolean>();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: PublicDataService, useValue: { siteSettingsValue$: settings$, getStorageUrl: (p: string) => `/storage/${p}` } }
      ]
    });
    Object.defineProperty(TestBed.inject(ApplicationRef), 'isStable', { value: stable$ });
    fixture = TestBed.createComponent(AppComponent);
  });
  afterEach(() => {
    document.getElementById('dynamic-favicon')?.remove();
    document.getElementById('initial-loader')?.remove();
  });

  /**
   * @description Start: session checked, router outlet rendered.
   * @input detectChanges().
   * @output checkAuth called once; <router-outlet> present.
   */
  it('checks the session and renders the router outlet', () => {
    fixture.detectChanges();
    expect(auth.checkAuth).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });

  /**
   * @description Favicon follows the site logo; one <link> element reused; settings without a
   *   logo do not touch it.
   * @input settings null; logo 'a.png'; logo 'b.png'; settings without logo.
   * @output No link; one #dynamic-favicon rel icon href …/storage/a.png → …/b.png; still b.png.
   */
  it('sets the favicon from the site logo', () => {
    fixture.detectChanges();
    expect(document.getElementById('dynamic-favicon')).toBeNull();

    settings$.next({ settings: { logo_path: 'a.png' } });
    const link = document.getElementById('dynamic-favicon') as HTMLLinkElement;
    expect(link.rel).toBe('icon');
    expect(link.href).toContain('/storage/a.png');

    settings$.next({ settings: { logo_path: 'b.png' } });
    settings$.next({ settings: {} });
    expect(document.querySelectorAll('#dynamic-favicon').length).toBe(1);
    expect(link.href).toContain('/storage/b.png');
  });

  /**
   * @description The initial loader fades out at the first stable state and is removed after
   *   its transition; a missing loader is fine.
   * @input #initial-loader present; isStable false, true; transitionend. Second app without loader.
   * @output 'fade-out' only after true; element removed after transitionend; no error.
   */
  it('removes the initial loader once the app is stable', () => {
    const loader = document.createElement('div');
    loader.id = 'initial-loader';
    document.body.appendChild(loader);

    fixture.detectChanges();
    stable$.next(false);
    expect(loader.classList.contains('fade-out')).toBeFalse();
    stable$.next(true);
    expect(loader.classList.contains('fade-out')).toBeTrue();
    expect(document.getElementById('initial-loader')).not.toBeNull();
    loader.dispatchEvent(new Event('transitionend'));
    expect(document.getElementById('initial-loader')).toBeNull();

    const second = TestBed.createComponent(AppComponent);
    second.detectChanges();
    expect(() => stable$.next(true)).not.toThrow();
  });
});
