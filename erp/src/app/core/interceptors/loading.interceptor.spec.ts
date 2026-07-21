/**
 * @file loading.interceptor.spec.ts
 * @path src/app/core/interceptors/loading.interceptor.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Důkladná testovací sada pro LoadingInterceptor.
 *
 * KLÍČOVÉ ASPEKTY, KTERÉ TESTUJEME:
 *  - 500ms debounce před zobrazením loaderu (rychlé requesty ho vůbec nespustí)
 *  - `activeRequests` čítač u souběžných requestů (hide() se volá až když čítač
 *    klesne zpět na 0, ne po dokončení JAKÉHOKOLI requestu)
 *  - `clearTimeout` skutečně zruší naplánovaný `show()`, pokud request skončí dřív
 *  - chování při chybové odpovědi (finalize se spustí i na error cestě)
 *  - DŮLEŽITÁ NUANCE: `hide()` se zavolá i v případě, že `show()` NIKDY nebyl
 *    zavolán (rychlý request) — dokumentujeme to jako současné chování.
 *  - DŮLEŽITÁ NUANCE: každý request má svůj VLASTNÍ setTimeout, takže při více
 *    souběžných pomalých requestech se `show()` může zavolat vícekrát (není to
 *    globálně deduplikované) — otestováno explicitně.
 *
 * Používáme `fakeAsync` + `tick()`, protože interceptor pracuje s reálným
 * `setTimeout`. Každý test musí buď dotáhnout HTTP request do konce (flush/error),
 * nebo explicitně odtikat čas, jinak `fakeAsync` na konci testu nahlásí
 * "X timer(s) still in the queue."
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
  // Rychlý request (dokončí se dřív než za 500ms)
  // ---------------------------------------------------------------------
  describe('rychlý request (< 500ms)', () => {
    it('NEMĚLO by zavolat loadingService.show(), pokud request skončí před uplynutím 500ms', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');

      tick(100); // requst "trvá" jen 100ms
      req.flush({});

      // Ověříme, že ani po uplynutí zbytku původních 500ms se show() nezavolá,
      // protože finalize() mezitím zavolal clearTimeout().
      tick(400);

      expect(loadingServiceSpy.show).not.toHaveBeenCalled();
    }));

    it('by mělo zavolat loadingService.hide() i přesto, že show() nikdy nebyl zavolán (aktuální chování)', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');

      tick(100);
      req.flush({});
      tick(400);

      expect(loadingServiceSpy.show).not.toHaveBeenCalled();
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('by mělo zavolat clearTimeout tak, že pozdější tick už nevyvolá show() ani jednou navíc', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');
      req.flush({});

      tick(5000); // i po dlouhé době žádný zpožděný show() nenastane
      expect(loadingServiceSpy.show).not.toHaveBeenCalled();
    }));
  });

  // ---------------------------------------------------------------------
  // Pomalý request (trvá déle než 500ms)
  // ---------------------------------------------------------------------
  describe('pomalý request (> 500ms)', () => {
   it('by mělo zavolat loadingService.show() po uplynutí 500ms, pokud request stále běží', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test'); 

      tick(500);

      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(1);

      req.flush({});
    }));

    it('by mělo zavolat loadingService.hide() po dokončení pomalého requestu', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');

      tick(500);
      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(1);

      tick(1000); // request "běží" dál
      req.flush({});

      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('by se mělo spustit show() přesně na hraně 500ms, ne dřív', fakeAsync(() => {
      http.get('/test').subscribe();
      const req = httpMock.expectOne('/test');

      tick(499);
      expect(loadingServiceSpy.show).not.toHaveBeenCalled();

      tick(1); // dorovnání do přesně 500ms
      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(1);

      req.flush({});
    }));
  });

  // ---------------------------------------------------------------------
  // Souběžné requesty — activeRequests čítač
  // ---------------------------------------------------------------------
  describe('souběžné requesty (activeRequests čítač)', () => {
    it('NEMĚLO by zavolat hide() po dokončení PRVNÍHO ze dvou souběžných requestů — jen po dokončení POSLEDNÍHO', fakeAsync(() => {
      http.get('/first').subscribe();
      http.get('/second').subscribe();

      const reqFirst = httpMock.expectOne('/first');
      const reqSecond = httpMock.expectOne('/second');

      tick(100);
      reqFirst.flush({});

      // Pořád běží druhý request, takže by se hide() ještě neměl zavolat.
      expect(loadingServiceSpy.hide).not.toHaveBeenCalled();

      tick(100);
      reqSecond.flush({});

      // Až teď, když activeRequests kleslo na 0, by se mělo zavolat hide().
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('by mělo zavolat show() vícekrát u více souběžných POMALÝCH requestů (není globálně deduplikováno)', fakeAsync(() => {
      http.get('/first').subscribe();
      http.get('/second').subscribe();

      const reqFirst = httpMock.expectOne('/first');
      const reqSecond = httpMock.expectOne('/second');

      tick(500);

      // Každý request měl svůj vlastní 500ms timer, oba stále běží -> show() 2x.
      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(2);

      reqFirst.flush({});
      reqSecond.flush({});
    }));

    it('by mělo správně dekrementovat activeRequests i při třech souběžných requestech dokončených v libovolném pořadí', fakeAsync(() => {
      http.get('/a').subscribe();
      http.get('/b').subscribe();
      http.get('/c').subscribe();

      const reqA = httpMock.expectOne('/a');
      const reqB = httpMock.expectOne('/b');
      const reqC = httpMock.expectOne('/c');

      reqB.flush({}); // dokončí se prostřední jako první
      expect(loadingServiceSpy.hide).not.toHaveBeenCalled();

      reqC.flush({});
      expect(loadingServiceSpy.hide).not.toHaveBeenCalled();

      reqA.flush({}); // poslední zbývající
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));
  });

  // ---------------------------------------------------------------------
  // Chybová odpověď — finalize musí proběhnout i na error cestě
  // ---------------------------------------------------------------------
  describe('chybová odpověď', () => {
    it('by mělo zavolat hide(), i když request skončí chybou (finalize běží i na error cestě)', fakeAsync(() => {
      let errored = false;
      http.get('/fails').subscribe({ error: () => (errored = true) });
      const req = httpMock.expectOne('/fails');

      tick(500);
      expect(loadingServiceSpy.show).toHaveBeenCalledTimes(1);

      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      expect(errored).toBeTrue();
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('NEMĚLO by zavolat show(), pokud rychlý request selže před uplynutím 500ms', fakeAsync(() => {
      http.get('/fails-fast').subscribe({ error: () => {} });
      const req = httpMock.expectOne('/fails-fast');

      tick(50);
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
      tick(450);

      expect(loadingServiceSpy.show).not.toHaveBeenCalled();
      expect(loadingServiceSpy.hide).toHaveBeenCalledTimes(1);
    }));

    it('by mělo správně dekrementovat activeRequests, pokud jeden ze dvou souběžných requestů selže', fakeAsync(() => {
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
  // Sekvenční requesty (jeden po druhém, ne souběžně)
  // ---------------------------------------------------------------------
  describe('sekvenční requesty (jeden po druhém)', () => {
    it('by mělo nezávisle spravovat show/hide pro každý samostatný request', fakeAsync(() => {
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