/**
 * @file login.component.spec.ts
 * @path src/app/admin/auth/login/login.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Opravená testovací sada pro LoginComponent.
 *
 * OPRAVA (v2): Přidán mock pro ActivatedRoute do providers.
 * RouterLink direktiva ho interně vyžaduje i přesto, že šablona
 * `routerLink` používá jen na statických odkazech (a="/home").
 * Strohý spy na Router nestačí — Angular DI se pokusí vytvořit
 * RouterLink, který si vyžádá ActivatedRoute, a test selže s NG0201.
 *
 * OPRAVA (v3): Přidána vlastnost `events` (Observable) do routerMock.
 * RouterLink si ve svém konstruktoru interně volá
 * `this.router.events.subscribe(...)`. Pokud mock Routeru tuto
 * vlastnost neobsahuje, volání selže s chybou
 * "Cannot read properties of undefined (reading 'subscribe')"
 * hned při `fixture.detectChanges()` v beforeEach — což způsobovalo
 * pád úplně všech testů v této sadě (i "should create").
 *
 * Řešení: poskytneme minimální fake ActivatedRoute (snapshot + params + queryParams)
 * a doplníme `events: of()` do routerMock.
 */

import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { ActivatedRoute, Router, UrlTree } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService }    from '../../../core/auth/auth.service';

