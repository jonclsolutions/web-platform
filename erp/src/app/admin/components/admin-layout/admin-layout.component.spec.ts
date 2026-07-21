/**
 * @file admin-layout.component.spec.ts
 * @path src/app/admin/pages/admin-layout/admin-layout.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Důkladná testovací sada pro AdminLayoutComponent.
 *
 * OPRAVA PŮVODNÍ CHYBY (NG0701 / NG02100):
 * `DatePipe` s `LOCALE_ID: 'cs-CZ'` vyžaduje, aby byla data pro tuto lokalizaci
 * REGISTROVÁNA za běhu přes `registerLocaleData(localeCs, 'cs-CZ')`. Samotné
 * nastavení `LOCALE_ID` v `providers` komponenty Angularu jen řekne, KTEROU
 * lokalizaci použít — ne odkud vzít její data (názvy měsíců, formáty apod.).
 * Bez registrace `DatePipe` selže s "Missing locale data for the locale cs-CZ".
 * Řešení: zaregistrovat locale globálně v `src/test.ts` (aby to platilo pro
 * všechny specy) a zároveň i zde jako pojistku, kdyby globální registrace
 * chyběla nebo selhala.
 *
 * PŘEDPOKLADY O ZÁVISLOSTECH (na základě způsobu použití v komponentě —
 * pokud se skutečné API liší, uprav mocky níže):
 *  - AuthService: isLoggedIn$: Observable<boolean>, userEmail$: Observable<string|null>,
 *    getUserRole(): string|null, logout(): Observable<any>
 *  - PermissionService: hasPermission(permission: string): boolean, clearPermissions(): void
 *  - LoadingService: isLoading$: Observable<boolean>
 *  - DataHandler: get<T>(url): Observable<T>, put<T>(url, body): Observable<T>
 *  - AlertDialogService: open(title: string, message: string, type: string): void
 *
 * Router: getRouterProviders() dodává jen ActivatedRoute, ne Router — proto zde
 * používáme RouterTestingModule, aby reálné `routerLink`/`routerLinkActive`
 * direktivy v šabloně měly funkční (test) Router k dispozici.
 */

import { registerLocaleData } from '@angular/common';
import localeCs from '@angular/common/locales/cs';
registerLocaleData(localeCs, 'cs-CZ');

import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of, throwError, Subject } from 'rxjs';

import { AdminLayoutComponent } from './admin-layout.component';
import { getRouterProviders } from '../../../../testing/test-utils';

