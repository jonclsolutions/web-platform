import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditEshopComponent } from './edit-eshop.component';

describe('EditEshopComponent', () => {
  let component: EditEshopComponent;
  let fixture: ComponentFixture<EditEshopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditEshopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditEshopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
