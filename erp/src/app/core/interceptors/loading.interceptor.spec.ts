/**
 * @file loading.interceptor.spec.ts
 * @path src/app/core/interceptors/loading.interceptor.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Thorough test suite of LoadingInterceptor.
 *
 * KEY ASPECTS UNDER TEST:
 *  - 500 ms debounce before the loader shows (fast requests never start it)
 *  - the `activeRequests` counter of concurrent requests (hide() is called only when the
 *    counter drops back to 0, not when ANY request finishes)
 *  - `clearTimeout` really cancels the scheduled `show()` when the request ends earlier
 *  - behaviour on an error response (finalize runs on the error path too)
 *  - IMPORTANT NUANCE: `hide()` is called even when `show()` was NEVER called (fast
 *    request) - documented as the current behaviour.
 *  - IMPORTANT NUANCE: every request has its OWN setTimeout, so with several concurrent slow
 *    requests `show()` may be called more than once (not deduplicated globally) - tested
 *    explicitly.
 *
 * Uses `fakeAsync` + `tick()`, because the interceptor works with a real `setTimeout`. Every
 * test must either finish the HTTP request (flush / error) or tick the time explicitly,
 * otherwise `fakeAsync` reports "X timer(s) still in the queue." at the end of the test.
 */

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';

import { LoadingInterceptor } from './loading.interceptor';
import { LoadingService } from '../services/loading.service';

describe('LoadingInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let loadingServiceSpy: jasmine.SpyObj<LoadingService>;

  beforeEach(() => {
    const loadingSpy = jasmine.createSpyObj('LoadingService', ['show', 'hide']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        LoadingInterceptor,
        { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
        { provide: LoadingService, useValue: loadingSpy },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    loadingServiceSpy = TestBed.inject(LoadingService) as jasmine.SpyObj<LoadingService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    const interceptor = TestBed.inject(LoadingInterceptor);
    expect(interceptor).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // Fast request (finishes before 500 ms)
  // ---------------------------------------------------------------------
  describe('fast request (< 500 ms)', () => {
    it('does NOT call loadingService.show() when the request ends before 500 ms', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');

      tick(100); // the request "takes" only 100 ms
      req.flush({});

      // Checks that show() is not called even after the rest of the original 500 ms,
      // because finalize() called clearTimeout() in the meantime.
      tick(400);

      expect(loadingServiceSpy.show).not.toHaveBeenCalled();
    }));

    it('calls loadingService.hide() even though show() was never called (current behaviour)', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');

      tick(100);
      req.flush({});
      tick(400);

      expect(loadingServiceSpy.show).not.toHaveBeenCalled();
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('clears the timeout so a later tick does not call show() even once more', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');
      req.flush({});

      tick(5000); // no delayed show() happens even after a long time
      expect(loadingServiceSpy.show).not.toHaveBeenCalled();
    }));
  });

  // ---------------------------------------------------------------------
  // Slow request (takes longer than 500 ms)
  // ---------------------------------------------------------------------
  describe('slow request (> 500 ms)', () => {
   it('calls loadingService.show() after 500 ms while the request is still running', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test'); 

      tick(500);

      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(1);

      req.flush({});
    }));

    it('calls loadingService.hide() when the slow request finishes', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');

      tick(500);
      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(1);

      tick(1000); // the request keeps "running"
      req.flush({});

      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('starts show() exactly at the 500 ms boundary, not earlier', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');

      tick(499);
      expect(loadingServiceSpy.show).not.toHaveBeenCalled();

      tick(1); // up to exactly 500 ms
      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(1);

      req.flush({});
    }));
  });

  // ---------------------------------------------------------------------
  // Concurrent requests - activeRequests counter
  // ---------------------------------------------------------------------
  describe('concurrent requests (activeRequests counter)', () => {
    it('does NOT call hide() when the FIRST of two concurrent requests finishes - only after the LAST', fakeAsync(() => {
      http.get('/first').subscribe();
      http.get('/second').subscribe();

      const reqFirst = httpMock.expectOne('/first');
      const reqSecond = httpMock.expectOne('/second');

      tick(100);
      reqFirst.flush({});

      // The second request is still running, so hide() must not be called yet.
      expect(loadingServiceSpy.hide).not.toHaveBeenCalled();

      tick(100);
      reqSecond.flush({});

      // Only now, when activeRequests dropped to 0, hide() should be called.
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('calls show() more than once for several concurrent SLOW requests (not deduplicated globally)', fakeAsync(() => {
      http.get('/first').subscribe();
      http.get('/second').subscribe();

      const reqFirst = httpMock.expectOne('/first');
      const reqSecond = httpMock.expectOne('/second');

      tick(500);

      // Every request had its own 500 ms timer, both still running -> show() twice.
      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(2);

      reqFirst.flush({});
      reqSecond.flush({});
    }));

    it('decrements activeRequests correctly for three concurrent requests finished in any order', fakeAsync(() => {
      http.get('/a').subscribe();
      http.get('/b').subscribe();
      http.get('/c').subscribe();

      const reqA = httpMock.expectOne('/a');
      const reqB = httpMock.expectOne('/b');
      const reqC = httpMock.expectOne('/c');

      reqB.flush({}); // the middle one finishes first
      expect(loadingServiceSpy.hide).not.toHaveBeenCalled();

      reqC.flush({});
      expect(loadingServiceSpy.hide).not.toHaveBeenCalled();

      reqA.flush({}); // the last remaining one
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));
  });

  // ---------------------------------------------------------------------
  // Error response - finalize must run on the error path too
  // ---------------------------------------------------------------------
  describe('error response', () => {
    it('calls hide() even when the request fails (finalize runs on the error path)', fakeAsync(() => {
      let errored = false;
      http.get('/fails').subscribe({ error: () => (errored = true) });
      const req = httpMock.expectOne('/fails');

      tick(500);
      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(1);

      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      expect(errored).toBeTrue();
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('does NOT call show() when a fast request fails before 500 ms', fakeAsync(() => {
      http.get('/fails-fast').subscribe({ error: () => {} });
      const req = httpMock.expectOne('/fails-fast');

      tick(50);
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
      tick(450);

      expect(loadingServiceSpy.show).not.toHaveBeenCalled();
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('decrements activeRequests correctly when one of two concurrent requests fails', fakeAsync(() => {
      http.get('/ok').subscribe();
      http.get('/fails').subscribe({ error: () => {} });

      const reqOk = httpMock.expectOne('/ok');
      const reqFail = httpMock.expectOne('/fails');

      reqFail.flush('error', { status: 500, statusText: 'Internal Server Error' });
      expect(loadingServiceSpy.hide).not.toHaveBeenCalled();

      reqOk.flush({});
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));
  });

  // ---------------------------------------------------------------------
  // Sequential requests (one after another, not concurrent)
  // ---------------------------------------------------------------------
  describe('sequential requests (one after another)', () => {
    it('manages show/hide independently for every request', fakeAsync(() => {
      http.get('/first').subscribe();
      let req = httpMock.expectOne('/first');
      tick(500);
      req.flush({});

      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(1);
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);

      http.get('/second').subscribe();
      req = httpMock.expectOne('/second');
      tick(500);
      req.flush({});

      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(2);
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(2);
    }));
  });
});