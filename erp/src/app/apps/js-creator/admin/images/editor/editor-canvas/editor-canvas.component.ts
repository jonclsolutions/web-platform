/**
 * @file editor-canvas.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/editor-canvas/editor-canvas.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The canvas of the template editor: the template drawn by the renderer (the same
 *   drawing as the output) at the zoom of the editor, and above it an SVG layer of the editor
 *   only - selection, handles, smart guides, grid, safe zone, marquee. Pointer work:
 *   - click selects (Shift adds / removes), a drag moves the selection (snapping to the canvas,
 *     other layers and the grid), a drag on the empty canvas selects by a marquee;
 *   - 8 handles resize one layer (Shift keeps the ratio, also for rotated layers), the round
 *     handle rotates it (Shift = steps of 15°);
 *   - Space + drag or the middle button pans, Ctrl + wheel zooms around the pointer.
 *   Locked and hidden layers are not picked on the canvas.
 * @usage `<app-jc-editor-canvas [store]="store" [resources]="resources" [(zoom)]="zoom" … />`
 * @dependencies EditorStore, RenderResourceStore, renderer, geometry, snapping.
 */

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, effect, inject, input, model, output, signal,
} from '@angular/core';
import { EditorStore } from '../editor-store';
import { RenderResourceStore } from '../../../shared/render/resource-store';
import { RenderReport, renderPage } from '../../../shared/render/renderer';
import { Layer, safeZoneOf } from '../../../shared/render/document';
import {
  Point, Rect, boundingBox, containsPoint, intersects, layerRect, offsetFor, rotatedCorners, toLocal, unionRect,
} from '../../../shared/render/geometry';
import { GuideLine, SnapSettings, snapAngle, snapBox, snapEdge, snapTargets } from './snapping';

/** Handle of a box: corners and edges (n = top …). */
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Running pointer work. */
type Drag =
  | { kind: 'move'; start: Point; origins: Map<string, { x: number; y: number }>; box: Rect; moved: boolean }
  | { kind: 'resize'; id: string; handle: Handle; rect: Rect; rotation: number; ratio: number }
  | { kind: 'rotate'; id: string; center: Point }
  | { kind: 'marquee'; start: Point; current: Point; base: string[]; add: boolean }
  | { kind: 'pan'; x: number; y: number; left: number; top: number };

