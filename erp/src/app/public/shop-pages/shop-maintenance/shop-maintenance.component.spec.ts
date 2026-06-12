import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopMaintenanceComponent } from './shop-maintenance.component';

describe('ShopMaintenanceComponent', () => {
  let component: ShopMaintenanceComponent;
  let fixture: ComponentFixture<ShopMaintenanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopMaintenanceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShopMaintenanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