// ── Pomocná funkce pro minimální ActivatedRoute mock ─────────────────────────
// Kopíruje vzor z test-utils.ts ze zadání, ale je definována inline,
// aby spec soubor byl soběstačný.
function fakeActivatedRoute() {
  return {
    provide: ActivatedRoute,
    useValue: {
      snapshot:    { paramMap: { get: () => null } },
      params:      of({}),
      queryParams: of({}),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture:   ComponentFixture<LoginComponent>;

  let authServiceMock: { login: jasmine.Spy };
  let routerMock: {
    navigate:      jasmine.Spy;
    createUrlTree: jasmine.Spy;
    serializeUrl:  jasmine.Spy;
    events:        ReturnType<typeof of>;
  };

  // ── Setup ─────────────────────────────────────────────────────────────────
  beforeEach(async () => {
    authServiceMock = {
      login: jasmine.createSpy('login').and.returnValue(of({ token: 'abc123' })),
    };

    routerMock = {
      navigate:      jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
      createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue({} as UrlTree),
      serializeUrl:  jasmine.createSpy('serializeUrl').and.returnValue('/home'),
      // ✅ OPRAVA: RouterLink interně volá router.events.subscribe(...)
      // v konstruktoru — bez toho padá NG i na statických odkazech.
      events: of(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService,  useValue: authServiceMock },
        { provide: Router,       useValue: routerMock },
        // ✅ OPRAVA: ActivatedRoute je vyžadován RouterLink direktivou
        fakeActivatedRoute(),
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Smoke test ────────────────────────────────────────────────────────────
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('by mělo mít výchozí prázdný stav formuláře', () => {
    expect(component.email).toBe('');
    expect(component.password).toBe('');
    expect(component.errorMessage).toBe('');
    expect(component.showPassword).toBeFalse();
    expect(component.showForgotModal).toBeFalse();
  });

  // ── onLogin ───────────────────────────────────────────────────────────────
  describe('onLogin', () => {
    it('by mělo zavolat authService.login se zadaným emailem a heslem', () => {
      component.email    = 'admin@rpsw.cz';
      component.password = 'tajneheslo';

      component.onLogin();

      expect(authServiceMock.login).toHaveBeenCalledOnceWith({
        email:    'admin@rpsw.cz',
        password: 'tajneheslo',
      });
    });

    it('by mělo před voláním vynulovat předchozí errorMessage', () => {
      component.errorMessage = 'Předchozí chyba.';
      component.email        = 'a@b.cz';
      component.password     = 'x';

      component.onLogin();

      expect(component.errorMessage).toBe('');
    });

    it('by mělo po úspěšném přihlášení navigovat na /admin/dashboard', () => {
      component.email    = 'admin@rpsw.cz';
      component.password = 'tajneheslo';

      component.onLogin();

      expect(routerMock.navigate).toHaveBeenCalledOnceWith(['/admin/dashboard']);
    });

    it('by NEMĚLO navigovat, pokud login selže', () => {
      authServiceMock.login.and.returnValue(
        throwError(() => new Error('Neplatné údaje.'))
      );
      component.email    = 'a@b.cz';
      component.password = 'spatne';

      component.onLogin();

      expect(routerMock.navigate).not.toHaveBeenCalled();
    });

    it('by mělo při chybě nastavit errorMessage z error.message', () => {
      authServiceMock.login.and.returnValue(
        throwError(() => new Error('Neplatné přihlašovací údaje.'))
      );
      component.email    = 'a@b.cz';
      component.password = 'spatne';

      component.onLogin();

      expect(component.errorMessage).toBe('Neplatné přihlašovací údaje.');
    });

    it('by mělo při chybě bez error.message použít výchozí zprávu "Incorrect credentials."', () => {
      // Hážeme plain object bez .message — fallback logika || 'Incorrect credentials.'
      authServiceMock.login.and.returnValue(throwError(() => ({})));
      component.email    = 'a@b.cz';
      component.password = 'spatne';

      component.onLogin();

      expect(component.errorMessage).toBe('Incorrect credentials.');
    });

    it('by mělo po chybě zobrazit chybovou hlášku v šabloně (ověřuje volání cdr.detectChanges)', () => {
      authServiceMock.login.and.returnValue(
        throwError(() => new Error('Účet je zablokován.'))
      );
      component.email    = 'a@b.cz';
      component.password = 'spatne';

      component.onLogin();
      // Komponenta volá this.cdr.detectChanges() uvnitř error handleru —
      // DOM je tedy aktualizovaný bez nutnosti volat fixture.detectChanges() znovu.
      const errorEl: HTMLElement | null =
        fixture.nativeElement.querySelector('.error-message');

      expect(errorEl).toBeTruthy();
      expect(errorEl!.textContent).toContain('Účet je zablokován.');
    });

    it('by nemělo zobrazovat chybovou hlášku, dokud onLogin neselže', () => {
      const errorEl = fixture.nativeElement.querySelector('.error-message');
      expect(errorEl).toBeFalsy();
    });

    it('by mělo poslat prázdné hodnoty, pokud uživatel nic nevyplnil', () => {
      component.email    = '';
      component.password = '';

      component.onLogin();

      expect(authServiceMock.login).toHaveBeenCalledOnceWith({
        email: '', password: '',
      });
    });
  });

  // ── Šablona — přihlašovací formulář ──────────────────────────────────────
  describe('šablona — přihlašovací formulář', () => {
    it('by mělo aktualizovat component.email při psaní do pole emailu', () => {
      const input: HTMLInputElement =
        fixture.nativeElement.querySelector('#email');
      input.value = 'test@rpsw.cz';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(component.email).toBe('test@rpsw.cz');
    });

    it('by mělo aktualizovat component.password při psaní do pole hesla', () => {
      const input: HTMLInputElement =
        fixture.nativeElement.querySelector('#password');
      input.value = 'mojeheslo';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(component.password).toBe('mojeheslo');
    });

    it('by mělo mít pole hesla typu "password" ve výchozím stavu', () => {
      const input: HTMLInputElement =
        fixture.nativeElement.querySelector('#password');
      expect(input.type).toBe('password');
    });

    it('by mělo přepnout typ pole hesla na "text" po kliknutí na togglePassword', () => {
      const btn: HTMLButtonElement =
        fixture.nativeElement.querySelector('.toggle-password');
      btn.click();
      fixture.detectChanges();

      const input: HTMLInputElement =
        fixture.nativeElement.querySelector('#password');
      expect(component.showPassword).toBeTrue();
      expect(input.type).toBe('text');
    });

    it('by mělo přepnout typ pole hesla zpět na "password" po druhém kliknutí', () => {
      const btn: HTMLButtonElement =
        fixture.nativeElement.querySelector('.toggle-password');
      btn.click();
      btn.click();
      fixture.detectChanges();

      const input: HTMLInputElement =
        fixture.nativeElement.querySelector('#password');
      expect(component.showPassword).toBeFalse();
      expect(input.type).toBe('password');
    });

    it('by mělo zavolat onLogin při odeslání formuláře (ngSubmit)', () => {
      spyOn(component, 'onLogin');

      const form: HTMLFormElement =
        fixture.nativeElement.querySelector('form.login-form');
      form.dispatchEvent(new Event('submit'));
      fixture.detectChanges();

      expect(component.onLogin).toHaveBeenCalled();
    });

    it('by mělo zavolat openForgotModal po kliknutí na "Zapomenuté heslo?"', () => {
      spyOn(component, 'openForgotModal');

      const btn: HTMLButtonElement =
        fixture.nativeElement.querySelector('.forgot-trigger');
      btn.click();

      expect(component.openForgotModal).toHaveBeenCalled();
    });
  });

  // ── openForgotModal / closeForgotModal ────────────────────────────────────
  describe('openForgotModal / closeForgotModal', () => {
    it('openForgotModal by mělo vynulovat resetEmail a resetSent a otevřít modal', () => {
      component.resetEmail = 'stary@email.cz';
      component.resetSent  = true;

      component.openForgotModal();

      expect(component.resetEmail).toBe('');
      expect(component.resetSent).toBeFalse();
      expect(component.showForgotModal).toBeTrue();
    });

    it('closeForgotModal by mělo zavřít modal', () => {
      component.showForgotModal = true;
      component.closeForgotModal();
      expect(component.showForgotModal).toBeFalse();
    });

    it('modal by neměl být v DOM, dokud showForgotModal je false', () => {
      component.showForgotModal = false;
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('.modal-overlay');
      expect(modal).toBeFalsy();
    });

    it('modal by měl být v DOM po zavolání openForgotModal', () => {
      component.openForgotModal();
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('.modal-overlay');
      expect(modal).toBeTruthy();
    });

    it('kliknutí na overlay by mělo zavřít modal', () => {
      component.openForgotModal();
      fixture.detectChanges();

      const overlay: HTMLElement =
        fixture.nativeElement.querySelector('.modal-overlay');
      overlay.click();
      fixture.detectChanges();

      expect(component.showForgotModal).toBeFalse();
    });

    it('kliknutí dovnitř karty modalu by NEMĚLO zavřít modal (stopPropagation)', () => {
      component.openForgotModal();
      fixture.detectChanges();

      const card: HTMLElement =
        fixture.nativeElement.querySelector('.modal-card');
      card.click();
      fixture.detectChanges();

      expect(component.showForgotModal).toBeTrue();
    });

    it('kliknutí na tlačítko zavřít (X) by mělo zavolat closeForgotModal', () => {
      component.openForgotModal();
      fixture.detectChanges();
      spyOn(component, 'closeForgotModal').and.callThrough();

      const closeBtn: HTMLButtonElement =
        fixture.nativeElement.querySelector('.modal-close');
      closeBtn.click();

      expect(component.closeForgotModal).toHaveBeenCalled();
    });

    it('kliknutí na "Zrušit" v patičce modalu by mělo zavolat closeForgotModal', () => {
      component.openForgotModal();
      fixture.detectChanges();
      spyOn(component, 'closeForgotModal').and.callThrough();

      const cancelBtn: HTMLButtonElement =
        fixture.nativeElement.querySelector('.modal-cancel-btn');
      cancelBtn.click();

      expect(component.closeForgotModal).toHaveBeenCalled();
    });
  });

  // ── onResetPassword ───────────────────────────────────────────────────────
  describe('onResetPassword', () => {
    // Modal otevřeme před každým testem v tomto bloku
    beforeEach(() => {
      component.openForgotModal();
      fixture.detectChanges();
    });

    it('by nemělo nic udělat, pokud je resetEmail prázdný string', () => {
      component.resetEmail = '';
      component.onResetPassword();

      expect(component.resetSent).toBeFalse();
    });

    it('by nemělo nic udělat, pokud resetEmail obsahuje jen mezery', () => {
      component.resetEmail = '   ';
      component.onResetPassword();

      expect(component.resetSent).toBeFalse();
    });

    it('by mělo nastavit resetSent na true pro platný (neprázdný) email', () => {
      component.resetEmail = 'uzivatel@rpsw.cz';
      component.onResetPassword();

      expect(component.resetSent).toBeTrue();
    });

    it('by mělo zobrazit potvrzující zprávu v šabloně po odeslání', () => {
      component.resetEmail = 'uzivatel@rpsw.cz';
      component.onResetPassword();
      fixture.detectChanges();

      const successEl: HTMLElement | null =
        fixture.nativeElement.querySelector('.success-message');
      expect(successEl).toBeTruthy();
      expect(successEl!.textContent).toContain('Instrukce byly odeslány');
    });

    it('by mělo automaticky zavřít modal po 3000ms', fakeAsync(() => {
      component.resetEmail = 'uzivatel@rpsw.cz';
      component.onResetPassword();

      expect(component.showForgotModal).toBeTrue();

      tick(3000);

      expect(component.showForgotModal).toBeFalse();
    }));

    it('by NEMĚLO zavřít modal před uplynutím 3000ms', fakeAsync(() => {
      component.resetEmail = 'uzivatel@rpsw.cz';
      component.onResetPassword();

      tick(2999);
      expect(component.showForgotModal).toBeTrue();

      tick(1); // úklid časovače
    }));

    it('by nemělo naplánovat setTimeout, pokud email nebyl platný', fakeAsync(() => {
      component.resetEmail = '';
      component.onResetPassword();

      tick(3000);
      // Modal stále otevřen — žádný setTimeout nebyl vytvořen
      expect(component.showForgotModal).toBeTrue();
    }));

    it('kliknutí na "Odeslat instrukce" by mělo zavolat onResetPassword', fakeAsync(() => {
      spyOn(component, 'onResetPassword').and.callThrough();
      component.resetEmail = 'uzivatel@rpsw.cz';
      fixture.detectChanges();

      const submitBtn: HTMLButtonElement =
        fixture.nativeElement.querySelector('.modal-submit-btn');
      submitBtn.click();

      expect(component.onResetPassword).toHaveBeenCalled();

      tick(3000); // úklid naplánovaného setTimeout
    }));
  });
});