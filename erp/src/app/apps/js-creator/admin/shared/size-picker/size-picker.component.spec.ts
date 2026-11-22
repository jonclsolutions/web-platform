/**
 * @file size-picker.component.spec.ts
 * @path src/app/apps/js-creator/admin/shared/size-picker/size-picker.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of SizePickerComponent: a preset size selects its preset, another size
 *   "custom" with the inputs; choosing a preset emits its size; custom sides are emitted whole.
 * @dependencies SizePickerComponent, admin-test-helpers.ts.
 */

import { TestBed } from '@angular/core/testing';
import { SizePickerComponent } from './size-picker.component';
import { CanvasSize } from '../render/document';
import { createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

describe('SizePickerComponent', () => {
  /**
   * @description Presets and custom sizes.
   * @input 1080 × 1350; 777 × 500; choose ig-story; custom width 900.4
   * @output ig-portrait without inputs; custom with inputs; emits 1080 × 1920; emits 900 × 500
   */
  it('chooses presets and custom sizes', async () => {
    await TestBed.configureTestingModule({ imports: [SizePickerComponent], providers: createAdminTestContext().providers }).compileComponents();
    const fixture = TestBed.createComponent(SizePickerComponent);
    const component = fixture.componentInstance;
    const sizes: CanvasSize[] = [];
    component.sizeChange.subscribe(s => sizes.push(s));
    component.size = { width: 1080, height: 1350 };
    fixture.detectChanges();
    expect(component.selected).toBe('ig-portrait');
    expect(fixture.nativeElement.querySelector('.sp-custom')).toBeNull();

    fixture.componentRef.setInput('size', { width: 777, height: 500 });
    fixture.detectChanges();
    expect(component.selected).toBe('custom');
    expect(fixture.nativeElement.querySelector('.sp-custom')).not.toBeNull();

    component.choose('ig-story');
    component.setSide('width', 900.4);
    expect(sizes).toEqual([{ width: 1080, height: 1920 }, { width: 900, height: 500 }]);
  });
});
