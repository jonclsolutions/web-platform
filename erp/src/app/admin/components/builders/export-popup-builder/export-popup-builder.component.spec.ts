import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportPopupBuilderComponent } from './export-popup-builder.component';

describe('ExportPopupBuilderComponent', () => {
  let component: ExportPopupBuilderComponent;
  let fixture: ComponentFixture<ExportPopupBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportPopupBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExportPopupBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
