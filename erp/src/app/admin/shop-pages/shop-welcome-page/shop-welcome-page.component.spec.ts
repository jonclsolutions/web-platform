import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopWelcomePageComponent } from './shop-welcome-page.component';

describe('ShopWelcomePageComponent', () => {
  let component: ShopWelcomePageComponent;
  let fixture: ComponentFixture<ShopWelcomePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopWelcomePageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShopWelcomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
