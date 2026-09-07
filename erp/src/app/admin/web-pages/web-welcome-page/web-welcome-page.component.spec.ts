import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebWelcomePageComponent } from './web-welcome-page.component';

describe('WebWelcomePageComponent', () => {
  let component: WebWelcomePageComponent;
  let fixture: ComponentFixture<WebWelcomePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebWelcomePageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebWelcomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
