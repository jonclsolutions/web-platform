import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { IntroductionsComponent } from './introductions.component';

describe('IntroductionsComponent', () => {
  let component: IntroductionsComponent;
  let fixture: ComponentFixture<IntroductionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntroductionsComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IntroductionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});