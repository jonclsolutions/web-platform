import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportPopupBuilderComponent } from './import-popup-builder.component';

describe('ImportPopupBuilderComponent', () => {
  let component: ImportPopupBuilderComponent;
  let fixture: ComponentFixture<ImportPopupBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportPopupBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportPopupBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
