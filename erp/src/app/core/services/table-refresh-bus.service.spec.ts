import { TestBed } from '@angular/core/testing';

import { TableRefreshBusService } from './table-refresh-bus.service';

describe('TableRefreshBusService', () => {
  let service: TableRefreshBusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TableRefreshBusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
