import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphBuilderComponent } from './graph-builder.component';

describe('GraphBuilderComponent', () => {
  let component: GraphBuilderComponent;
  let fixture: ComponentFixture<GraphBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GraphBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
