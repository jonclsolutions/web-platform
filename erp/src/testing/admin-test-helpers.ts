/**
 * @file admin-test-helpers.ts
 * @path src/testing/admin-test-helpers.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared test doubles for the admin unit tests (used only by *.spec.ts files, never
 *   by application code). They replace the services every admin page injects, so a spec only
 *   configures what it actually tests:
 *   - i18n stub: `getValue(path)` returns the path itself and `strings.<key>` returns
 *     `<section>.<key>`, so tests assert WHICH translation key is used, independent of the texts.
 *   - permission / auth stubs with controllable state,
 *   - jasmine spies for DataHandler, GenericTableService, AlertDialogService, ConfirmDialogService.
 * @dependencies
 * - jasmine (global in Karma), @angular/core, @angular/router, @angular/common/http(/testing), rxjs.
 */

import { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { registerLocaleData } from '@angular/common';
import localeCs from '@angular/common/locales/cs';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { AdminLocalizationService, ADMIN_AVAILABLE_LANGUAGES } from '../app/core/services/admin-localization.service';
import { PermissionService } from '../app/core/auth/services/permission.service';
import { AuthService } from '../app/core/auth/auth.service';
import { DataHandler } from '../app/core/services/data-handler.service';
import { GenericTableService, PaginatedResponse } from '../app/core/services/generic-table.service';
import { AlertDialogService } from '../app/core/services/alert-dialog.service';
import { ConfirmDialogService } from '../app/core/services/confirm-dialog.service';
import { TableRefreshBusService } from '../app/core/services/table-refresh-bus.service';
import { LocalizationService } from '../app/shared/services/localization.service';
import { PublicDataService } from '../app/shared/services/public-data.service';

// The admin formats dates and money with 'cs-CZ' (registered in app.config.ts in the app).
registerLocaleData(localeCs, 'cs-CZ');

/** i18n stub: same public surface as AdminLocalizationService. */
export interface I18nStub {
  translations$: BehaviorSubject<Record<string, any> | null>;
  currentLanguage$: BehaviorSubject<string>;
  availableLanguages: typeof ADMIN_AVAILABLE_LANGUAGES;
  getValue: jasmine.Spy<(path: string) => string>;
  getMergedSection: jasmine.Spy<(section: string) => any>;
  getDateLocale: jasmine.Spy<() => string>;
  getCurrentLanguage: jasmine.Spy<() => string>;
  setLanguage: jasmine.Spy<(code: string) => void>;
}

/**
 * @description Creates the AdminLocalizationService stub.
 * @param lang Active admin language (default 'cz' → date locale 'cs-CZ').
 * @returns Stub whose texts are the translation keys themselves.
 * @note `getMergedSection(section)` returns a Proxy: any property read gives '<section>.<key>'
 *   (or 'shared.<key>' for an empty section), exactly what a template binding `strings.key`
 *   would display, without loading any JSON.
 */
export function createI18nStub(lang = 'cz'): I18nStub {
  const current = new BehaviorSubject<string>(lang);
  return {
    translations$: new BehaviorSubject<Record<string, any> | null>({}),
    currentLanguage$: current,
    availableLanguages: ADMIN_AVAILABLE_LANGUAGES,
    getValue: jasmine.createSpy('getValue').and.callFake((path: string) => path),
    getMergedSection: jasmine.createSpy('getMergedSection').and.callFake((section: string) =>
      new Proxy({}, { get: (_t, key) => (typeof key === 'string' ? `${section || 'shared'}.${key}` : undefined) })),
    getDateLocale: jasmine.createSpy('getDateLocale').and.callFake(() => (current.getValue() === 'cz' ? 'cs-CZ' : 'en-US')),
    getCurrentLanguage: jasmine.createSpy('getCurrentLanguage').and.callFake(() => current.getValue()),
    setLanguage: jasmine.createSpy('setLanguage').and.callFake((code: string) => current.next(code))
  };
}

/** Permission stub: `granted` is mutable so a test can change permissions on the fly. */
export interface PermissionStub {
  granted: Set<string> | 'all';
  hasPermission: jasmine.Spy<(permission: string) => boolean>;
  setPermissions: jasmine.Spy<(permissions: string[]) => void>;
  clearPermissions: jasmine.Spy<() => void>;
}

/**
 * @description Creates the PermissionService stub.
 * @param granted 'all' (default) grants everything, otherwise the list of granted permissions.
 * @returns Stub; `hasPermission` answers from `granted`.
 */
export function createPermissionStub(granted: string[] | 'all' = 'all'): PermissionStub {
  const stub: PermissionStub = {
    granted: granted === 'all' ? 'all' : new Set(granted),
    hasPermission: jasmine.createSpy('hasPermission'),
    setPermissions: jasmine.createSpy('setPermissions'),
    clearPermissions: jasmine.createSpy('clearPermissions')
  };
  stub.hasPermission.and.callFake((p: string) => stub.granted === 'all' || stub.granted.has(p));
  return stub;
}

/** Auth stub with a controllable login state and session values. */
export interface AuthStub {
  isLoggedIn$: BehaviorSubject<boolean>;
  userEmail$: BehaviorSubject<string | null>;
  session: { userId: string | null; email: string | null; role: string | null; permissions: string[] };
  getUserId: jasmine.Spy; getUserEmail: jasmine.Spy; getUserRole: jasmine.Spy; getUserPermissions: jasmine.Spy;
  getAccessToken: jasmine.Spy; logout: jasmine.Spy; login: jasmine.Spy; verifyTwoFactor: jasmine.Spy;
  resendTwoFactor: jasmine.Spy; requestPasswordReset: jasmine.Spy; resetPassword: jasmine.Spy;
  checkAuth: jasmine.Spy; clearAuthData: jasmine.Spy;
}

/**
 * @description Creates the AuthService stub.
 * @param loggedIn Initial login state (default true).
 * @returns Stub; every async method returns `of({})` unless a test overrides it.
 */
export function createAuthStub(loggedIn = true): AuthStub {
  const session = { userId: '1', email: 'admin@example.test', role: 'admin', permissions: [] as string[] };
  return {
    isLoggedIn$: new BehaviorSubject<boolean>(loggedIn),
    userEmail$: new BehaviorSubject<string | null>(session.email),
    session,
    getUserId: jasmine.createSpy('getUserId').and.callFake(() => session.userId),
    getUserEmail: jasmine.createSpy('getUserEmail').and.callFake(() => session.email),
    getUserRole: jasmine.createSpy('getUserRole').and.callFake(() => session.role),
    getUserPermissions: jasmine.createSpy('getUserPermissions').and.callFake(() => session.permissions),
    getAccessToken: jasmine.createSpy('getAccessToken').and.returnValue('token'),
    logout: jasmine.createSpy('logout').and.returnValue(of({})),
    login: jasmine.createSpy('login').and.returnValue(of({})),
    verifyTwoFactor: jasmine.createSpy('verifyTwoFactor').and.returnValue(of({})),
    resendTwoFactor: jasmine.createSpy('resendTwoFactor').and.returnValue(of({ message: '', expires_in: 300 })),
    requestPasswordReset: jasmine.createSpy('requestPasswordReset').and.returnValue(of({ message: '' })),
    resetPassword: jasmine.createSpy('resetPassword').and.returnValue(of({ message: '' })),
    checkAuth: jasmine.createSpy('checkAuth').and.returnValue(of(true)),
    clearAuthData: jasmine.createSpy('clearAuthData')
  };
}

/**
 * @description Creates a DataHandler spy; every request returns an empty successful response.
 * @returns jasmine spy object (get/getOne/getCollection/getPaginatedCollection/post/put/patch/delete/upload/uploadPut).
 */
export function createDataHandlerSpy(): jasmine.SpyObj<DataHandler> {
  const spy = jasmine.createSpyObj<DataHandler>('DataHandler',
    ['get', 'getOne', 'getCollection', 'getPaginatedCollection', 'post', 'put', 'patch', 'delete', 'upload', 'uploadPut'] as any);
  (spy as any).get.and.returnValue(of({}));
  (spy as any).getOne.and.returnValue(of({}));
  (spy as any).getCollection.and.returnValue(of([]));
  (spy as any).getPaginatedCollection.and.returnValue(of({}));
  (spy as any).post.and.returnValue(of({}));
  (spy as any).put.and.returnValue(of({}));
  (spy as any).patch.and.returnValue(of({}));
  (spy as any).delete.and.returnValue(of(undefined));
  (spy as any).upload.and.returnValue(of({}));
  (spy as any).uploadPut.and.returnValue(of({}));
  return spy;
}

/**
 * @description Builds a Laravel-style paginated response.
 * @param data Rows of the page.
 * @param page Current page (default 1).
 * @param lastPage Last page (default 1).
 * @returns PaginatedResponse<T>.
 */
export function paginated<T>(data: T[], page = 1, lastPage = 1): PaginatedResponse<T> {
  return { data, total: data.length, last_page: lastPage, current_page: page, per_page: 15 } as unknown as PaginatedResponse<T>;
}

/**
 * @description Creates a GenericTableService spy returning an empty page.
 * @returns jasmine spy object (getPaginatedData/preloadAdjacentPages/invalidateEndpoint/invalidateAll).
 */
export function createGenericTableSpy(): jasmine.SpyObj<GenericTableService> {
  const spy = jasmine.createSpyObj<GenericTableService>('GenericTableService',
    ['getPaginatedData', 'preloadAdjacentPages', 'invalidateEndpoint', 'invalidateAll']);
  spy.getPaginatedData.and.returnValue(of(paginated<any>([])));
  return spy;
}

/** Everything a spec may want to inspect after configuring TestBed. */
export interface AdminTestContext {
  providers: Array<Provider | EnvironmentProviders>;
  i18n: I18nStub;
  permissions: PermissionStub;
  auth: AuthStub;
  dataHandler: jasmine.SpyObj<DataHandler>;
  genericTable: jasmine.SpyObj<GenericTableService>;
  alert: jasmine.SpyObj<AlertDialogService>;
  confirm: jasmine.SpyObj<ConfirmDialogService>;
  refreshAll$: Subject<void>;
}

/**
 * @description Creates all admin test doubles and the matching TestBed providers.
 * @param options granted permissions ('all' default), loggedIn (true default), admin language.
 * @returns Context with `providers` for TestBed and every stub for assertions.
 * @note Router: a real router with no routes (`provideRouter([])`); spy on `navigate` in the
 *   test when navigation is asserted. HttpClient: testing backend, so no real request leaves.
 */
export function createAdminTestContext(options: { granted?: string[] | 'all'; loggedIn?: boolean; lang?: string } = {}): AdminTestContext {
  const i18n = createI18nStub(options.lang);
  const permissions = createPermissionStub(options.granted ?? 'all');
  const auth = createAuthStub(options.loggedIn ?? true);
  const dataHandler = createDataHandlerSpy();
  const genericTable = createGenericTableSpy();
  const alert = jasmine.createSpyObj<AlertDialogService>('AlertDialogService', ['open']);
  alert.open.and.returnValue(Promise.resolve());
  const confirm = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['open']);
  confirm.open.and.returnValue(Promise.resolve(true));
  const refreshAll$ = new Subject<void>();
  const refreshBus = { refreshAll$: refreshAll$.asObservable(), triggerGlobalRefresh: jasmine.createSpy('triggerGlobalRefresh') };

  return {
    i18n, permissions, auth, dataHandler, genericTable, alert, confirm, refreshAll$,
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AdminLocalizationService, useValue: i18n },
      { provide: PermissionService, useValue: permissions },
      { provide: AuthService, useValue: auth },
      { provide: DataHandler, useValue: dataHandler },
      { provide: GenericTableService, useValue: genericTable },
      { provide: AlertDialogService, useValue: alert },
      { provide: ConfirmDialogService, useValue: confirm },
      { provide: TableRefreshBusService, useValue: refreshBus }
    ]
  };
}

