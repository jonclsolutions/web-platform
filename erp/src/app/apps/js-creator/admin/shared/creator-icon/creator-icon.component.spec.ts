/**
 * @file creator-icon.component.spec.ts
 * @path src/app/apps/js-creator/admin/shared/creator-icon/creator-icon.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of CreatorIconComponent: every element of the list is drawn with its
 *   attributes; decorative unless labelled.
 * @dependencies none
 */

import { TestBed } from '@angular/core/testing';
import { CreatorIconComponent } from './creator-icon.component';

describe('CreatorIconComponent', () => {
  /**
   * @description Path, circle, line and rect of the list become SVG elements with their
   *   attributes; size and label are applied.
   * @input four nodes, size 32, label "Srdce"
   * @output path d, circle r, line x2, rect width; width 32; role img + aria-label
   */
  it('draws the elements of an icon', async () => {
    await TestBed.configureTestingModule({ imports: [CreatorIconComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CreatorIconComponent);
    fixture.componentRef.setInput('nodes', [
      ['path', { d: 'M1 1h2' }], ['circle', { cx: '12', cy: '12', r: '4' }], ['line', { x1: '0', y1: '0', x2: '5', y2: '5' }],
      ['rect', { x: '1', y: '1', width: '6', height: '6', rx: '1' }],
    ]);
    fixture.componentRef.setInput('size', 32);
    fixture.componentRef.setInput('label', 'Srdce');
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.querySelector('path')!.getAttribute('d')).toBe('M1 1h2');
    expect(svg.querySelector('circle')!.getAttribute('r')).toBe('4');
    expect(svg.querySelector('line')!.getAttribute('x2')).toBe('5');
    expect(svg.querySelector('rect')!.getAttribute('width')).toBe('6');
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Srdce');
  });
});
