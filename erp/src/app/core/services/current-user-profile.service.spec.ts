import { TestBed } from '@angular/core/testing';

import { CurrentUserProfileService } from './current-user-profile.service';

describe('CurrentUserProfileService', () => {
  let service: CurrentUserProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CurrentUserProfileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
