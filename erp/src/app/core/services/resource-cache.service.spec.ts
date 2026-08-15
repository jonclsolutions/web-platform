import { TestBed } from '@angular/core/testing';

import { ResourceCacheService } from './resource-cache.service';

describe('ResourceCacheService', () => {
  let service: ResourceCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ResourceCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
