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

  /**
   * @description The icons of the dashboards and of the export formats (formerly SVG inserted as
   *   HTML) are drawn by the template - every one has its shapes.
   * @input names braces, clipboard, inbox, legal, link, mail, package, scale, table, ticket
   * @output each svg has at least one shape; table: rect + 4 lines; package: path + polyline + line
   */
  it('draws the icons of the dashboards and of the export formats', async () => {
    await TestBed.configureTestingModule({ imports: [AdminIconComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AdminIconComponent);
    const svg = () => fixture.nativeElement.querySelector('svg') as SVGElement;
    for (const name of ['braces', 'clipboard', 'inbox', 'legal', 'link', 'mail', 'package', 'scale', 'table', 'ticket'] as const) {
      fixture.componentRef.setInput('name', name);
      fixture.detectChanges();
      expect(svg().querySelectorAll('path, line, rect, circle, polyline, polygon').length).withContext(name).toBeGreaterThan(0);
    }
    fixture.componentRef.setInput('name', 'table');
    fixture.detectChanges();
    expect([svg().querySelectorAll('rect').length, svg().querySelectorAll('line').length]).toEqual([1, 4]);
    fixture.componentRef.setInput('name', 'package');
    fixture.detectChanges();
    expect([svg().querySelectorAll('path').length, svg().querySelectorAll('polyline').length, svg().querySelectorAll('line').length]).toEqual([1, 1, 1]);
  });
});
