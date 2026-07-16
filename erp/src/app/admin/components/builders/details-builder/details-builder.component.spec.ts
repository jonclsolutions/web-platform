import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailsBuilderComponent } from './details-builder.component';

describe('DetailsBuilderComponent', () => {
  let component: DetailsBuilderComponent;
  let fixture: ComponentFixture<DetailsBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailsBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetailsBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
