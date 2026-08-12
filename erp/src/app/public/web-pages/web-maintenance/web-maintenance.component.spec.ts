import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebMaintenanceComponent } from './web-maintenance.component';

describe('WebMaintenanceComponent', () => {
  let component: WebMaintenanceComponent;
  let fixture: ComponentFixture<WebMaintenanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebMaintenanceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebMaintenanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
