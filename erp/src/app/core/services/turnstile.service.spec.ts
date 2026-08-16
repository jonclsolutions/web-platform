import { TestBed } from '@angular/core/testing';

import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let service: TurnstileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TurnstileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