/** Public-side stubs (LocalizationService + PublicDataService) for components extending BasePublicComponent. */
export interface PublicTestContext {
  providers: Provider[];
  translations$: BehaviorSubject<any>;
  localization: { setModule: jasmine.Spy; getText: jasmine.Spy; currentTranslations$: BehaviorSubject<any>; currentLanguage$: BehaviorSubject<string> };
  publicData: { siteSettingsValue$: BehaviorSubject<any>; getStorageUrl: jasmine.Spy; get: jasmine.Spy };
}

/**
 * @description Creates the public translation / site settings stubs.
 * @param translations Full translations object of the module (e.g. { login: { … } }).
 * @returns Providers and the stubs; `translations$.next()` simulates a language switch.
 */
export function createPublicTestContext(translations: any = {}): PublicTestContext {
  const translations$ = new BehaviorSubject<any>(translations);
  const localization = {
    setModule: jasmine.createSpy('setModule'),
    getText: jasmine.createSpy('getText').and.callFake((key: string) => key),
    currentTranslations$: translations$,
    currentLanguage$: new BehaviorSubject<string>('cz')
  };
  const publicData = {
    siteSettingsValue$: new BehaviorSubject<any>(null),
    getStorageUrl: jasmine.createSpy('getStorageUrl').and.callFake((p: string) => `storage/${p}`),
    get: jasmine.createSpy('get').and.returnValue(of({}))
  };
  return {
    translations$, localization, publicData,
    providers: [
      { provide: LocalizationService, useValue: localization },
      { provide: PublicDataService, useValue: publicData }
    ]
  };
}
