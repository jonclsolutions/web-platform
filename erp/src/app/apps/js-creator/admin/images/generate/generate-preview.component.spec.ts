/**
 * @file generate-preview.component.spec.ts
 * @path src/app/apps/js-creator/admin/images/generate/generate-preview.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of GeneratePreviewComponent: the template drawn in the output mode with
 *   placeholders (its report emitted), scaled into its column, and dragging the image of a field
 *   reported in template px (nothing outside the draggable places), another slide of a carousel
 *   and safe zones over the picture.
 * @dependencies GeneratePreviewComponent, editor-test-data.ts, the canvas of the test browser.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeneratePreviewComponent, PreviewPan } from './generate-preview.component';
import { ImageLayer, TemplateDocument, createLayer, emptyDocument } from '../../shared/render/document';
import { RenderReport } from '../../shared/render/renderer';
import { RenderResourceStore } from '../../shared/render/resource-store';
import { FontLibraryService } from '../../shared/font-library.service';
import { TEST_SIZE } from '../editor/editor-test-data';

/**
 * @description Document with the image field "photo" in the right half (500 × 1000).
 */
function documentWithPhoto(): TemplateDocument {
  const doc = emptyDocument();
  doc.fields = [{ key: 'photo', type: 'image', label: 'Photo', help: '', required: true, minWidth: 0, minHeight: 0 }];
  doc.pages[0].layers = [{
    ...(createLayer('image', TEST_SIZE, 'img') as ImageLayer), anchor: 'tl', x: 500, y: 0, w: 500, h: 1000, source: { kind: 'field', field: 'photo' },
  }];
  return doc;
}

/**
 * @description Waits for the next animation frames (the preview draws in one).
 */
function frames(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

describe('GeneratePreviewComponent', () => {
  let fixture: ComponentFixture<GeneratePreviewComponent>;
  let component: GeneratePreviewComponent;
  let reports: RenderReport[];
  let pans: PreviewPan[];

  /**
   * @description Creates the preview of the test document in a 400 px wide host.
   * @param pannable Keys of the draggable image fields.
   */
  async function create(pannable: string[]): Promise<HTMLCanvasElement> {
    await TestBed.configureTestingModule({ imports: [GeneratePreviewComponent] }).compileComponents();
    fixture = TestBed.createComponent(GeneratePreviewComponent);
    component = fixture.componentInstance;
    (fixture.nativeElement as HTMLElement).style.width = '400px';
    document.body.appendChild(fixture.nativeElement);
    const fonts = { ownName: (id: number) => `u${id}`, curatedName: (s: string) => s } as unknown as FontLibraryService;
    fixture.componentRef.setInput('doc', documentWithPhoto());
    fixture.componentRef.setInput('size', TEST_SIZE);
    fixture.componentRef.setInput('resources', new RenderResourceStore(fonts, () => undefined));
    fixture.componentRef.setInput('values', { text: {}, images: {} });
    fixture.componentRef.setInput('pannable', pannable);
    fixture.componentRef.setInput('maxHeight', 1000);
    reports = [];
    pans = [];
    component.rendered.subscribe(report => reports.push(report));
    component.pan.subscribe(pan => pans.push(pan));
    fixture.detectChanges();
    await frames();
    fixture.detectChanges();
    await frames();
    return fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
  }

  afterEach(() => (fixture?.nativeElement as HTMLElement | undefined)?.remove());

  /**
   * @description The template is scaled into the column and drawn in the output mode: an empty
   *   image field shows a placeholder and is reported missing.
   * @input 1000 × 1000 template in a 400 px column
   * @output canvas 400 × 400 CSS px; a report with missing field:photo
   */
  it('draws the template scaled into its column', async () => {
    const canvas = await create([]);
    expect(canvas.style.width).toBe('400px');
    expect(canvas.style.height).toBe('400px');
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[reports.length - 1].missing).toEqual(['field:photo']);
  });

  /**
   * @description Dragging over a draggable image reports the move in template px; a drag on the
   *   rest of the canvas or without draggable images reports nothing.
   * @input drag 20 CSS px right over the right half (scale 0.4); drag on the left half
   * @output one pan of photo by 50 template px; nothing for the left half
   */
  it('reports drags of draggable images', async () => {
    const canvas = await create(['photo']);
    const rect = canvas.getBoundingClientRect();
    const pointer = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { clientX: rect.left + x, clientY: rect.top + y, pointerId: 1, bubbles: true }));
    pointer('pointerdown', 300, 200);
    pointer('pointermove', 320, 200);
    pointer('pointerup', 320, 200);
    expect(pans.length).toBe(1);
    expect(pans[0].key).toBe('photo');
    expect(pans[0].dx).toBeCloseTo(50);
    expect(pans[0].dy).toBeCloseTo(0);

    pointer('pointerdown', 100, 200);
    pointer('pointermove', 130, 200);
    pointer('pointerup', 130, 200);
    expect(pans.length).toBe(1);
  });

  /**
   * @description Another slide of a carousel is drawn when `page` changes, and safe zones are
   *   laid over the picture in template px.
   * @input document with an empty second slide; page 1; zones [top 0,0 1000×100]
   * @output a new report without missing fields (slide 2 has no photo); one rect 0,0 1000 × 100
   */
  it('draws another slide and the safe zones', async () => {
    await create([]);
    const doc = documentWithPhoto();
    doc.pages.push({ background: doc.pages[0].background, layers: [] });
    fixture.componentRef.setInput('doc', doc);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('zones', [{ part: 'top', x: 0, y: 0, w: 1000, h: 100 }]);
    fixture.detectChanges();
    await frames();
    fixture.detectChanges();
    expect(reports[reports.length - 1].missing).toEqual([]);
    const rects = fixture.nativeElement.querySelectorAll('svg.gp-zones rect');
    expect(rects.length).toBe(1);
    expect(['x', 'y', 'width', 'height'].map(a => rects[0].getAttribute(a))).toEqual(['0', '0', '1000', '100']);
  });
});
