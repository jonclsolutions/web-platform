/**
 * @file generate-preview.component.ts
 * @path src/app/apps/js-creator/admin/images/generate/generate-preview.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Live preview of generating: the template drawn by the renderer in the output mode
 *   (the same drawing as the output - only image fields without a photo show a placeholder),
 *   scaled to the width of its column and to `maxHeight`. An image of a field can be moved in its
 *   place by dragging (mouse or finger): the component reports the drag, the page changes the
 *   crop. Every drawing reports overflowing texts and missing images.
 * @usage `<app-jc-generate-preview [doc]="doc" [size]="size" [resources]="resources" [values]="values"
 *   [redraw]="redraw()" [pannable]="keys" (rendered)="report.set($event)" (pan)="onPan($event)" />`
 * @dependencies renderer.ts, field-images.ts, RenderResourceStore.
 */

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { CanvasSize, TemplateDocument } from '../../shared/render/document';
import { RenderReport, RenderValues, renderPage } from '../../shared/render/renderer';
import { RenderResourceStore } from '../../shared/render/resource-store';
import { FieldImageBox, boxContains, fieldImageBoxes } from '../../shared/render/field-images';
import { Point } from '../../shared/render/geometry';

/** A drag of the image of a field (template px since the last event). */
export interface PreviewPan {
  key: string;
  box: FieldImageBox;
  dx: number;
  dy: number;
}

/** Largest canvas bitmap (pixels). */
const MAX_BITMAP = 9_000_000;

@Component({
  selector: 'app-jc-generate-preview',
  standalone: true,
  template: `
    <div #wrap class="gp-wrap">
      <canvas #canvas class="gp-canvas" [class.gp-canvas--pannable]="pannable().length > 0"
        [style.width.px]="cssSize().width" [style.height.px]="cssSize().height" [style.cursor]="cursor()"
        role="img" [attr.aria-label]="label()"
        (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)"
        (pointerleave)="cursor.set('default')"></canvas>
    </div>
  `,
  styleUrl: './generate-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneratePreviewComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  /** Document of the template. */
  readonly doc = input.required<TemplateDocument>();
  /** Size of the template. */
  readonly size = input.required<CanvasSize>();
  /** Images, fonts, icons. */
  readonly resources = input.required<RenderResourceStore>();
  /** Values of the fields with the crops. */
  readonly values = input.required<RenderValues>();
  /** Changes when a resource finished loading. */
  readonly redraw = input(0);
  /** Keys of the image fields that have an image (can be dragged). */
  readonly pannable = input<string[]>([]);
  /** Highest preview (CSS px). */
  readonly maxHeight = input(640);
  /** Accessible description of the picture. */
  readonly label = input('');
  /** Report of every drawing. */
  readonly rendered = output<RenderReport>();
  /** A drag of the image of a field. */
  readonly pan = output<PreviewPan>();

  @ViewChild('wrap', { static: true }) private wrap!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Width of the column (CSS px). */
  private readonly available = signal(0);
  /** Cursor over the canvas. */
  readonly cursor = signal('default');
  /** Running drag. */
  private drag: { key: string; box: FieldImageBox; last: Point; pointer: number } | null = null;
  /** Observer of the width of the column. */
  private observer?: ResizeObserver;
  /** Frame of the scheduled drawing. */
  private frame = 0;

  /** CSS size of the canvas (the template scaled into the column and maxHeight). */
  readonly cssSize = computed(() => {
    const size = this.size();
    const width = Math.max(1, this.available());
    const scale = Math.min(width / size.width, this.maxHeight() / size.height, 1);
    return { width: Math.max(1, Math.floor(size.width * scale)), height: Math.max(1, Math.floor(size.height * scale)) };
  });

  /** Places of the draggable images, topmost last. */
  private readonly boxes = computed(() => {
    const doc = this.doc();
    const size = this.size();
    const resources = this.resources();
    return this.pannable().flatMap(key => fieldImageBoxes(doc, size, key, 0, id => resources.block(id)).map(box => ({ key, box })));
  });

  constructor() {
    effect(() => {
      this.doc();
      this.values();
      this.redraw();
      this.cssSize();
      this.schedule();
    });
  }

  /** @description Watches the width of the column. */
  ngAfterViewInit(): void {
    const element = this.wrap.nativeElement;
    this.available.set(element.clientWidth);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(entries => this.zone.run(() => this.available.set(Math.floor(entries[0].contentRect.width))));
      this.observer.observe(element);
    }
  }

  /** @description Stops watching and drawing. */
  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  /**
   * @description Starts dragging the image under the pointer.
   * @param event Pointer event.
   */
  down(event: PointerEvent): void {
    const point = this.toTemplate(event);
    const hit = this.hit(point);
    if (!hit) return;
    event.preventDefault();
    this.canvasRef.nativeElement.setPointerCapture?.(event.pointerId);
    this.drag = { ...hit, last: point, pointer: event.pointerId };
    this.cursor.set('grabbing');
  }

  /**
   * @description Moves the dragged image, or shows that an image can be dragged.
   * @param event Pointer event.
   */
  move(event: PointerEvent): void {
    const point = this.toTemplate(event);
    if (this.drag && event.pointerId === this.drag.pointer) {
      const dx = point.x - this.drag.last.x;
      const dy = point.y - this.drag.last.y;
      this.drag.last = point;
      if (dx || dy) this.pan.emit({ key: this.drag.key, box: this.drag.box, dx, dy });
      return;
    }
    this.cursor.set(this.hit(point) ? 'grab' : 'default');
  }

  /**
   * @description Ends a drag.
   * @param event Pointer event.
   */
  up(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointer) return;
    this.drag = null;
    this.cursor.set('grab');
  }

  /**
   * @description The topmost draggable place under a point.
   * @param point Template px.
   */
  private hit(point: Point): { key: string; box: FieldImageBox } | null {
    const boxes = this.boxes();
    for (let i = boxes.length - 1; i >= 0; i--) {
      if (boxContains(boxes[i].box, point)) return boxes[i];
    }
    return null;
  }

  /**
   * @description Pointer position in template px.
   * @param event Pointer event.
   */
  private toTemplate(event: PointerEvent): Point {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const size = this.size();
    return {
      x: ((event.clientX - rect.left) * size.width) / Math.max(1, rect.width),
      y: ((event.clientY - rect.top) * size.height) / Math.max(1, rect.height),
    };
  }

  /** @description Draws in the next animation frame (once per frame). */
  private schedule(): void {
    if (this.frame || typeof requestAnimationFrame === 'undefined') return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  /** @description Draws the template at the size of the canvas and the pixel ratio of the screen. */
  private draw(): void {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const size = this.size();
    const css = this.cssSize();
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (css.width * css.height * dpr * dpr > MAX_BITMAP) dpr = Math.sqrt(MAX_BITMAP / (css.width * css.height));
    const width = Math.max(1, Math.round(css.width * dpr));
    const height = Math.max(1, Math.round(css.height * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(width / size.width, 0, 0, height / size.height, 0, 0);
    const report = renderPage(ctx, this.doc(), size, this.resources(), { mode: 'output', placeholders: true, values: this.values() });
    this.zone.run(() => this.rendered.emit(report));
  }
}