/** Handles with their position in the box (0-1) and cursor. */
const HANDLES: { handle: Handle; fx: number; fy: number; cursor: string }[] = [
  { handle: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' }, { handle: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { handle: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' }, { handle: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { handle: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' }, { handle: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { handle: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' }, { handle: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' },
];

/** Limits of the zoom. */
export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 4;

/** Edge of a handle (CSS px). */
const HANDLE_PX = 9;
/** Snapping distance (CSS px). */
const SNAP_PX = 6;
/** Largest canvas bitmap (pixels) - the device pixel ratio is lowered above it. */
const MAX_BITMAP = 16_000_000;

@Component({
  selector: 'app-jc-editor-canvas',
  standalone: true,
  templateUrl: './editor-canvas.component.html',
  styleUrl: './editor-canvas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorCanvasComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  /** State of the editor. */
  readonly store = input.required<EditorStore>();
  /** Images, fonts and icons of the renderer. */
  readonly resources = input.required<RenderResourceStore>();
  /** Zoom (1 = 100 %). */
  readonly zoom = model(1);
  /** Snapping to the grid: grid size in px (0 = off). */
  readonly grid = input(0);
  /** Smart guides on. */
  readonly guides = input(true);
  /** Safe zone of Stories / Reels shown. */
  readonly safeZone = input(false);
  /** Space held: dragging pans. */
  readonly panMode = input(false);
  /** Changes when a resource finished loading (draw again). */
  readonly redraw = input(0);
  /** Report of the last drawing (overflowing texts, missing images). */
  readonly rendered = output<RenderReport>();
  /** Double click on a text layer (edit its text). */
  readonly editText = output<string>();

  @ViewChild('viewport', { static: true }) private viewport!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stage', { static: true }) private stage!: ElementRef<HTMLDivElement>;

  /** Running pointer work. */
  private drag: Drag | null = null;
  /** Frame of the scheduled drawing. */
  private frame = 0;

  /** Guides shown while snapping. */
  readonly guideLines = signal<GuideLine[]>([]);
  /** Marquee of the selection (template px). */
  readonly marquee = signal<Rect | null>(null);
  /** Layer under the pointer. */
  readonly hovered = signal<string | null>(null);
  /** Cursor of the stage. */
  readonly cursor = signal('default');

  /** Size of the template. */
  readonly size = computed(() => this.store().size());
  /** CSS size of the stage. */
  readonly stageWidth = computed(() => Math.max(1, Math.round(this.size().width * this.zoom())));
  readonly stageHeight = computed(() => Math.max(1, Math.round(this.size().height * this.zoom())));
  /** One CSS pixel in template px (sizes of handles and strokes of the SVG layer). */
  readonly px = computed(() => 1 / this.zoom());
  /** Safe zone bands, when shown. */
  readonly safe = computed(() => this.safeZone() ? safeZoneOf(this.size()) : null);
  /** Outlines of the selected layers (points of a polygon). */
  readonly outlines = computed(() => {
    const size = this.size();
    return this.store().selectedLayers().map(l => ({
      id: l.id, locked: l.locked, points: rotatedCorners(layerRect(l, size), l.rotation).map(p => `${p.x},${p.y}`).join(' '),
    }));
  });
  /** Outline of the hovered layer (not selected). */
  readonly hoverOutline = computed(() => {
    const id = this.hovered();
    if (!id || this.store().selection().includes(id)) return null;
    const layer = this.store().layers().find(l => l.id === id);
    return layer ? rotatedCorners(layerRect(layer, this.size()), layer.rotation).map(p => `${p.x},${p.y}`).join(' ') : null;
  });
  /** Box around several selected layers. */
  readonly groupBox = computed(() => {
    const layers = this.store().selectedLayers();
    return layers.length > 1 ? unionRect(layers.map(l => boundingBox(layerRect(l, this.size()), l.rotation))) : null;
  });
  /** Handles of the one selected, unlocked layer. */
  readonly handles = computed(() => {
    const layer = this.store().selectedLayer();
    if (!layer || layer.locked || !this.store().editable) return null;
    const rect = layerRect(layer, this.size());
    const corner = (fx: number, fy: number) => this.rotatePoint({ x: rect.x + rect.w * fx, y: rect.y + rect.h * fy }, rect, layer.rotation);
    const top = corner(0.5, 0);
    const rotate = this.rotatePoint({ x: rect.x + rect.w / 2, y: rect.y - 28 * this.px() }, rect, layer.rotation);
    return {
      handles: HANDLES.map(h => ({ ...h, at: corner(h.fx, h.fy) })),
      rotate, top,
    };
  });

  constructor() {
    effect(() => {
      this.store().state();
      this.zoom();
      this.redraw();
      this.scheduleDraw();
    });
  }

  /** @description Draws the first frame. */
  ngAfterViewInit(): void {
    this.scheduleDraw();
  }

  /** @description Cancels a scheduled drawing. */
  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }

  /**
   * @description Zoom that fits the whole template into the visible area.
   * @returns The zoom.
   */
  fitZoom(): number {
    const view = this.viewport.nativeElement;
    const size = this.size();
    const zoom = Math.min((view.clientWidth - 96) / size.width, (view.clientHeight - 96) / size.height);
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(zoom * 100) / 100 || ZOOM_MIN));
  }

  /**
   * @description The canvas as an image of the current drawing (thumbnail of the template): the
   *   template drawn again at a scale whose longer side is `edge` px.
   * @param edge Longest side (px).
   * @returns PNG / WebP blob.
   */
  async thumbnail(edge = 480): Promise<Blob | null> {
    const size = this.size();
    const scale = Math.min(1, edge / Math.max(size.width, size.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(size.width * scale));
    canvas.height = Math.max(1, Math.round(size.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    renderPage(ctx, this.store().doc(), size, this.resources(), { mode: 'editor' });
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/webp', 0.85));
  }

  /**
   * @description Pointer pressed on the stage.
   * @param event Pointer event.
   */
  onPointerDown(event: PointerEvent): void {
    const view = this.viewport.nativeElement;
    if (event.button === 1 || (event.button === 0 && this.panMode())) {
      this.drag = { kind: 'pan', x: event.clientX, y: event.clientY, left: view.scrollLeft, top: view.scrollTop };
      this.capture(event);
      this.cursor.set('grabbing');
      event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    const store = this.store();
    const point = this.toCanvas(event);
    const target = (event.target as Element | null)?.closest('[data-handle]');
    const single = store.selectedLayer();
    if (target && single && store.editable) {
      const handle = target.getAttribute('data-handle');
      const rect = layerRect(single, this.size());
      this.drag = handle === 'rotate'
        ? { kind: 'rotate', id: single.id, center: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } }
        : { kind: 'resize', id: single.id, handle: handle as Handle, rect, rotation: single.rotation, ratio: rect.w / rect.h };
      this.capture(event);
      event.preventDefault();
      return;
    }

    const hit = this.hitTest(point);
    if (hit) {
      if (event.shiftKey) {
        store.select([hit.id], true);
      } else if (!store.selection().includes(hit.id)) {
        store.select([hit.id]);
      }
      const movable = store.selectedLayers().filter(l => !l.locked);
      if (store.editable && movable.length && store.selection().includes(hit.id)) {
        this.drag = {
          kind: 'move', start: point, moved: false,
          origins: new Map(movable.map(l => [l.id, { x: l.x, y: l.y }])),
          box: unionRect(movable.map(l => boundingBox(layerRect(l, this.size()), l.rotation))),
        };
      }
    } else {
      this.drag = { kind: 'marquee', start: point, current: point, base: event.shiftKey ? store.selection() : [], add: event.shiftKey };
      if (!event.shiftKey) store.select([]);
    }
    this.capture(event);
    event.preventDefault();
  }

  /**
   * @description Pointer moved: drag work, or the hover outline and cursor.
   * @param event Pointer event.
   */
  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) {
      this.updateHover(event);
      return;
    }
    const point = this.toCanvas(event);
    switch (drag.kind) {
      case 'pan': {
        const view = this.viewport.nativeElement;
        view.scrollLeft = drag.left - (event.clientX - drag.x);
        view.scrollTop = drag.top - (event.clientY - drag.y);
        break;
      }
      case 'move': this.moveTo(drag, point, event.altKey); break;
      case 'resize': this.resizeTo(drag, point, event.shiftKey, event.altKey); break;
      case 'rotate': {
        const angle = (Math.atan2(point.y - drag.center.y, point.x - drag.center.x) * 180) / Math.PI + 90;
        this.store().updateLayer(drag.id, { rotation: snapAngle(angle, event.shiftKey) }, 'rotate');
        break;
      }
      case 'marquee': {
        drag.current = point;
        const box = this.normalized(drag.start, point);
        this.marquee.set(box);
        const size = this.size();
        const inside = this.store().layers()
          .filter(l => !l.hidden && !l.locked && intersects(boundingBox(layerRect(l, size), l.rotation), box))
          .map(l => l.id);
        this.store().select(drag.add ? [...new Set([...drag.base, ...inside])] : inside);
        break;
      }
    }
  }

  /**
   * @description Pointer released: ends the drag work (one step of the history).
   * @param event Pointer event.
   */
  onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    this.drag = null;
    this.guideLines.set([]);
    this.marquee.set(null);
    this.store().endStep();
    if (drag?.kind === 'pan') this.cursor.set(this.panMode() ? 'grab' : 'default');
    try { this.stage.nativeElement.releasePointerCapture(event.pointerId); } catch { /* not captured */ }
  }

  /**
   * @description Double click: edit the text of a text layer.
   * @param event Mouse event.
   */
  onDoubleClick(event: MouseEvent): void {
    const hit = this.hitTest(this.toCanvas(event));
    if (hit?.type === 'text') this.editText.emit(hit.id);
  }

  /**
   * @description Ctrl / ⌘ + wheel zooms around the pointer (otherwise the area scrolls).
   * @param event Wheel event.
   */
  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const before = this.toCanvas(event);
    const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom() * (event.deltaY < 0 ? 1.1 : 1 / 1.1)));
    this.zoom.set(Math.round(zoom * 1000) / 1000);
    requestAnimationFrame(() => {
      const rect = this.stage.nativeElement.getBoundingClientRect();
      const view = this.viewport.nativeElement;
      view.scrollLeft += rect.left + before.x * this.zoom() - event.clientX;
      view.scrollTop += rect.top + before.y * this.zoom() - event.clientY;
    });
  }

  /** @description Schedules one drawing in the next animation frame. */
  private scheduleDraw(): void {
    cancelAnimationFrame(this.frame);
    this.zone.runOutsideAngular(() => {
      this.frame = requestAnimationFrame(() => this.draw());
    });
  }

  /** @description Draws the template on the canvas at the zoom and pixel ratio of the screen. */
  private draw(): void {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const size = this.size();
    const cssW = this.stageWidth();
    const cssH = this.stageHeight();
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cssW * cssH * dpr * dpr > MAX_BITMAP) dpr = Math.sqrt(MAX_BITMAP / (cssW * cssH));
    const width = Math.max(1, Math.round(cssW * dpr));
    const height = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(width / size.width, 0, 0, height / size.height, 0, 0);
    const report = renderPage(ctx, this.store().doc(), size, this.resources(), { mode: 'editor' });
    this.zone.run(() => this.rendered.emit(report));
  }

  /**
   * @description Pointer position in template px.
   * @param event Pointer / mouse event.
   */
  private toCanvas(event: MouseEvent): Point {
    const rect = this.stage.nativeElement.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / this.zoom(), y: (event.clientY - rect.top) / this.zoom() };
  }

  /**
   * @description The topmost visible, unlocked layer under a point.
   * @param point Template px.
   */
  private hitTest(point: Point): Layer | null {
    const layers = this.store().layers();
    const size = this.size();
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.hidden && !layer.locked && containsPoint(point, layerRect(layer, size), layer.rotation)) return layer;
    }
    return null;
  }

  /**
   * @description Hover outline and cursor while no drag runs.
   * @param event Pointer event.
   */
  private updateHover(event: PointerEvent): void {
    if (this.panMode()) {
      this.cursor.set('grab');
      return;
    }
    const handle = (event.target as Element | null)?.closest('[data-handle]')?.getAttribute('data-handle');
    if (handle) {
      this.cursor.set(handle === 'rotate' ? 'grab' : HANDLES.find(h => h.handle === handle)?.cursor ?? 'default');
      return;
    }
    const hit = this.hitTest(this.toCanvas(event));
    this.hovered.set(hit?.id ?? null);
    this.cursor.set(hit && this.store().editable ? 'move' : 'default');
  }

  /**
   * @description Moves the selected layers with snapping (Alt = without snapping).
   * @param drag Move work.
   * @param point Pointer (template px).
   * @param free Alt held.
   */
  private moveTo(drag: Extract<Drag, { kind: 'move' }>, point: Point, free: boolean): void {
    let dx = point.x - drag.start.x;
    let dy = point.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 2 * this.px()) return;
    drag.moved = true;
    let guides: GuideLine[] = [];
    if (!free) {
      const ids = new Set(drag.origins.keys());
      const size = this.size();
      const others = this.store().layers().filter(l => !ids.has(l.id) && !l.hidden).map(l => boundingBox(layerRect(l, size), l.rotation));
      const moved = { ...drag.box, x: drag.box.x + dx, y: drag.box.y + dy };
      const snap = snapBox(moved, snapTargets(size, others), size, this.snapSettings());
      dx += snap.dx;
      dy += snap.dy;
      guides = snap.guides;
    }
    this.guideLines.set(guides);
    const rx = Math.round(dx);
    const ry = Math.round(dy);
    this.store().updateLayers([...drag.origins.keys()], l => {
      const origin = drag.origins.get(l.id)!;
      l.x = origin.x + rx;
      l.y = origin.y + ry;
    }, 'drag-move');
  }

  /**
   * @description Resizes one layer by a handle: the opposite side / corner stays in place (also
   *   for a rotated layer); Shift keeps the ratio; without rotation the moving edges snap.
   * @param drag Resize work.
   * @param point Pointer (template px).
   * @param keepRatio Shift held.
   * @param free Alt held (no snapping).
   */
  private resizeTo(drag: Extract<Drag, { kind: 'resize' }>, point: Point, keepRatio: boolean, free: boolean): void {
    const { rect, rotation, handle } = drag;
    const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    const local = toLocal(point, rect, rotation);
    const lx = local.x - center.x;
    const ly = local.y - center.y;
    const horizontal = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
    const vertical = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
    // Fixed point (opposite side / corner) in local coordinates around the centre.
    const fixed = { x: -horizontal * rect.w / 2, y: -vertical * rect.h / 2 };
    let w = horizontal ? Math.max(1, (lx - fixed.x) * horizontal) : rect.w;
    let h = vertical ? Math.max(1, (ly - fixed.y) * vertical) : rect.h;

    const guides: GuideLine[] = [];
    if (!rotation && !free) {
      const size = this.size();
      const others = this.store().layers().filter(l => l.id !== drag.id && !l.hidden).map(l => boundingBox(layerRect(l, size), l.rotation));
      const targets = snapTargets(size, others);
      const settings = this.snapSettings();
      if (horizontal) {
        const edge = horizontal > 0 ? rect.x + w : rect.x + rect.w - w;
        const snapped = snapEdge(edge, targets.xs, settings);
        w = Math.max(1, horizontal > 0 ? snapped.value - rect.x : rect.x + rect.w - snapped.value);
        if (snapped.guide !== null) guides.push({ x1: snapped.guide, y1: 0, x2: snapped.guide, y2: size.height });
      }
      if (vertical) {
        const edge = vertical > 0 ? rect.y + h : rect.y + rect.h - h;
        const snapped = snapEdge(edge, targets.ys, settings);
        h = Math.max(1, vertical > 0 ? snapped.value - rect.y : rect.y + rect.h - snapped.value);
        if (snapped.guide !== null) guides.push({ x1: 0, y1: snapped.guide, x2: size.width, y2: snapped.guide });
      }
    }
    if (keepRatio && horizontal && vertical) {
      if (w / h > drag.ratio) h = w / drag.ratio; else w = h * drag.ratio;
    }
    this.guideLines.set(guides);

    // New centre: halfway between the fixed point and the moving one, turned back to the canvas.
    const cx = horizontal ? fixed.x + (horizontal * w) / 2 : 0;
    const cy = vertical ? fixed.y + (vertical * h) / 2 : 0;
    const rad = (rotation * Math.PI) / 180;
    const worldCenter = {
      x: center.x + cx * Math.cos(rad) - cy * Math.sin(rad),
      y: center.y + cx * Math.sin(rad) + cy * Math.cos(rad),
    };
    const layer = this.store().layers().find(l => l.id === drag.id);
    if (!layer) return;
    const rw = Math.max(1, Math.round(w));
    const rh = Math.max(1, Math.round(h));
    const box = { x: worldCenter.x - rw / 2, y: worldCenter.y - rh / 2, w: rw, h: rh };
    const offset = offsetFor(layer.anchor, box, this.size());
    this.store().updateLayer(drag.id, { x: Math.round(offset.x), y: Math.round(offset.y), w: rw, h: rh }, 'drag-resize');
  }

  /** @description Snapping settings at the current zoom. */
  private snapSettings(): SnapSettings {
    return { guides: this.guides(), grid: this.grid(), threshold: SNAP_PX * this.px() };
  }

  /**
   * @description A point turned with the rotation of a box around its centre.
   * @param point Point.
   * @param rect Box.
   * @param rotation Degrees.
   */
  private rotatePoint(point: Point, rect: Rect, rotation: number): Point {
    if (!rotation) return point;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const rad = (rotation * Math.PI) / 180;
    const dx = point.x - cx;
    const dy = point.y - cy;
    return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
  }

  /**
   * @description Box of two points.
   * @param a Point.
   * @param b Point.
   */
  private normalized(a: Point, b: Point): Rect {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  }

  /**
   * @description Keeps the pointer events of a drag on the stage.
   * @param event Pointer event.
   */
  private capture(event: PointerEvent): void {
    try { this.stage.nativeElement.setPointerCapture(event.pointerId); } catch { /* synthetic event */ }
  }

  /** @description Handle edge in template px. */
  get handleSize(): number {
    return HANDLE_PX * this.px();
  }
}
