import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PasswordRequirementsChecklistComponent } from './password-requirements-checklist.component';

describe('PasswordRequirementsChecklistComponent', () => {
  let component: PasswordRequirementsChecklistComponent;
  let fixture: ComponentFixture<PasswordRequirementsChecklistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordRequirementsChecklistComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PasswordRequirementsChecklistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
