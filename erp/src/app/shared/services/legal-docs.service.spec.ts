import { TestBed } from '@angular/core/testing';

import { LegalDocsService } from './legal-docs.service';

describe('LegalDocsService', () => {
  let service: LegalDocsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LegalDocsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
