import { TestBed } from '@angular/core/testing';

import { PermissionOptionsService } from './permission-options.service';

describe('PermissionOptionsService', () => {
  let service: PermissionOptionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PermissionOptionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
