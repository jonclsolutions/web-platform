/**
 * @file auth.service.spec.ts
 * @path src/app/core/auth/auth.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AuthService - the session of the admin lives only in memory, the
 *   refresh token only in the HttpOnly cookie of the API: login / 2FA start the session, nothing
 *   secret reaches sessionStorage / localStorage (only the account slot of the tab and the
 *   "remembered accounts may exist" hint), the tab's account is restored after a reload by one
 *   refresh call with its slot, a new tab signs in only to the one remembered account, concurrent
 *   refreshes share one request and run under the Web Lock of the account, logout ends only the
 *   account of the tab; error mapping of login / 2FA / password reset.
 * @note `startTokenRefreshTimer()` creates an endless 20-minute `timer(...)`: fakeAsync tests that
 *   start it stop it with `clearAuthData()` and `discardPeriodicTasks()`.
 * @note `lockManager` is set to null (no Web Lock) so the requests start synchronously; one test
 *   checks the lock with a fake lock manager.
 * @dependencies
 * - HttpTestingController; PermissionService spy; the real GenericTableService (spied).
 */

import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  AuthService, AuthSessionResponse, LAST_ACCOUNT_KEY, RefreshLockManager, RememberedAccount, SESSION_HINT_KEY, SESSION_SLOT_HEADER, SESSION_SLOT_KEY, SessionChannel
} from './auth.service';
import { PermissionService } from './services/permission.service';
import { GenericTableService } from '../services/generic-table.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tables: GenericTableService;
  let permissionServiceMock: { setPermissions: jasmine.Spy; clearPermissions: jasmine.Spy };
  const baseUrl = environment.base_api_url;

  /** Session answer of the API (the refresh token is only in the cookie, never here). */
  const session = (overrides: Partial<AuthSessionResponse> = {}): AuthSessionResponse => ({
    token: 'access-1',
    user: { id: 42, user_email: 'a@b.cz' },
    user_roles: ['admin', 'editor'],
    user_permissions: ['view-web', 'view-eshop'],
    session_slot: 'slot42',
    ...overrides,
  });

  /** Remembered account of the /refresh/accounts answer. */
  const account = (slot: string | null, email = 'a@b.cz'): RememberedAccount => ({ slot, user_email: email, full_name: null, avatar_url: null });

  /** Fake session channel of the service (the real one is closed - no message between tests). */
  let channel: jasmine.SpyObj<SessionChannel>;
  /** Page reload of the service - never a real reload in the tests. */
  let reload: jasmine.Spy;
  /** Opening of the login page by the service - never real in the tests. */
  let openLogin: jasmine.Spy;

  /** Creates the service (after the storage of the test is prepared) without Web Lock. */
  function createService(): void {
    service = TestBed.inject(AuthService);
    service.lockManager = null;
    service.sessionChannel?.close();
    channel = jasmine.createSpyObj<SessionChannel>('SessionChannel', ['postMessage', 'addEventListener', 'close']);
    service.sessionChannel = channel;
    reload = jasmine.createSpy('reloadPage');
    service.reloadPage = reload;
    openLogin = jasmine.createSpy('openLoginPage');
    service.openLoginPage = openLogin;
    httpMock = TestBed.inject(HttpTestingController);
    tables = TestBed.inject(GenericTableService);
  }

  /** Logs in directly (no 2FA) with the given answer. */
  function logIn(response: AuthSessionResponse = session()): void {
    service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
    httpMock.expectOne(`${baseUrl}/login`).flush({ data: response });
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.removeItem(SESSION_HINT_KEY);
    permissionServiceMock = {
      setPermissions: jasmine.createSpy('setPermissions'),
      clearPermissions: jasmine.createSpy('clearPermissions'),
    };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PermissionService, useValue: permissionServiceMock }],
    });
  });

  afterEach(() => {
    httpMock?.verify();
    sessionStorage.clear();
    localStorage.removeItem(SESSION_HINT_KEY);
  });

  describe('start', () => {
    /**
     * @description A new instance is logged out and reads no session from any storage; the
     *   tokens / user data former versions kept in sessionStorage are deleted.
     * @input sessionStorage with accessToken, refreshToken, userId, userEmail, userRole,
     *   userPermissions and an unrelated key.
     * @output isLoggedIn$ false, userEmail$ null, no token; the six keys removed, the unrelated
     *   key kept; no permissions set; no refresh after 20 minutes.
     */
    it('starts logged out and removes the former sessionStorage session', fakeAsync(() => {
      ['accessToken', 'refreshToken', 'userId', 'userEmail', 'userRole', 'userPermissions'].forEach(k => sessionStorage.setItem(k, 'x'));
      sessionStorage.setItem('other', 'keep');
      createService();

      let loggedIn: boolean | undefined;
      let email: string | null | undefined;
      service.isLoggedIn$.subscribe(v => (loggedIn = v));
      service.userEmail$.subscribe(v => (email = v));
      expect<unknown[]>([loggedIn, email, service.getAccessToken(), service.getUserId()]).toEqual([false, null, null, null]);
      expect(sessionStorage.length).toBe(1);
      expect(sessionStorage.getItem('other')).toBe('keep');
      expect(permissionServiceMock.setPermissions).not.toHaveBeenCalled();

      tick(20 * 60 * 1000);
      httpMock.expectNone(`${baseUrl}/refresh`);
      discardPeriodicTasks();
    }));
  });

  describe('login', () => {
    beforeEach(() => createService());

    /**
     * @description Login posts the credentials with credentials (the API sets the refresh
     *   cookie); the session is kept in memory only - sessionStorage holds only the account slot
     *   of the tab, localStorage only the hint; nothing is announced to the other tabs.
     * @input login({email, password}) answered with the session (role admin, two permissions).
     * @output POST /login, withCredentials; token / id / email / role / permissions from memory;
     *   sessionStorage only the slot 'slot42'; localStorage hint '1'; permissions set; table cache
     *   bound to user 42; no channel message.
     */
    it('starts the session in memory only', () => {
      const setUser = spyOn(tables, 'setCurrentUser').and.callThrough();
      const credentials = { email: 'a@b.cz', password: 'pass' };
      service.login(credentials).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ data: session() });

      expect(service.getAccessToken()).toBe('access-1');
      expect(service.getUserId()).toBe('42');
      expect(service.getUserEmail()).toBe('a@b.cz');
      expect(service.getUserRole()).toBe('admin');
      expect(service.getUserPermissions()).toEqual(['view-web', 'view-eshop']);
      expect(sessionStorage.length).toBe(1);
      expect(sessionStorage.getItem(SESSION_SLOT_KEY)).toBe('slot42');
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
      expect(permissionServiceMock.setPermissions).toHaveBeenCalledWith(['view-web', 'view-eshop']);
      expect(setUser).toHaveBeenCalledWith('42');
      expect(channel.postMessage).not.toHaveBeenCalled();
    });

    /**
     * @description Fallbacks: user_login_id when id is missing, no role for an empty / missing
     *   list, an empty permission list when missing; getUserPermissions returns a copy.
     * @input user {user_login_id: 99}, user_roles [] and no user_permissions.
     * @output id '99', role null, permissions [] (also set to PermissionService); mutating the
     *   returned array changes nothing.
     */
    it('uses the fallbacks of the answer', () => {
      logIn(session({ user: { user_login_id: 99, user_email: 'a@b.cz' }, user_roles: [], user_permissions: undefined }));
      expect<unknown[]>([service.getUserId(), service.getUserRole()]).toEqual(['99', null]);
      expect(service.getUserPermissions()).toEqual([]);
      expect(permissionServiceMock.setPermissions).toHaveBeenCalledWith([]);

      service.clearAuthData();
      logIn(session({ user_roles: undefined }));
      expect(service.getUserRole()).toBeNull();
      service.getUserPermissions().push('hack');
      expect(service.getUserPermissions()).toEqual(['view-web', 'view-eshop']);
      service.clearAuthData();
    });

    /**
     * @description The subjects follow the session; a failed login changes nothing.
     * @input Failed login (401); then a successful one.
     * @output isLoggedIn$ false and no hint after the failure; email 'a@b.cz' / true after success.
     */
    it('updates the subjects and ignores a failed login', () => {
      let email: string | null = null;
      let loggedIn = false;
      service.userEmail$.subscribe(v => (email = v));
      service.isLoggedIn$.subscribe(v => (loggedIn = v));

      service.login({ email: 'a@b.cz', password: 'wrong' }).subscribe({ error: () => {} });
      httpMock.expectOne(`${baseUrl}/login`).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
      expect(loggedIn).toBeFalse();
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();

      logIn();
      expect<unknown[]>([email, loggedIn]).toEqual(['a@b.cz', true]);
      service.clearAuthData();
    });

    /**
     * @description The refresh timer starts with the session and renews it every 20 minutes;
     *   a failed timed refresh ends the session without an unhandled error.
     * @input Login; tick 20 min → refresh answered with a new token; tick 20 min → refresh 401.
     * @output POST /refresh {} with the slot header of the tab, the new token in memory; after
     *   the 401 logged out.
     */
    it('refreshes the session every 20 minutes', fakeAsync(() => {
      logIn();

      tick(20 * 60 * 1000);
      const refresh = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(refresh.request.body).toEqual({});
      expect(refresh.request.withCredentials).toBeTrue();
      expect(refresh.request.headers.get(SESSION_SLOT_HEADER)).toBe('slot42');
      refresh.flush({ data: session({ token: 'access-2' }) });
      expect(service.getAccessToken()).toBe('access-2');

      tick(20 * 60 * 1000);
      httpMock.expectOne(`${baseUrl}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(service.getAccessToken()).toBeNull();
      discardPeriodicTasks();
    }));
  });

  describe('checkAuth (session restore after a reload)', () => {
    beforeEach(() => createService());

    /**
     * @description Without a session and without the hint nobody is logged in - no request is made
     *   (a public visitor causes no refresh call on every page).
     * @input No session, no hint.
     * @output false, isLoggedIn$ false, no request.
     */
    it('answers false without a hint and without a request', () => {
      let result: boolean | undefined;
      service.checkAuth().subscribe(v => (result = v));
      expect(result).toBeFalse();
      httpMock.expectNone(`${baseUrl}/refresh`);
    });

    /**
     * @description With a session in memory it answers true at once.
     * @input Logged in.
     * @output true, no refresh request.
     */
    it('answers true for a session in memory', () => {
      logIn();
      let result: boolean | undefined;
      service.checkAuth().subscribe(v => (result = v));
      expect(result).toBeTrue();
      httpMock.expectNone(`${baseUrl}/refresh`);
      service.clearAuthData();
    });

    /**
     * @description Without "Remember me" the account belongs to its tab only: the tab restores it
     *   after a reload (its slot), a new tab (empty sessionStorage, no remembered hint) shows the
     *   login page without any request.
     * @input Login answer remember false; reload (memory empty); new tab (sessionStorage cleared).
     * @output No localStorage hint, slot in sessionStorage; checkAuth → one refresh with the slot
     *   header → true; new tab: checkAuth false, no request.
     */
    it('keeps a session without "Remember me" in its own tab only', () => {
      service.login({ email: 'a@b.cz', password: 'p', remember: false }).subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush({ data: session({ remember: false }) });
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
      expect(sessionStorage.getItem(SESSION_SLOT_KEY)).toBe('slot42');

      let restored: boolean | undefined;
      (service as any).session = null;
      service.checkAuth().subscribe(v => (restored = v));
      const refresh = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(refresh.request.headers.get(SESSION_SLOT_HEADER)).toBe('slot42');
      refresh.flush({ data: session({ remember: false }) });
      expect(restored).toBeTrue();
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();

      sessionStorage.clear();
      (service as any).session = null;
      let newTab: boolean | undefined;
      service.checkAuth().subscribe(v => (newTab = v));
      httpMock.expectNone(`${baseUrl}/refresh`);
      httpMock.expectNone(`${baseUrl}/refresh/accounts`);
      expect(newTab).toBeFalse();
    });

    /**
     * @description After a reload (slot of the tab, memory empty) the account is restored with ONE
     *   refresh call, also when several callers ask at once.
     * @input Slot 'slot42' in sessionStorage; checkAuth() twice before the answer.
     * @output One POST /refresh with the slot header; both answer true; token, email and
     *   permissions restored.
     */
    it('restores the account of the tab with one refresh call', () => {
      sessionStorage.setItem(SESSION_SLOT_KEY, 'slot42');
      const results: boolean[] = [];
      service.checkAuth().subscribe(v => results.push(v));
      service.checkAuth().subscribe(v => results.push(v));

      const refresh = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(refresh.request.headers.get(SESSION_SLOT_HEADER)).toBe('slot42');
      refresh.flush({ data: session() });
      expect(results).toEqual([true, true]);
      expect<unknown[]>([service.getAccessToken(), service.getUserEmail()]).toEqual(['access-1', 'a@b.cz']);
      expect(permissionServiceMock.setPermissions).toHaveBeenCalledWith(['view-web', 'view-eshop']);
      service.clearAuthData();
    });

    /**
     * @description Nothing signs in on its own: a new tab (no slot) with remembered accounts, or a
     *   tab after a logout, is not signed in and makes no request - the accounts are only offered
     *   on the login page. The cookie of the former single-cookie version (legacy tab hint) is
     *   restored without a slot header and the tab then keeps the slot the API answered.
     * @input Remembered hint, no slot; then legacy sessionStorage hint '1'; then logout.
     * @output false, no request; refresh without header → true, slot 'slot42', legacy hint
     *   removed; after the logout checkAuth false without request, remembered hint kept.
     */
    it('never signs in on its own and restores the former single cookie', () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');
      let result: boolean | undefined;
      service.checkAuth().subscribe(v => (result = v));
      httpMock.expectNone(`${baseUrl}/refresh/accounts`);
      httpMock.expectNone(`${baseUrl}/refresh`);
      expect(result).toBeFalse();

      sessionStorage.setItem(SESSION_HINT_KEY, '1');
      service.checkAuth().subscribe(v => (result = v));
      const legacy = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(legacy.request.headers.has(SESSION_SLOT_HEADER)).toBeFalse();
      legacy.flush({ data: session() });
      expect(result).toBeTrue();
      expect(sessionStorage.getItem(SESSION_SLOT_KEY)).toBe('slot42');
      expect(sessionStorage.getItem(SESSION_HINT_KEY)).toBeNull();

      service.logout().subscribe();
      httpMock.expectOne(`${baseUrl}/logout`).flush({});
      service.checkAuth().subscribe(v => (result = v));
      httpMock.expectNone(`${baseUrl}/refresh`);
      expect(result).toBeFalse();
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
    });

    /**
     * @description An admin address in a tab without its own account (checkAuth(true)) opens with
     *   a remembered account: the one used last, else the only one; several without a last used
     *   one, or none, answer false (login page). A tab with its own (gone) account never switches.
     * @input remembered login slotB (last = slotB); new tab: [slotA, slotB]; last removed:
     *   [slotA, slotB]; [slotA]; tab with slot 'gone' answered 401.
     * @output LAST_ACCOUNT_KEY 'slotB'; refresh header slotB → true; false without refresh;
     *   refresh slotA → true; only the refresh of 'gone' → false, no list request.
     */
    it('opens an admin address with the last used remembered account', () => {
      service.login({ email: 'a@b.cz', password: 'p', remember: true }).subscribe();
      httpMock.expectOne(`${baseUrl}/login`).flush({ data: session({ session_slot: 'slotB' }) });
      expect(localStorage.getItem(LAST_ACCOUNT_KEY)).toBe('slotB');
      const twoAccounts = { data: [account('slotA'), account('slotB', 'b@b.cz')] };

      (service as any).session = null;
      sessionStorage.clear();
      let result: boolean | undefined;
      service.checkAuth(true).subscribe(v => (result = v));
      httpMock.expectOne(`${baseUrl}/refresh/accounts`).flush(twoAccounts);
      const last = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(last.request.headers.get(SESSION_SLOT_HEADER)).toBe('slotB');
      last.flush({ data: session({ session_slot: 'slotB' }) });
      expect(result).toBeTrue();

      (service as any).session = null;
      sessionStorage.clear();
      localStorage.removeItem(LAST_ACCOUNT_KEY);
      service.checkAuth(true).subscribe(v => (result = v));
      httpMock.expectOne(`${baseUrl}/refresh/accounts`).flush(twoAccounts);
      httpMock.expectNone(`${baseUrl}/refresh`);
      expect(result).toBeFalse();

      service.checkAuth(true).subscribe(v => (result = v));
      httpMock.expectOne(`${baseUrl}/refresh/accounts`).flush({ data: [account('slotA')] });
      const only = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(only.request.headers.get(SESSION_SLOT_HEADER)).toBe('slotA');
      only.flush({ data: session({ session_slot: 'slotA', remember: false }) });
      expect(result).toBeTrue();

      (service as any).session = null;
      sessionStorage.setItem(SESSION_SLOT_KEY, 'gone');
      service.checkAuth(true).subscribe(v => (result = v));
      httpMock.expectOne(`${baseUrl}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
      httpMock.expectNone(`${baseUrl}/refresh/accounts`);
      expect(result).toBeFalse();
    });

    /**
     * @description A logout forgets the account as the last used one; the end of all remembered
     *   accounts removes it too.
     * @input remembered login slot42 (last), logout; again, then /refresh/accounts answers [].
     * @output LAST_ACCOUNT_KEY removed after the logout; removed with the hint.
     */
    it('forgets the last used account on logout', () => {
      logIn();
      expect(localStorage.getItem(LAST_ACCOUNT_KEY)).toBe('slot42');
      service.logout().subscribe();
      httpMock.expectOne(`${baseUrl}/logout`).flush({});
      expect(localStorage.getItem(LAST_ACCOUNT_KEY)).toBeNull();

      logIn();
      service.rememberedAccounts().subscribe();
      httpMock.expectOne(`${baseUrl}/refresh/accounts`).flush({ data: [] });
      expect<unknown[]>([localStorage.getItem(LAST_ACCOUNT_KEY), localStorage.getItem(SESSION_HINT_KEY)]).toEqual([null, null]);
    });

    /**
     * @description A tab that ended its session (logout, expiry, ended from another tab) never
     *   signs in with a remembered account on its own - not even for an admin address.
     * @input Remembered hint + last account; slot '' (ended); checkAuth(true).
     * @output false; no /refresh/accounts, no /refresh.
     */
    it('never resumes a remembered account in an ended tab', () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');
      localStorage.setItem(LAST_ACCOUNT_KEY, 'slotA');
      sessionStorage.setItem(SESSION_SLOT_KEY, '');
      let result: boolean | undefined;
      service.checkAuth(true).subscribe(v => (result = v));
      httpMock.expectNone(`${baseUrl}/refresh/accounts`);
      httpMock.expectNone(`${baseUrl}/refresh`);
      expect(result).toBeFalse();
    });

    /**
     * @description After the own password / e-mail changed the other tabs of the account in this
     *   browser are told to end (this tab stays); without a session nothing is sent.
     * @input Logged in as 42; endOtherTabs(); clearAuthData(); endOtherTabs().
     * @output postMessage {logout, '42'} once; this tab still signed in after the first call.
     */
    it('ends the own account in the other tabs only', () => {
      logIn();
      service.endOtherTabs();
      expect(channel.postMessage).toHaveBeenCalledOnceWith({ type: 'logout', userId: '42' });
      expect(service.getUserId()).toBe('42');
      service.clearAuthData();
      service.endOtherTabs();
      expect(channel.postMessage).toHaveBeenCalledTimes(1);
    });

    /**
     * @description A tab whose account is gone (expired, logged out in another tab) ends quietly;
     *   other remembered accounts stay remembered.
     * @input Slot 'slot42', hint '1'; refresh answers 401.
     * @output false (no error), tab marked ended (slot ''), hint kept, permissions cleared.
     */
    it('answers false when the restore fails', () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');
      sessionStorage.setItem(SESSION_SLOT_KEY, 'slot42');
      let result: boolean | undefined;
      let failed = false;
      service.checkAuth().subscribe({ next: v => (result = v), error: () => (failed = true) });

      httpMock.expectOne(`${baseUrl}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
      expect<unknown[]>([result, failed]).toEqual([false, false]);
      expect(sessionStorage.getItem(SESSION_SLOT_KEY)).toBe('');
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
    });

    /**
     * @description The chooser list: no request without the hint; the answer passed on; an empty
     *   answer removes the hint; a failing call answers [].
     * @input No hint; hint + two accounts; []; 500.
     * @output []; the two accounts; [] and no hint; [].
     */
    it('lists the remembered accounts', () => {
      let accounts: RememberedAccount[] | undefined;
      service.rememberedAccounts().subscribe(a => (accounts = a));
      httpMock.expectNone(`${baseUrl}/refresh/accounts`);
      expect(accounts).toEqual([]);

      localStorage.setItem(SESSION_HINT_KEY, '1');
      service.rememberedAccounts().subscribe(a => (accounts = a));
      httpMock.expectOne(`${baseUrl}/refresh/accounts`).flush({ data: [account('s1'), account('s2', 'b@b.cz')] });
      expect(accounts!.map(a => a.slot)).toEqual(['s1', 's2']);

      service.rememberedAccounts().subscribe(a => (accounts = a));
      httpMock.expectOne(`${baseUrl}/refresh/accounts`).flush({ data: [] });
      expect<unknown[]>([accounts, localStorage.getItem(SESSION_HINT_KEY)]).toEqual([[], null]);

      localStorage.setItem(SESSION_HINT_KEY, '1');
      accounts = undefined;
      service.rememberedAccounts().subscribe(a => (accounts = a));
      httpMock.expectOne(`${baseUrl}/refresh/accounts`).flush({}, { status: 500, statusText: 'Error' });
      expect<unknown>(accounts).toEqual([]);
    });
  });

  describe('refreshAccessToken', () => {
    beforeEach(() => createService());

    /**
     * @description Concurrent refreshes (timer, interceptor) share one request; a finished one
     *   lets the next caller start a new request.
     * @input Two subscriptions, one answer; then a third refresh.
     * @output One request with both answers; then a second request.
     */
    it('shares one request between concurrent callers', () => {
      const tokens: string[] = [];
      service.refreshAccessToken().subscribe(r => tokens.push(r.token));
      service.refreshAccessToken().subscribe(r => tokens.push(r.token));
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'shared' }) });
      expect(tokens).toEqual(['shared', 'shared']);

      service.refreshAccessToken().subscribe();
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'next' }) });
      expect(service.getAccessToken()).toBe('next');
      service.clearAuthData();
    });

    /**
     * @description The former single cookie (no slot): a refresh of the same user keeps the table
     *   cache; a refresh answering for ANOTHER account never continues as that account: the tab
     *   reloads, the session of this tab stays untouched until then.
     * @input Login as 42 without slot; refresh as 42; refresh as 7.
     * @output invalidateAll once (login); same user no change; user 7: reloadPage, user still 42,
     *   token 'a2', no further invalidation, the refresh does not emit.
     */
    it('reloads instead of continuing as another account', () => {
      const invalidate = spyOn(tables, 'invalidateAll').and.callThrough();
      logIn(session({ session_slot: undefined }));
      expect(invalidate).toHaveBeenCalledTimes(1);

      service.refreshAccessToken().subscribe();
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'a2', session_slot: undefined }) });
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();

      const emitted = jasmine.createSpy('emitted');
      service.refreshAccessToken().subscribe(emitted);
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'b1', user: { id: 7, user_email: 'b@b.cz' }, session_slot: undefined }) });
      expect(reload).toHaveBeenCalledTimes(1);
      expect(emitted).not.toHaveBeenCalled();
      expect(service.getUserId()).toBe('42');
      expect(service.getAccessToken()).toBe('a2');
      expect(invalidate).toHaveBeenCalledTimes(1);
      service.clearAuthData();
    });

    /**
     * @description Several accounts per browser: the end of an account is announced with the
     *   account and only the tabs of THAT account end their session (marked ended) and open the
     *   login page; tabs of other accounts, tabs without a session and unknown messages are left
     *   alone; the channel is closed with the service.
     * @input login as 42; messages logout 7 / login / null / logout 42; login again, logout; tab
     *   without a session receiving logout 42; destroy.
     * @output after logout 42: no session, slot '', openLoginPage once, no reload; logout posts
     *   {logout, '42'}; nothing without a session; close().
     */
    it('ends a logged out account in its tabs only', () => {
      logIn();
      const message = (data: any) => (service as any).onSessionMessage(data);

      message({ type: 'logout', userId: '7' });
      message({ type: 'login', userId: '7' });
      message(null);
      expect(openLogin).not.toHaveBeenCalled();
      expect(service.getUserId()).toBe('42');
      message({ type: 'logout', userId: '42' });
      expect<unknown[]>([service.getUserId(), sessionStorage.getItem(SESSION_SLOT_KEY)]).toEqual([null, '']);
      expect(openLogin).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();

      logIn();
      service.logout().subscribe();
      httpMock.expectOne(`${baseUrl}/logout`).flush({});
      expect(channel.postMessage).toHaveBeenCalledOnceWith({ type: 'logout', userId: '42' });

      openLogin.calls.reset();
      message({ type: 'logout', userId: '42' });
      expect(openLogin).not.toHaveBeenCalled();

      channel.postMessage.and.throwError('closed');
      expect(() => (service as any).announce({ type: 'logout', userId: '42' })).not.toThrow();
      service.clearAuthData();
      service.ngOnDestroy();
      expect(channel.close).toHaveBeenCalled();
    });

    /**
     * @description A chosen remembered account replaces the account of THIS tab without a reload
     *   (its slot is sent, the API guarantees the account); a failed switch keeps the tab's own
     *   session.
     * @input Logged in as 42 (slot42); resumeAccount('slot7') → 401; resumeAccount('slot7') → user 7.
     * @output Header slot7; after 401 still 42 / slot42; then user 7, slot 'slot7', no reload.
     */
    it('switches the tab to a remembered account', () => {
      logIn();
      let failed = false;
      service.resumeAccount('slot7').subscribe({ error: () => (failed = true) });
      const refused = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(refused.request.headers.get(SESSION_SLOT_HEADER)).toBe('slot7');
      refused.flush({}, { status: 401, statusText: 'Unauthorized' });
      expect<unknown[]>([failed, service.getUserId(), sessionStorage.getItem(SESSION_SLOT_KEY)]).toEqual([true, '42', 'slot42']);

      service.resumeAccount('slot7').subscribe();
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ user: { id: 7, user_email: 'b@b.cz' }, session_slot: 'slot7' }) });
      expect<unknown[]>([service.getUserId(), sessionStorage.getItem(SESSION_SLOT_KEY)]).toEqual(['7', 'slot7']);
      expect(reload).not.toHaveBeenCalled();
      service.clearAuthData();
    });

    /**
     * @description A changed own login e-mail is shown at once (header subject + getter); without a
     *   session nothing happens.
     * @input Logged in a@b.cz; setUserEmail('new@b.cz'); clearAuthData; setUserEmail('x@b.cz').
     * @output userEmail$ 'new@b.cz', getUserEmail 'new@b.cz'; after the logout still null.
     */
    it('shows a changed own e-mail at once', () => {
      logIn();
      const emails: (string | null)[] = [];
      service.userEmail$.subscribe(e => emails.push(e));
      service.setUserEmail('new@b.cz');
      expect(service.getUserEmail()).toBe('new@b.cz');
      expect(emails[emails.length - 1]).toBe('new@b.cz');

      service.clearAuthData();
      service.setUserEmail('x@b.cz');
      expect<unknown[]>([service.getUserEmail(), emails[emails.length - 1]]).toEqual([null, null]);
    });

    /**
     * @description A failed refresh ends the session of the tab and passes the error on.
     * @input Logged in; refresh answers 401.
     * @output Error to the subscriber; no token; permissions cleared; tab marked ended (slot ''); the
     *   remembered hint kept (other accounts).
     */
    it('ends the session when the refresh fails', () => {
      logIn();
      let error: any;
      service.refreshAccessToken().subscribe({ error: e => (error = e) });
      httpMock.expectOne(`${baseUrl}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(error.status).toBe(401);
      expect(service.getAccessToken()).toBeNull();
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
      expect(sessionStorage.getItem(SESSION_SLOT_KEY)).toBe('');
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
    });

    /**
     * @description With the Web Locks API the request runs only while the tab holds the refresh
     *   lock of the account and the lock is released when it finishes (also after an error); a
     *   failing lock request is passed on as an error.
     * @input Fake lock manager; refresh (former cookie) answered 200 (slot42); refresh of slot42
     *   answered 500; lock manager rejecting.
     * @output Locks 'jsw-auth-refresh:legacy' and 'jsw-auth-refresh:slot42', each released; the
     *   500 and the lock error reach the subscriber.
     */
    it('runs the refresh under the Web Lock of the tabs', async () => {
      const released: string[] = [];
      const fakeLocks: RefreshLockManager = {
        request: <T>(name: string, callback: () => Promise<T>) => callback().then(v => { released.push(name); return v; }),
      };
      service.lockManager = fakeLocks;

      const ok = new Promise<string>(resolve => service.refreshAccessToken().subscribe(r => resolve(r.token)));
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'locked' }) });
      expect(await ok).toBe('locked');

      const failed = new Promise<number>(resolve => service.refreshAccessToken().subscribe({ error: e => resolve(e.status) }));
      httpMock.expectOne(`${baseUrl}/refresh`).flush({}, { status: 500, statusText: 'Error' });
      expect(await failed).toBe(500);
      await Promise.resolve();
      expect(released).toEqual(['jsw-auth-refresh:legacy', 'jsw-auth-refresh:slot42']);

      service.lockManager = { request: () => Promise.reject(new Error('lock refused')) };
      const lockError = await new Promise<string>(resolve => service.refreshAccessToken().subscribe({ error: e => resolve(e.message) }));
      expect(lockError).toBe('lock refused');
    });
  });

  describe('clearAuthData and logout', () => {
    beforeEach(() => createService());

    /**
     * @description The own profile photo of the session: taken from the login answer, replaced at
     *   once by setAvatarUrl() (photo changed in the admin), the same URL is not emitted twice,
     *   cleared with the session.
     * @input Login with avatar_url '/a.webp'; setAvatarUrl('/b.webp') twice; setAvatarUrl(null);
     *   login again with '/c.webp'; clearAuthData().
     * @output Emitted null, '/a.webp', '/b.webp', null, '/c.webp', null.
     */
    it('keeps the own profile photo of the session', () => {
      const urls: (string | null)[] = [];
      service.avatarUrl$.subscribe(url => urls.push(url));
      logIn(session({ user: { id: 42, user_email: 'a@b.cz', avatar_url: '/a.webp' } }));
      service.setAvatarUrl('/b.webp');
      service.setAvatarUrl('/b.webp');
      service.setAvatarUrl(null);
      logIn(session({ user: { id: 42, user_email: 'a@b.cz', avatar_url: '/c.webp' } }));
      service.clearAuthData();
      expect(urls).toEqual([null, '/a.webp', '/b.webp', null, '/c.webp', null]);
    });

    /**
     * @description clearAuthData ends the session of the tab: memory, tab slot, permissions,
     *   table cache owner, subjects, timer - the remembered hint stays for the other accounts.
     * @input Logged in; clearAuthData(); tick 20 min.
     * @output No token / user; slot '' (ended); hint '1'; clearPermissions; setCurrentUser(null); false /
     *   null; no refresh.
     */
    it('clears the whole session and stops the timer', fakeAsync(() => {
      logIn();
      const setUser = spyOn(tables, 'setCurrentUser').and.callThrough();
      let loggedIn = true;
      let email: string | null = 'x';
      service.isLoggedIn$.subscribe(v => (loggedIn = v));
      service.userEmail$.subscribe(v => (email = v));

      service.clearAuthData();
      expect<unknown[]>([service.getAccessToken(), service.getUserId(), service.getUserEmail(), service.getUserRole()]).toEqual([null, null, null, null]);
      expect(service.getUserPermissions()).toEqual([]);
      expect(sessionStorage.getItem(SESSION_SLOT_KEY)).toBe('');
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
      expect(setUser).toHaveBeenCalledWith(null);
      expect<unknown[]>([loggedIn, email]).toEqual([false, null]);

      tick(20 * 60 * 1000);
      httpMock.expectNone(`${baseUrl}/refresh`);
      discardPeriodicTasks();
    }));

    /**
     * @description Logout posts an empty body with credentials (the API revokes the tokens and
     *   deletes the cookie) and clears the session; a failed request still logs out locally.
     * @input Logged in; logout → 200; logged in; logout → 500.
     * @output POST /logout {} withCredentials; no token; second: null result, no error, no token.
     */
    it('logs out on the server and locally', () => {
      logIn();
      service.logout().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/logout`);
      expect(req.request.body).toEqual({});
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ message: 'Logout successful!' });
      expect(service.getAccessToken()).toBeNull();

      logIn();
      let result: any = 'not-set';
      let errored = false;
      service.logout().subscribe({ next: v => (result = v), error: () => (errored = true) });
      httpMock.expectOne(`${baseUrl}/logout`).flush('Server down', { status: 500, statusText: 'Internal Server Error' });
      expect<unknown[]>([result, errored, service.getAccessToken()]).toEqual([null, false, null]);
    });

    /**
     * @description Blocked browser storage (private mode) does not break the session - only the
     *   restore after a reload is lost.
     * @input localStorage.getItem / setItem / removeItem and sessionStorage.removeItem throwing; new service; login; checkAuth after clear.
     * @output No error; session in memory; checkAuth false without request.
     */
    it('works with blocked storage', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PermissionService, useValue: permissionServiceMock }],
      });
      const boom = () => { throw new Error('blocked'); };
      const spies = [
        spyOn(Storage.prototype, 'getItem').and.callFake(boom),
        spyOn(Storage.prototype, 'setItem').and.callFake(boom),
        spyOn(Storage.prototype, 'removeItem').and.callFake(boom),
      ];
      createService();

      logIn();
      expect(service.getAccessToken()).toBe('access-1');
      service.clearAuthData();
      let result: boolean | undefined;
      service.checkAuth().subscribe(v => (result = v));
      expect(result).toBeFalse();
      httpMock.expectNone(`${baseUrl}/refresh`);
      spies.forEach(spy => spy.and.callThrough());
    });
  });

  describe('error mapping and 2FA / password reset', () => {
    /**
     * @description Collects the error of a request answered with the given status / body.
     * @param call Request to start.
     * @param url Expected endpoint.
     * @param status HTTP status.
     * @param body Response body.
     * @returns The AuthError received by the subscriber.
     */
    function errorOf(call: () => any, url: string, status: number, body: any = null): any {
      let error: any;
      call().subscribe({ error: (e: any) => (error = e) });
      httpMock.expectOne(`${baseUrl}/${url}`).flush(body, { status, statusText: 'x' });
      return error;
    }

    /**
     * @description Login errors keep the backend message, else a translation key; 429 has its own
     *   key; captcha_required is passed on.
     * @input 401 {message: 'Bad password', captcha_required: true}; 500 without body; 429 without body.
     * @output 'Bad password' without key + captchaRequired; '' + login_failed; '' + too_many_attempts.
     */
    it('maps login errors', () => {
      createService();
      const backend = errorOf(() => service.login({ email: 'a@b.cz', password: 'x' }), 'login', 401, { message: 'Bad password', captcha_required: true });
      expect<unknown[]>([backend.message, backend.messageKey, backend.captchaRequired]).toEqual(['Bad password', undefined, true]);
      const failed = errorOf(() => service.login({ email: 'a@b.cz', password: 'x' }), 'login', 500);
      expect<unknown[]>([failed.message, failed.messageKey, failed.captchaRequired]).toEqual(['', 'login_failed', false]);
      expect(errorOf(() => service.login({ email: 'a@b.cz', password: 'x' }), 'login', 429).messageKey).toBe('too_many_attempts');
    });

    /**
     * @description A 2FA challenge starts no session; verifyTwoFactor (with credentials - the API
     *   sets the refresh cookie) starts it; errors map to verification_failed with retry_after.
     * @input login → {requires_2fa, login_token}; verify-2fa (remember) → session; verify 400 {}; resend 429 {retry_after: 30};
     *        resend 200.
     * @output No token / hint after step 1; token + user 5 after step 2; key verification_failed;
     *   retryAfter 30; resend response passed through.
     */
    it('handles the two-factor flow', () => {
      createService();
      let challenge: any;
      service.login({ email: 'a@b.cz', password: 'x' }).subscribe(r => (challenge = r));
      httpMock.expectOne(`${baseUrl}/login`).flush({ data: { requires_2fa: true, login_token: 'lt' } });
      expect(challenge.login_token).toBe('lt');
      expect(service.getAccessToken()).toBeNull();
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();

      service.verifyTwoFactor('lt', '123456', true).subscribe();
      const verify = httpMock.expectOne(`${baseUrl}/login/verify-2fa`);
      expect(verify.request.body).toEqual({ login_token: 'lt', code: '123456', remember: true });
      expect(verify.request.withCredentials).toBeTrue();
      verify.flush({ data: session({ token: 't', user: { user_login_id: 5, user_email: 'a@b.cz' } }) });
      expect<unknown[]>([service.getAccessToken(), service.getUserId()]).toEqual(['t', '5']);
      service.clearAuthData();

      const wrong = errorOf(() => service.verifyTwoFactor('lt', '000000'), 'login/verify-2fa', 400, {});
      expect<unknown[]>([wrong.message, wrong.messageKey, wrong.retryAfter]).toEqual(['', 'verification_failed', undefined]);
      const throttled = errorOf(() => service.resendTwoFactor('lt'), 'login/resend-2fa', 429, { message: 'Wait', retry_after: '30' });
      expect<unknown[]>([throttled.message, throttled.retryAfter]).toEqual(['Wait', 30]);
      const noRetry = errorOf(() => service.resendTwoFactor('lt'), 'login/resend-2fa', 429, {});
      expect(noRetry.retryAfter).toBeUndefined();

      let resent: any;
      service.resendTwoFactor('lt').subscribe(r => (resent = r));
      httpMock.expectOne(`${baseUrl}/login/resend-2fa`).flush({ data: { expires_in: 300 }, message: 'A new code has been sent.' });
      expect(resent).toEqual({ expires_in: 300 });
    });

    /**
     * @description Password reset: request and reset send the bodies; 429 always uses the own key
     *   (even with a backend message), other errors the backend message or request_failed.
     * @input forgot-password ok; reset-password ok; 429 {message}; 422 {message: 'Token expired'}; 500.
     * @output Bodies; too_many_attempts; 'Token expired'; request_failed.
     */
    it('handles the password reset requests', () => {
      createService();
      let sent: any; let reset: any;
      service.requestPasswordReset('a@b.cz').subscribe(r => (sent = r));
      const forgot = httpMock.expectOne(`${baseUrl}/forgot-password`);
      expect(forgot.request.body).toEqual({ email: 'a@b.cz' });
      forgot.flush({ message: 'ok' });
      service.resetPassword('tok', 'Pw1!', 'Pw1!').subscribe(r => (reset = r));
      const resetReq = httpMock.expectOne(`${baseUrl}/reset-password`);
      expect(resetReq.request.body).toEqual({ token: 'tok', password: 'Pw1!', password_confirmation: 'Pw1!' });
      resetReq.flush({ data: { email: 'a@b.cz' }, message: 'done' });
      expect<unknown[]>([sent.message, reset.email]).toEqual(['ok', 'a@b.cz']);

      const throttled = errorOf(() => service.requestPasswordReset('a@b.cz'), 'forgot-password', 429, { message: 'Too Many Attempts.' });
      expect<unknown[]>([throttled.message, throttled.messageKey]).toEqual(['', 'too_many_attempts']);
      expect(errorOf(() => service.resetPassword('t', 'p', 'p'), 'reset-password', 422, { message: 'Token expired' }).message).toBe('Token expired');
      expect(errorOf(() => service.resetPassword('t', 'p', 'p'), 'reset-password', 500).messageKey).toBe('request_failed');
    });
  });
});
