import { TestBed } from '@angular/core/testing';

import { AdminLocalizationService } from './admin-localization.service';

describe('AdminLocalizationService', () => {
  let service: AdminLocalizationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminLocalizationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