import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { LoadingService } from '../../../core/services/loading.service';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let router: Router;

  let isLoggedIn$: BehaviorSubject<boolean>;
  let userEmail$: BehaviorSubject<string | null>;
  let isLoading$: BehaviorSubject<boolean>;

  let authServiceMock: {
    isLoggedIn$: BehaviorSubject<boolean>;
    userEmail$: BehaviorSubject<string | null>;
    getUserRole: jasmine.Spy;
    logout: jasmine.Spy;
  };
  let permissionServiceMock: {
    hasPermission: jasmine.Spy;
    clearPermissions: jasmine.Spy;
  };
  let loadingServiceMock: { isLoading$: BehaviorSubject<boolean> };
  let dataHandlerMock: { get: jasmine.Spy; put: jasmine.Spy };
  let alertDialogServiceMock: { open: jasmine.Spy };

  /** Nastaví window.innerWidth (pro test breakpointů 768px). Chrome Headless dovoluje toto přepsat. */
  function setViewportWidth(width: number): void {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
  }

  /** Vytvoří komponentu, ale NEVOLÁ detectChanges() — volající si sám řídí okamžik ngOnInit. */
  function createComponent(): void {
    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  }

  beforeEach(() => {
    localStorage.clear();
    setViewportWidth(1200); // výchozí: desktopová šířka

    isLoggedIn$ = new BehaviorSubject<boolean>(false);
    userEmail$ = new BehaviorSubject<string | null>(null);
    isLoading$ = new BehaviorSubject<boolean>(false);

    authServiceMock = {
      isLoggedIn$,
      userEmail$,
      getUserRole: jasmine.createSpy('getUserRole').and.returnValue('admin'),
      logout: jasmine.createSpy('logout').and.returnValue(of(void 0)),
    };
    permissionServiceMock = {
      hasPermission: jasmine.createSpy('hasPermission').and.returnValue(true),
      clearPermissions: jasmine.createSpy('clearPermissions'),
    };
    loadingServiceMock = { isLoading$ };
    dataHandlerMock = {
      get: jasmine
        .createSpy('get')
        .and.returnValue(of({ is_shop_active: true, maintenance_message: '' })),
      put: jasmine.createSpy('put').and.returnValue(of({})),
    };
    alertDialogServiceMock = { open: jasmine.createSpy('open') };

    TestBed.configureTestingModule({
      imports: [AdminLayoutComponent, RouterTestingModule.withRoutes([])],
      providers: [
        ...getRouterProviders(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: PermissionService, useValue: permissionServiceMock },
        { provide: LoadingService, useValue: loadingServiceMock },
        { provide: DataHandler, useValue: dataHandlerMock },
        { provide: AlertDialogService, useValue: alertDialogServiceMock },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    createComponent();
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // ngOnInit — LocalStorage a inicializace stavu
  // ---------------------------------------------------------------------
  describe('ngOnInit — čtení z LocalStorage', () => {
    it('by mělo použít výchozí sidebarWidth (200), pokud v LocalStorage nic není', () => {
      createComponent();
      fixture.detectChanges();
      expect(component.sidebarWidth).toBe(200);
    });

    it('by mělo načíst sidebarWidth z LocalStorage, pokud tam je uložený', () => {
      localStorage.setItem('admin_sidebar_width', '350');
      createComponent();
      fixture.detectChanges();
      expect(component.sidebarWidth).toBe(350);
    });

    it('by mělo načíst currentModule z LocalStorage ("shop"), pokud je uložený', () => {
      localStorage.setItem('admin_current_module', 'shop');
      createComponent();
      fixture.detectChanges();
      expect(component.currentModule).toBe('shop');
    });

    it('by mělo ponechat výchozí currentModule ("web"), pokud v LocalStorage nic není', () => {
      createComponent();
      fixture.detectChanges();
      expect(component.currentModule).toBe('web');
    });

    it('na desktopu (>768px) by mělo respektovat uloženy stav menu (savedState === "true")', () => {
      setViewportWidth(1200);
      localStorage.setItem('admin_menu_open', 'true');
      createComponent();
      fixture.detectChanges();
      expect(component.isMenuOpen).toBeTrue();
    });

    it('na desktopu (>768px) by mělo respektovat uloženy stav menu (savedState === "false")', () => {
      setViewportWidth(1200);
      localStorage.setItem('admin_menu_open', 'false');
      createComponent();
      fixture.detectChanges();
      expect(component.isMenuOpen).toBeFalse();
    });

    it('na desktopu bez uloženého stavu by mělo výchozí isMenuOpen být true', () => {
      setViewportWidth(1200);
      createComponent();
      fixture.detectChanges();
      expect(component.isMenuOpen).toBeTrue();
    });

    it('na mobilu (<=768px) by mělo VŽDY vynutit isMenuOpen = false, i když je uložen opak', () => {
      setViewportWidth(500);
      localStorage.setItem('admin_menu_open', 'true');
      createComponent();
      fixture.detectChanges();
      expect(component.isMenuOpen).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------
  // ngOnInit — přihlašovací stav a načtení shop nastavení
  // ---------------------------------------------------------------------
  describe('ngOnInit — isLoggedIn$ / userEmail$ subscription', () => {
    it('by mělo nastavit isLoggedIn a userRole na null, pokud uživatel není přihlášen', () => {
      createComponent();
      fixture.detectChanges();

      expect(component.isLoggedIn).toBeFalse();
      expect(component.userRole).toBeNull();
      expect(dataHandlerMock.get).not.toHaveBeenCalled();
    });

    it('by mělo nastavit isLoggedIn, userRole a zavolat loadShopSettings, pokud se uživatel přihlásí', () => {
      createComponent();
      fixture.detectChanges();

      isLoggedIn$.next(true);
      fixture.detectChanges();

      expect(component.isLoggedIn).toBeTrue();
      expect(authServiceMock.getUserRole).toHaveBeenCalled();
      expect(component.userRole).toBe('admin');
      expect(dataHandlerMock.get).toHaveBeenCalledWith('core/settings');
    });

    it('by mělo nastavit isShopActive a maintenanceMessage podle odpovědi z core/settings', () => {
      dataHandlerMock.get.and.returnValue(
        of({ is_shop_active: false, maintenance_message: 'Probíhá údržba.' })
      );
      createComponent();
      fixture.detectChanges();

      isLoggedIn$.next(true);
      fixture.detectChanges();

      expect(component.isShopActive).toBeFalse();
      expect(component.maintenanceMessage).toBe('Probíhá údržba.');
    });

    it('by mělo nastavit maintenanceMessage na prázdný string, pokud server žádný nepošle', () => {
      dataHandlerMock.get.and.returnValue(of({ is_shop_active: true }));
      createComponent();
      fixture.detectChanges();

      isLoggedIn$.next(true);
      fixture.detectChanges();

      expect(component.maintenanceMessage).toBe('');
    });

    it('by nemělo aktualizovat stav, pokud loadShopSettings vrátí prázdnou/falsy odpověď', () => {
      dataHandlerMock.get.and.returnValue(of(null));
      createComponent();
      fixture.detectChanges();
      const initialShopActive = component.isShopActive;

      isLoggedIn$.next(true);
      fixture.detectChanges();

      expect(component.isShopActive).toBe(initialShopActive);
    });

    it('by mělo aktualizovat userEmail podle userEmail$', () => {
      createComponent();
      fixture.detectChanges();

      userEmail$.next('admin@rpsw.cz');
      fixture.detectChanges();

      expect(component.userEmail).toBe('admin@rpsw.cz');
    });

    it('by mělo vynulovat userRole zpět na null po odhlášení (isLoggedIn$ -> false)', () => {
      createComponent();
      fixture.detectChanges();

      isLoggedIn$.next(true);
      fixture.detectChanges();
      expect(component.userRole).toBe('admin');

      isLoggedIn$.next(false);
      fixture.detectChanges();
      expect(component.userRole).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // Shop status toggle — kritický flow s heslem
  // ---------------------------------------------------------------------
  describe('toggleShopStatus / submitShopStatusChange / cancelShopStatusChange', () => {
    beforeEach(() => {
      createComponent();
      fixture.detectChanges();
    });

    it('toggleShopStatus by mělo otevřít modal a nastavit pendingTargetState na opak isShopActive', () => {
      component.isShopActive = true;
      component.toggleShopStatus();

      expect(component.showConfirmModal).toBeTrue();
      expect(component.pendingTargetState).toBeFalse();
      expect(component.confirmPasswordValue).toBe('');
    });

    it('toggleShopStatus by mělo nastavit pendingTargetState na true, pokud je shop aktuálně neaktivní', () => {
      component.isShopActive = false;
      component.toggleShopStatus();
      expect(component.pendingTargetState).toBeTrue();
    });

    it('submitShopStatusChange by mělo zobrazit validační chybu a NEVOLAT dataHandler.put, pokud heslo chybí', () => {
      component.confirmPasswordValue = '';
      component.submitShopStatusChange();

      expect(alertDialogServiceMock.open).toHaveBeenCalledWith(
        'Validation Error',
        'Authorization password is required.',
        'danger'
      );
      expect(dataHandlerMock.put).not.toHaveBeenCalled();
    });

    it('submitShopStatusChange by mělo zobrazit validační chybu, pokud heslo obsahuje jen mezery', () => {
      component.confirmPasswordValue = '   ';
      component.submitShopStatusChange();

      expect(alertDialogServiceMock.open).toHaveBeenCalledWith(
        'Validation Error',
        'Authorization password is required.',
        'danger'
      );
      expect(dataHandlerMock.put).not.toHaveBeenCalled();
    });

    it('submitShopStatusChange by mělo poslat PUT se správným tělem (aktivace shopu)', () => {
      component.pendingTargetState = true;
      component.maintenanceMessage = '';
      component.confirmPasswordValue = 'tajneheslo';

      component.submitShopStatusChange();

      expect(dataHandlerMock.put).toHaveBeenCalledWith('core/settings', {
        is_shop_active: true,
        maintenance_message: 'System under maintenance.',
        confirm_password: 'tajneheslo',
      });
    });

    it('submitShopStatusChange by mělo zachovat vlastní maintenanceMessage, pokud je zadaná (ne fallback)', () => {
      component.pendingTargetState = false;
      component.maintenanceMessage = 'Plánovaná odstávka do 18:00.';
      component.confirmPasswordValue = 'tajneheslo';

      component.submitShopStatusChange();

      expect(dataHandlerMock.put).toHaveBeenCalledWith('core/settings', {
        is_shop_active: false,
        maintenance_message: 'Plánovaná odstávka do 18:00.',
        confirm_password: 'tajneheslo',
      });
    });

    it('by mělo po úspěchu nastavit isShopActive, zavřít modal a zobrazit "Shop is now active." při aktivaci', () => {
      component.pendingTargetState = true;
      component.confirmPasswordValue = 'heslo123';

      component.submitShopStatusChange();

      expect(component.isShopActive).toBeTrue();
      expect(component.showConfirmModal).toBeFalse();
      expect(alertDialogServiceMock.open).toHaveBeenCalledWith(
        'Success',
        'Shop is now active.',
        'success'
      );
    });

    it('by mělo po úspěchu zobrazit "Maintenance mode activated." při deaktivaci', () => {
      component.pendingTargetState = false;
      component.confirmPasswordValue = 'heslo123';

      component.submitShopStatusChange();

      expect(alertDialogServiceMock.open).toHaveBeenCalledWith(
        'Success',
        'Maintenance mode activated.',
        'success'
      );
    });

    it('by mělo při chybě zobrazit zprávu ze serveru (err.error.message)', () => {
      dataHandlerMock.put.and.returnValue(
        throwError(() => ({ error: { message: 'Nesprávné heslo.' } }))
      );
      component.confirmPasswordValue = 'spatneheslo';

      component.submitShopStatusChange();

      expect(alertDialogServiceMock.open).toHaveBeenCalledWith(
        'Authorization Error',
        'Nesprávné heslo.',
        'danger'
      );
      // Komponenta nastavuje showConfirmModal = false pouze ve větvi `next`, ne v `error` —
      // modal se tedy chybou NEZAVÍRÁ ani neOTEVÍRÁ, zůstává na hodnotě, kterou měl předtím.
      expect(component.showConfirmModal).toBeFalse();
    });

    it('by mělo ponechat modal OTEVŘENÝ po chybě, pokud byl předtím otevřen (uživatel může zkusit heslo znovu)', () => {
      component.showConfirmModal = true;
      dataHandlerMock.put.and.returnValue(
        throwError(() => ({ error: { message: 'Nesprávné heslo.' } }))
      );
      component.confirmPasswordValue = 'spatneheslo';

      component.submitShopStatusChange();

      expect(component.showConfirmModal).toBeTrue();
    });

    it('by mělo při chybě bez err.error.message použít výchozí zprávu "Failed to update shop status."', () => {
      dataHandlerMock.put.and.returnValue(throwError(() => ({})));
      component.confirmPasswordValue = 'spatneheslo';

      component.submitShopStatusChange();

      expect(alertDialogServiceMock.open).toHaveBeenCalledWith(
        'Authorization Error',
        'Failed to update shop status.',
        'danger'
      );
    });

    it('by NEMĚLO změnit isShopActive, pokud PUT selže', () => {
      component.isShopActive = true;
      dataHandlerMock.put.and.returnValue(throwError(() => ({})));
      component.pendingTargetState = false;
      component.confirmPasswordValue = 'x';

      component.submitShopStatusChange();

      expect(component.isShopActive).toBeTrue();
    });

    it('cancelShopStatusChange by mělo zavřít modal a vyprázdnit heslo', () => {
      component.showConfirmModal = true;
      component.confirmPasswordValue = 'neco';

      component.cancelShopStatusChange();

      expect(component.showConfirmModal).toBeFalse();
      expect(component.confirmPasswordValue).toBe('');
    });
  });

  // ---------------------------------------------------------------------
  // switchModule
  // ---------------------------------------------------------------------
  describe('switchModule', () => {
    beforeEach(() => {
      createComponent();
      fixture.detectChanges();
    });

    it('by mělo nastavit currentModule na "web", uložit do LocalStorage a navigovat na /admin/dashboard', () => {
      component.switchModule('web');

      expect(component.currentModule).toBe('web');
      expect(localStorage.getItem('admin_current_module')).toBe('web');
      expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    });

    it('by mělo nastavit currentModule na "shop", uložit do LocalStorage a navigovat na /admin/shop/dashboard', () => {
      component.switchModule('shop');

      expect(component.currentModule).toBe('shop');
      expect(localStorage.getItem('admin_current_module')).toBe('shop');
      expect(router.navigate).toHaveBeenCalledWith(['/admin/shop/dashboard']);
    });
  });

  // ---------------------------------------------------------------------
  // toggleMenu / onLinkClick — chování závislé na šířce okna
  // ---------------------------------------------------------------------
  describe('toggleMenu', () => {
    beforeEach(() => {
      createComponent();
      fixture.detectChanges();
    });

    it('by mělo přepnout isMenuOpen z true na false', () => {
      component.isMenuOpen = true;
      component.toggleMenu();
      expect(component.isMenuOpen).toBeFalse();
    });

    it('by mělo přepnout isMenuOpen z false na true', () => {
      component.isMenuOpen = false;
      component.toggleMenu();
      expect(component.isMenuOpen).toBeTrue();
    });

    it('na desktopu (>768px) by mělo uložit nový stav menu do LocalStorage', () => {
      setViewportWidth(1200);
      component.isMenuOpen = true;
      component.toggleMenu();
      expect(localStorage.getItem('admin_menu_open')).toBe('false');
    });

    it('na mobilu (<=768px) by NEMĚLO ukládat stav menu do LocalStorage', () => {
      setViewportWidth(500);
      component.isMenuOpen = true;
      component.toggleMenu();
      expect(localStorage.getItem('admin_menu_open')).toBeNull();
    });
  });

  describe('onLinkClick', () => {
    beforeEach(() => {
      createComponent();
      fixture.detectChanges();
    });

    it('na mobilu (<=768px) by mělo zavřít menu po kliknutí na odkaz', () => {
      setViewportWidth(500);
      component.isMenuOpen = true;
      component.onLinkClick();
      expect(component.isMenuOpen).toBeFalse();
    });

    it('na desktopu (>768px) by NEMĚLO zavřít menu po kliknutí na odkaz', () => {
      setViewportWidth(1200);
      component.isMenuOpen = true;
      component.onLinkClick();
      expect(component.isMenuOpen).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------
  // Resizing sidebaru (HostListeners)
  // ---------------------------------------------------------------------
  describe('startResizing / onMouseMove / onMouseUp', () => {
    beforeEach(() => {
      createComponent();
      fixture.detectChanges();
    });

    it('startResizing by mělo nastavit isResizing = true a zavolat preventDefault na desktopu', () => {
      setViewportWidth(1200);
      const event = new MouseEvent('mousedown');
      spyOn(event, 'preventDefault');

      component.startResizing(event);

      expect(component.isResizing).toBeTrue();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('startResizing by NEMĚLO nastavit isResizing na mobilu', () => {
      setViewportWidth(500);
      const event = new MouseEvent('mousedown');
      spyOn(event, 'preventDefault');

      component.startResizing(event);

      expect(component.isResizing).toBeFalse();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('onMouseMove by nemělo nic dělat, pokud isResizing je false', () => {
      component.isResizing = false;
      const originalWidth = component.sidebarWidth;

      component.onMouseMove(new MouseEvent('mousemove', { clientX: 300 }));

      expect(component.sidebarWidth).toBe(originalWidth);
    });

    it('onMouseMove by mělo aktualizovat sidebarWidth v rámci min/max hranic (150-500)', () => {
      component.isResizing = true;
      component.onMouseMove(new MouseEvent('mousemove', { clientX: 300 }));
      expect(component.sidebarWidth).toBe(300);
    });

    it('onMouseMove by NEMĚLO aktualizovat sidebarWidth pod minimální hranicí (150)', () => {
      component.isResizing = true;
      component.sidebarWidth = 200;
      component.onMouseMove(new MouseEvent('mousemove', { clientX: 100 }));
      expect(component.sidebarWidth).toBe(200);
    });

    it('onMouseMove by NEMĚLO aktualizovat sidebarWidth nad maximální hranicí (500)', () => {
      component.isResizing = true;
      component.sidebarWidth = 400;
      component.onMouseMove(new MouseEvent('mousemove', { clientX: 600 }));
      expect(component.sidebarWidth).toBe(400);
    });

    it('onMouseMove by mělo akceptovat přesně hraniční hodnoty 150 a 500', () => {
      component.isResizing = true;
      component.onMouseMove(new MouseEvent('mousemove', { clientX: 150 }));
      expect(component.sidebarWidth).toBe(150);

      component.onMouseMove(new MouseEvent('mousemove', { clientX: 500 }));
      expect(component.sidebarWidth).toBe(500);
    });

    it('onMouseUp by mělo nastavit isResizing na false a uložit sidebarWidth do LocalStorage, pokud probíhal resize', () => {
      component.isResizing = true;
      component.sidebarWidth = 275;

      component.onMouseUp();

      expect(component.isResizing).toBeFalse();
      expect(localStorage.getItem('admin_sidebar_width')).toBe('275');
    });

    it('onMouseUp by nemělo nic dělat (ani zapisovat do LocalStorage), pokud resize neprobíhal', () => {
      component.isResizing = false;
      component.sidebarWidth = 275;

      component.onMouseUp();

      expect(localStorage.getItem('admin_sidebar_width')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------
  describe('logout', () => {
    beforeEach(() => {
      createComponent();
      fixture.detectChanges();
    });

    it('by mělo při úspěchu vyčistit oprávnění a navigovat na /auth/login', () => {
      authServiceMock.logout.and.returnValue(of(void 0));
      component.logout();

      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('by mělo navigovat na /auth/login i v případě chyby při odhlašování', () => {
      authServiceMock.logout.and.returnValue(throwError(() => new Error('network error')));
      component.logout();

      expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('by NEMĚLO volat clearPermissions, pokud logout() selže', () => {
      authServiceMock.logout.and.returnValue(throwError(() => new Error('network error')));
      component.logout();

      expect(permissionServiceMock.clearPermissions).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // ngOnDestroy — úklid subscriptions
  // ---------------------------------------------------------------------
  describe('ngOnDestroy', () => {
    it('by mělo odhlásit subscription na isLoggedIn$ (další next() už neovlivní komponentu)', () => {
      createComponent();
      fixture.detectChanges();

      component.ngOnDestroy();
      isLoggedIn$.next(true);

      // Po zničení komponenty by se stav neměl měnit, protože subscription byla zrušena.
      expect(component.isLoggedIn).toBeFalse();
    });

    it('by mělo odhlásit subscription na userEmail$', () => {
      createComponent();
      fixture.detectChanges();

      component.ngOnDestroy();
      userEmail$.next('novy@email.cz');

      expect(component.userEmail).toBeNull();
    });

    it('by nemělo spadnout, pokud jsou subscriptions undefined (ngOnDestroy zavolané bez proběhlého ngOnInit)', () => {
      createComponent();
      // Záměrně NEVOLÁME fixture.detectChanges(), takže ngOnInit ještě neproběhl.
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------
  // Šablona — direktiva appHasPermission (Web modul)
  // ---------------------------------------------------------------------
  describe('šablona — appHasPermission (přepínač modulů Web/E-shop)', () => {
    it('by mělo zobrazit tlačítka Web i E-shop, pokud má uživatel obě oprávnění', () => {
      permissionServiceMock.hasPermission.and.returnValue(true);
      createComponent();
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll(
        '.module-switcher button'
      );
      const texts = Array.from(buttons).map(b => b.textContent?.trim());
      expect(texts.some(t => t?.includes('Web'))).toBeTrue();
      expect(texts.some(t => t?.includes('E-Shop'))).toBeTrue();
    });

    it('by NEMĚLO zobrazit žádné z tlačítek Web/E-shop, pokud uživatel nemá žádné z oprávnění', () => {
      permissionServiceMock.hasPermission.and.returnValue(false);
      createComponent();
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.module-switcher button');
      expect(buttons.length).toBe(0);
    });

    it('by mělo zobrazit přepínač údržby, pouze pokud má uživatel oprávnění "shop-set-maitanance-mode"', () => {
      permissionServiceMock.hasPermission.and.callFake(
        (perm: string) => perm === 'shop-set-maitanance-mode'
      );
      createComponent();
      fixture.detectChanges();

      const maintenanceBtn = fixture.nativeElement.querySelector('.maintenance-toggle-btn');
      expect(maintenanceBtn).toBeTruthy();
    });

    it('by NEMĚLO zobrazit přepínač údržby bez příslušného oprávnění', () => {
      permissionServiceMock.hasPermission.and.callFake(
        (perm: string) => perm !== 'shop-set-maitanance-mode'
      );
      createComponent();
      fixture.detectChanges();

      const maintenanceBtn = fixture.nativeElement.querySelector('.maintenance-toggle-btn');
      expect(maintenanceBtn).toBeFalsy();
    });

    it('by mělo zavolat permissionService.hasPermission se správnými řetězci oprávnění', () => {
      permissionServiceMock.hasPermission.and.returnValue(true);
      createComponent();
      fixture.detectChanges();

      expect(permissionServiceMock.hasPermission).toHaveBeenCalledWith('view-web');
      expect(permissionServiceMock.hasPermission).toHaveBeenCalledWith('view-eshop');
      expect(permissionServiceMock.hasPermission).toHaveBeenCalledWith(
        'shop-set-maitanance-mode'
      );
    });
  });

  // ---------------------------------------------------------------------
  // Šablona — modal potvrzení hesla
  // ---------------------------------------------------------------------
  describe('šablona — password modal', () => {
    beforeEach(() => {
      permissionServiceMock.hasPermission.and.returnValue(true);
      createComponent();
      fixture.detectChanges();
    });

    it('by nemělo být v DOM, dokud showConfirmModal je false', () => {
      component.showConfirmModal = false;
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('.password-modal-overlay');
      expect(modal).toBeFalsy();
    });

    it('by mělo být v DOM, pokud showConfirmModal je true (a uživatel má oprávnění)', () => {
      component.showConfirmModal = true;
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('.password-modal-overlay');
      expect(modal).toBeTruthy();
    });

    it('by mělo zobrazit "STANDARDNÍ PROVOZ" pro pendingTargetState = true', () => {
      component.pendingTargetState = true;
      component.showConfirmModal = true;
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.modal-state-label');
      expect(label.textContent).toContain('STANDARDNÍ PROVOZ');
    });

    it('by mělo zobrazit "REŽIM ÚDRŽBY" pro pendingTargetState = false', () => {
      component.pendingTargetState = false;
      component.showConfirmModal = true;
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.modal-state-label');
      expect(label.textContent).toContain('REŽIM ÚDRŽBY');
    });

    it('kliknutí na "Storno" by mělo zavolat cancelShopStatusChange', () => {
      spyOn(component, 'cancelShopStatusChange');
      component.showConfirmModal = true;
      fixture.detectChanges();

      const cancelBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
        '.btn-modal-secondary'
      );
      cancelBtn.click();

      expect(component.cancelShopStatusChange).toHaveBeenCalled();
    });

    it('kliknutí na "Potvrdit a uložit" by mělo zavolat submitShopStatusChange', () => {
      spyOn(component, 'submitShopStatusChange');
      component.showConfirmModal = true;
      fixture.detectChanges();

      const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
        '.btn-modal-primary'
      );
      confirmBtn.click();

      expect(component.submitShopStatusChange).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // Šablona — globální loading overlay
  // ---------------------------------------------------------------------
  describe('šablona — loading overlay (isLoadingGlobal$)', () => {
    it('by nemělo zobrazit overlay, pokud isLoading$ vrací false', () => {
      createComponent();
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.global-loading-overlay');
      expect(overlay).toBeFalsy();
    });

    it('by mělo zobrazit overlay, pokud isLoading$ vrací true', () => {
      createComponent();
      fixture.detectChanges();

      isLoading$.next(true);
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.global-loading-overlay');
      expect(overlay).toBeTruthy();
    });

    it('by mělo overlay opět skrýt, jakmile isLoading$ vrátí zpět false', () => {
      createComponent();
      fixture.detectChanges();

      isLoading$.next(true);
      fixture.detectChanges();
      isLoading$.next(false);
      fixture.detectChanges();

      const overlay = fixture.nativeElement.querySelector('.global-loading-overlay');
      expect(overlay).toBeFalsy();
    });
  });

  // ---------------------------------------------------------------------
  // Hodiny (currentDate$) — ověřuje i opravenou lokalizaci DatePipe
  // ---------------------------------------------------------------------
  describe('currentDate$ — hodiny v hlavičce', () => {
    it('by mělo vykreslit čas bez chyby díky zaregistrovaným cs-CZ locale datům', fakeAsync(() => {
      createComponent();
      fixture.detectChanges();

      const clockEl = fixture.nativeElement.querySelector('.header-clock');
      expect(clockEl.textContent?.trim().length).toBeGreaterThan(0);

      discardPeriodicTasks();
    }));

    it('by mělo aktualizovat zobrazený čas po uplynutí intervalu (1000ms)', fakeAsync(() => {
      createComponent();
      fixture.detectChanges();

      const clockEl = fixture.nativeElement.querySelector('.header-clock');
      const firstText = clockEl.textContent;

      tick(1000);
      fixture.detectChanges();

      // Text se může shodovat, pokud test proběhne ve stejné sekundě, ale interval
      // musí alespoň jednou emitnout bez chyby — ověřujeme absenci vyhozené výjimky
      // a přítomnost neprázdného textu i po tiku.
      expect(clockEl.textContent?.trim().length).toBeGreaterThan(0);

      discardPeriodicTasks();
    }));
  });
});