import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectPortalComponent } from './project-portal.component';

describe('ProjectPortalComponent', () => {
  let component: ProjectPortalComponent;
  let fixture: ComponentFixture<ProjectPortalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectPortalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectPortalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
