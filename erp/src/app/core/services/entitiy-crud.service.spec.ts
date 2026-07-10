import { TestBed } from '@angular/core/testing';

import { EntitiyCrudService } from './entitiy-crud.service';

describe('EntitiyCrudService', () => {
  let service: EntitiyCrudService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EntitiyCrudService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
