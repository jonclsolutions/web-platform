import { TestBed } from '@angular/core/testing';

import { ProjectPortalLocalizationService } from './project-portal-localization.service';

describe('ProjectPortalLocalizationService', () => {
  let service: ProjectPortalLocalizationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectPortalLocalizationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
