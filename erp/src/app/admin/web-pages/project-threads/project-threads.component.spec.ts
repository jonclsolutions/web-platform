import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectThreadsComponent } from './project-threads.component';

describe('ProjectThreadsComponent', () => {
  let component: ProjectThreadsComponent;
  let fixture: ComponentFixture<ProjectThreadsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectThreadsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectThreadsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
