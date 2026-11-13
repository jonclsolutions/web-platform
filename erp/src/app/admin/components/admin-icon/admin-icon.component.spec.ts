/**
 * @file admin-icon.component.spec.ts
 * @path src/app/admin/components/admin-icon/admin-icon.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AdminIconComponent: the named icon is drawn in the requested size,
 *   hidden from assistive technology.
 * @dependencies none
 */

import { TestBed } from '@angular/core/testing';

import { AdminIconComponent } from './admin-icon.component';

describe('AdminIconComponent', () => {
  /**
   * @description An icon renders its shapes; size and line width are set; aria-hidden.
   * @input name 'folder', size 20, strokeWidth 2.5; then name 'layers'.
   * @output svg 20×20, stroke-width 2.5, aria-hidden, one path; layers: polygon + 2 polylines.
   */
  it('draws the named icon', async () => {
    await TestBed.configureTestingModule({ imports: [AdminIconComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AdminIconComponent);
    fixture.componentRef.setInput('name', 'folder');
    fixture.componentRef.setInput('size', 20);
    fixture.componentRef.setInput('strokeWidth', 2.5);
    fixture.detectChanges();
    const svg: SVGElement = fixture.nativeElement.querySelector('svg');
    expect([svg.getAttribute('width'), svg.getAttribute('height'), svg.getAttribute('stroke-width')]).toEqual(['20', '20', '2.5']);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('path').length).toBe(1);

    fixture.componentRef.setInput('name', 'layers');
    fixture.detectChanges();
    expect([svg.querySelectorAll('polygon').length, svg.querySelectorAll('polyline').length]).toEqual([1, 2]);
  });
});
