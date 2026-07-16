import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterFormBuilderComponent } from './filter-form-builder.component';

describe('FilterFormBuilderComponent', () => {
  let component: FilterFormBuilderComponent;
  let fixture: ComponentFixture<FilterFormBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterFormBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FilterFormBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
