import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActionMenuBuilderComponent } from './action-menu-builder.component';

describe('ActionMenuBuilderComponent', () => {
  let component: ActionMenuBuilderComponent;
  let fixture: ComponentFixture<ActionMenuBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionMenuBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActionMenuBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
