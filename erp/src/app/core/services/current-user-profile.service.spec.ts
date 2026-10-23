/**
 * @file current-user-profile.service.spec.ts
 * @path src/app/core/services/current-user-profile.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CurrentUserProfileService: the profile of the logged-in user is
 *   loaded once per user (cached per user id) and invalidate() forces a reload.
 * @dependencies
 * - DataHandler spy, AuthService stub, real ResourceCacheService.
 */

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CurrentUserProfileService } from './current-user-profile.service';
import { DataHandler } from './data-handler.service';
import { AuthService } from '../auth/auth.service';
import { AuthStub, createAuthStub, createDataHandlerSpy } from '../../../testing/admin-test-helpers';

describe('CurrentUserProfileService', () => {
  let service: CurrentUserProfileService;
  let dataHandler: jasmine.SpyObj<DataHandler>;
  let auth: AuthStub;

  beforeEach(() => {
    dataHandler = createDataHandlerSpy();
    dataHandler.get.and.callFake((url: string) => of({ url } as any));
    auth = createAuthStub();
    TestBed.configureTestingModule({
      providers: [{ provide: DataHandler, useValue: dataHandler }, { provide: AuthService, useValue: auth }]
    });
    service = TestBed.inject(CurrentUserProfileService);
  });

  /**
   * @description Same user → one request; other user → own request; invalidate → reload.
   * @input getProfile() ×2 as user 1; as user 2; invalidate() as 2 + getProfile().
   * @output core/users/1 once, core/users/2 twice in total.
   */
  it('caches the profile per user and reloads after invalidate', () => {
    let profile: any;
    service.getProfile().subscribe(p => (profile = p));
    service.getProfile().subscribe();
    expect(profile).toEqual({ url: 'core/users/1' });
    expect(dataHandler.get).toHaveBeenCalledTimes(1);

    auth.session.userId = '2';
    service.getProfile().subscribe();
    service.invalidate();
    service.getProfile().subscribe();
    expect(dataHandler.get.calls.allArgs()).toEqual([['core/users/1'], ['core/users/2'], ['core/users/2']]);
  });
});
