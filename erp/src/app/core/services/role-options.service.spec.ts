import { TestBed } from '@angular/core/testing';

import { RoleOptionsService } from './role-options.service';

describe('RoleOptionsService', () => {
  let service: RoleOptionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RoleOptionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
