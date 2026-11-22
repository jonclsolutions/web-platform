/**
 * @file editor-canvas.component.spec.ts
 * @path src/app/apps/js-creator/admin/images/editor/editor-canvas/editor-canvas.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of EditorCanvasComponent with real pointer events on the stage: drawing
 *   and its report, selection by click / Shift / marquee, locked layers, moving with snapping to
 *   the centre of the canvas (guide line), resizing by a handle (also keeping the ratio),
 *   rotating, zooming with Ctrl + wheel and the thumbnail.
 * @dependencies EditorCanvasComponent, EditorStore, RenderResourceStore, editor-test-data.ts.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EditorCanvasComponent } from './editor-canvas.component';
import { EditorStore } from '../editor-store';
import { RenderResourceStore } from '../../../shared/render/resource-store';
import { FontLibraryService } from '../../../shared/font-library.service';
import { RenderReport } from '../../../shared/render/renderer';
import { shapeLayer, testTemplate } from '../editor-test-data';

/** Waits for the scheduled drawing (two animation frames). */
const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

describe('EditorCanvasComponent', () => {
  let fixture: ComponentFixture<EditorCanvasComponent>;
  let component: EditorCanvasComponent;
  let store: EditorStore;
  let stage: HTMLElement;

  /**
   * @description Sends a pointer event in template px (zoom 0.5).
   * @param type pointerdown | pointermove | pointerup.
   * @param x Template x.
   * @param y Template y.
   * @param init Further event properties.
   * @param target Element (default the stage).
   */
  function pointer(type: string, x: number, y: number, init: PointerEventInit = {}, target: Element = stage): void {
    const rect = stage.getBoundingClientRect();
    target.dispatchEvent(new PointerEvent(type, { clientX: rect.left + x * 0.5, clientY: rect.top + y * 0.5, button: 0, bubbles: true, pointerId: 1, ...init }));
    fixture.detectChanges();
  }

  /**
   * @description A whole drag from one point to another.
   * @param from Start (template px).
   * @param to End (template px).
   * @param init Event properties (Shift …).
   * @param target Element of the press.
   */
  function drag(from: [number, number], to: [number, number], init: PointerEventInit = {}, target: Element = stage): void {
    pointer('pointerdown', from[0], from[1], init, target);
    pointer('pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, init);
    pointer('pointermove', to[0], to[1], init);
    pointer('pointerup', to[0], to[1], init);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EditorCanvasComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    store = new EditorStore(testTemplate({ layers: [shapeLayer('a'), shapeLayer('b', 300, 300), { ...shapeLayer('locked', 600, 600), locked: true }] }), true);
    fixture = TestBed.createComponent(EditorCanvasComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('store', store);
    fixture.componentRef.setInput('resources', new RenderResourceStore(TestBed.inject(FontLibraryService), () => undefined));
    fixture.componentRef.setInput('zoom', 0.5);
    fixture.detectChanges();
    stage = fixture.nativeElement.querySelector('.ec-stage');
  });

  /**
   * @description The template is drawn at the zoom (CSS size) and the report is emitted.
   * @input 1000 × 1000 at 50 %
   * @output stage 500 × 500; a report without overflows
   */
  it('draws the template', async () => {
    const reports: RenderReport[] = [];
    component.rendered.subscribe(r => reports.push(r));
    await frames();
    expect(stage.style.width).toBe('500px');
    expect(fixture.nativeElement.querySelector('canvas').width).toBeGreaterThanOrEqual(500);
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[reports.length - 1].overflows).toEqual([]);
  });

  /**
   * @description A click selects the topmost layer, Shift adds, a click on the empty canvas
   *   clears; a locked layer is never picked; a marquee selects the layers it touches.
   * @input clicks on a, Shift on b, empty place, the locked layer; marquee over a and b
   * @output [a]; [a, b]; []; []; [a, b]
   */
  it('selects by click and marquee', () => {
    pointer('pointerdown', 50, 50);
    pointer('pointerup', 50, 50);
    expect(store.selection()).toEqual(['a']);
    pointer('pointerdown', 350, 350, { shiftKey: true });
    pointer('pointerup', 350, 350, { shiftKey: true });
    expect(store.selection()).toEqual(['a', 'b']);
    pointer('pointerdown', 900, 100);
    pointer('pointerup', 900, 100);
    expect(store.selection()).toEqual([]);
    pointer('pointerdown', 650, 650);
    pointer('pointerup', 650, 650);
    expect(store.selection()).toEqual([]);
    drag([450, 50], [50, 350]);
    expect(store.selection()).toEqual(['a', 'b']);
  });

  /**
   * @description Dragging moves the selection; near the centre of the canvas it snaps and a
   *   guide is shown while dragging; one drag is one step of the history.
   * @input drag a by +447 px (its centre to 497)
   * @output x 450 (centre 500); a guide at x 500 during the drag; one undo returns x 0
   */
  it('moves with snapping', () => {
    pointer('pointerdown', 50, 50);
    pointer('pointermove', 200, 50);
    pointer('pointermove', 497, 50);
    expect(component.guideLines().some(g => g.x1 === 500 && g.x2 === 500)).toBeTrue();
    pointer('pointerup', 497, 50);
    expect(store.layers()[0].x).toBe(450);
    expect(component.guideLines()).toEqual([]);
    store.undo();
    expect(store.layers()[0].x).toBe(0);
  });

  /**
   * @description The bottom right handle resizes (the top left corner stays); Shift keeps the
   *   ratio; the rotation handle turns the layer.
   * @input select b (300,300 100 × 100); se handle to 450,520; Shift: se to 600,500; rotation handle to the right
   * @output 150 × 220 at 300,300; 300 × 440 (ratio kept) after Shift; rotation 90
   */
  it('resizes and rotates by the handles', () => {
    store.select(['b']);
    fixture.detectChanges();
    const handle = () => fixture.nativeElement.querySelector('[data-handle="se"]') as Element;
    drag([400, 400], [450, 520], { altKey: true }, handle());
    const b = store.layers()[1];
    expect([b.x, b.y, b.w, b.h]).toEqual([300, 300, 150, 220]);

    drag([450, 520], [600, 500], { shiftKey: true, altKey: true }, handle());
    const resized = store.layers()[1];
    expect([resized.x, resized.y, resized.w, resized.h]).toEqual([300, 300, 300, 440]);

    const rotate = fixture.nativeElement.querySelector('[data-handle="rotate"]') as Element;
    const center = { x: 300 + resized.w / 2, y: 300 + resized.h / 2 };
    drag([center.x, 250], [center.x + 200, center.y], {}, rotate);
    expect(store.layers()[1].rotation).toBe(90);
  });

  /**
   * @description Ctrl + wheel zooms (a plain wheel does not); the thumbnail is an image of at
   *   most the given edge.
   * @input wheel up with Ctrl; wheel without Ctrl; thumbnail(100)
   * @output zoom 0.55; unchanged; a PNG / WebP blob
   */
  it('zooms with Ctrl + wheel and makes a thumbnail', async () => {
    const viewport = fixture.nativeElement.querySelector('.ec-viewport') as HTMLElement;
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(component.zoom()).toBe(0.55);
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    expect(component.zoom()).toBe(0.55);

    store.addLayer('text');
    const blob = await component.thumbnail(100);
    expect(blob).not.toBeNull();
    expect(['image/webp', 'image/png']).toContain(blob!.type);
  });
});
