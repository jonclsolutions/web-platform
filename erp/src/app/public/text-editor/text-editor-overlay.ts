/**
 * @file text-editor-overlay.ts
 * @path src/app/public/text-editor/text-editor-overlay.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Overlay of the website in the visual text editor: finds the marked texts of the
 *   rendered page (text-editor-markers), outlines them (translations red, content of the admin
 *   blue, a text missing in the language orange - its Czech reference in its place), shows the
 *   key of the text under the pointer and of the selected one, selects a text
 *   on a click (a link is not followed; other controls - an accordion, tabs - still work), and
 *   keeps the page from leaving the editor (forms are not
 *   sent, external links / new tabs are not opened). The page itself is never changed: the
 *   outlines are drawn in their own layer (a shadow root above the page).
 * @usage `new TextEditorOverlay(document, host).start()` - PublicTextEditorService, outside Angular.
 * @dependencies text-editor-markers, language-url (path without the language)
 * @note Rescans on changes of the page (MutationObserver, debounced), redraws on scroll / resize
 *   and in a short interval (animations move texts without changing the DOM).
 */

import { FoundMark, hasMarks, scanMarks, stripMarks } from './text-editor-markers';
import { TextEditorContentSection, TextEditorHiddenText } from './text-editor-protocol';
import { stripLanguagePrefix } from '../../shared/utils/language-url';
import { TEXT_EDITOR_BANNERS_PATH, isBannersQuery } from './text-editor-protocol';

/** Entry of a mark: a translation key or a section of the content. */
export type TextEditorEntry =
  | { kind: 'text'; key: string; missing?: boolean }
  | { kind: 'content'; section: TextEditorContentSection; missing?: boolean };

/** What the overlay needs from its owner. */
export interface TextEditorOverlayHost {
  /** Entry of a number found in a mark. */
  entry(index: number): TextEditorEntry | undefined;
  /** Hover label of content of a section ("FAQ - edit in the FAQ part"). */
  contentLabel(section: TextEditorContentSection): string;
  /** Prefix of the label of a missing text ("Chybí"). */
  missingLabel(): string;
  /** A text was clicked. */
  onSelect(key: string): void;
  /** Content was clicked. */
  onContent(section: TextEditorContentSection): void;
  /** The page shows other texts than before. */
  onScan(scan: { path: string; title: string; visible: string[]; missing: string[]; hidden: TextEditorHiddenText[] }): void;
}

/** One marked text on the page. */
interface OverlayItem {
  entry: TextEditorEntry;
  range: Range;
  /** Smallest element holding the whole text. */
  element: Element;
  /** Its ancestors that clip their content (overflow) - a collapsed answer is out of sight. */
  clippers: Element[];
  /** Last measured box (viewport coordinates). */
  rect: DOMRect | null;
}

/** Attributes whose texts are listed as "not visible". */
const TEXT_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt', 'value', 'content'];
/** Attributes whose change may show / hide texts (rescan). */
const WATCHED_ATTRIBUTES = [...TEXT_ATTRIBUTES, 'hidden', 'open', 'aria-expanded'];
/** Space between a text and its outline (px). */
const OUTLINE_GAP = 3;
/** Redraw interval for texts moved by animations (ms). */
/** Smallest distance of a key label from the edge of the screen (px). */
const LABEL_MARGIN = 2;
const REDRAW_INTERVAL_MS = 200;
/** Delay of a rescan after a change of the page (ms). */
const RESCAN_DELAY_MS = 80;
/** Rescan after a click (ms) - CSS transitions of opened / closed parts. */
const CLICK_RESCAN_MS = 350;
/** Class of the root element while the pointer is over a text (pointer cursor). */
const HOVER_CLASS = 'jsw-text-editor-hover';

/** Styles of the layer (inside its shadow root - the page CSS does not reach it). */
const LAYER_CSS = `
:host { all: initial; }
.b { position: absolute; box-sizing: border-box; border: 1.5px dashed rgba(239, 68, 68, 0.9); border-radius: 4px; pointer-events: none; }
.b.c { border-color: rgba(59, 130, 246, 0.9); }
.b.h { border-style: solid; }
.b.s { border: 2.5px solid #ef4444; background: rgba(239, 68, 68, 0.12); }
.l { position: absolute; max-width: 60vw; overflow: hidden; text-overflow: ellipsis; padding: 0 6px; border-radius: 4px; background: #ef4444; color: #fff; font: 600 11px/18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: nowrap; pointer-events: none; }
.l.c { background: #3b82f6; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
.b.m { border-color: #f97316; background: rgba(249, 115, 22, 0.2); }
.b.m.s { border: 2.5px solid #f97316; background: rgba(249, 115, 22, 0.3); }
.l.m { background: #ea580c; }
`;

export class TextEditorOverlay {
  private items: OverlayItem[] = [];
  private hovered: OverlayItem | null = null;
  private selectedKey: string | null = null;
  private lastScan = '';

  private root: HTMLElement | null = null;
  private layer: HTMLElement | null = null;
  private globalStyle: HTMLStyleElement | null = null;
  private observer: MutationObserver | null = null;
  private rescanTimer: ReturnType<typeof setTimeout> | null = null;
  private redrawTimer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;

  private readonly onMove = (event: MouseEvent) => this.hover(this.hit(event.clientX, event.clientY));
  private readonly onLeave = () => this.hover(null);
  private readonly onClick = (event: MouseEvent) => this.click(event);
  private readonly onAuxClick = (event: MouseEvent) => this.blockLeaving(event);
  private readonly onSubmit = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  private readonly onViewportChange = () => this.scheduleRedraw();

  constructor(private readonly doc: Document, private readonly host: TextEditorOverlayHost) {}

  /** @description Creates the layer, starts listening and scans the page. */
  start(): void {
    if (this.root) return;
    const win = this.doc.defaultView!;
    this.root = this.doc.createElement('jsw-text-editor-layer');
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;display:block;';
    const shadow = this.root.attachShadow({ mode: 'open' });
    const style = this.doc.createElement('style');
    style.textContent = LAYER_CSS;
    this.layer = this.doc.createElement('div');
    shadow.append(style, this.layer);
    // Outside <body>: the scans and the observer of the page never see the layer.
    this.doc.documentElement.appendChild(this.root);

    this.globalStyle = this.doc.createElement('style');
    this.globalStyle.textContent = `html.${HOVER_CLASS}, html.${HOVER_CLASS} * { cursor: pointer !important; }`;
    this.doc.head.appendChild(this.globalStyle);

    win.addEventListener('mousemove', this.onMove, true);
    this.doc.documentElement.addEventListener('mouseleave', this.onLeave);
    win.addEventListener('click', this.onClick, true);
    win.addEventListener('auxclick', this.onAuxClick, true);
    win.addEventListener('submit', this.onSubmit, true);
    win.addEventListener('scroll', this.onViewportChange, { capture: true, passive: true });
    win.addEventListener('resize', this.onViewportChange);

    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(this.doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: WATCHED_ATTRIBUTES });
    // the browser title and the meta description arrive later (page titles) - report them too
    this.observer.observe(this.doc.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['content'] });
    this.redrawTimer = setInterval(() => this.redraw(), REDRAW_INTERVAL_MS);
    this.scan();
  }

  /** @description Removes the layer and every listener. */
  stop(): void {
    if (!this.root) return;
    const win = this.doc.defaultView!;
    win.removeEventListener('mousemove', this.onMove, true);
    this.doc.documentElement.removeEventListener('mouseleave', this.onLeave);
    win.removeEventListener('click', this.onClick, true);
    win.removeEventListener('auxclick', this.onAuxClick, true);
    win.removeEventListener('submit', this.onSubmit, true);
    win.removeEventListener('scroll', this.onViewportChange, true);
    win.removeEventListener('resize', this.onViewportChange);
    this.observer?.disconnect();
    if (this.rescanTimer) clearTimeout(this.rescanTimer);
    this.rescanTimer = null;
    if (this.redrawTimer) clearInterval(this.redrawTimer);
    cancelAnimationFrame(this.frame);
    this.doc.documentElement.classList.remove(HOVER_CLASS);
    this.globalStyle?.remove();
    this.root.remove();
    this.root = this.layer = this.globalStyle = null;
    this.items = [];
  }

  /**
   * @description Highlights the texts of a key (the admin picked it in its panel).
   * @param key Translation key, null = nothing.
   * @param reveal Scroll the page to the first of them when it is out of sight.
   */
  select(key: string | null, reveal: boolean): void {
    this.selectedKey = key;
    if (reveal && key) {
      this.measure();
      const item = this.items.find(i => i.entry.kind === 'text' && i.entry.key === key && this.isShown(i.rect));
      const view = this.doc.defaultView!;
      if (item?.rect && (item.rect.bottom < 0 || item.rect.top > view.innerHeight)) {
        item.element.scrollIntoView({ block: 'center' });
      }
    }
    this.redraw();
  }

  /**
   * @description Finds every marked text of the page (and of its text attributes), reports what
   *   the page shows when it changed and redraws.
   */
  scan(): void {
    this.items = this.collectItems();
    if (this.hovered && !this.items.includes(this.hovered)) {
      this.hovered = null;
    }
    this.measure();
    this.report();
    this.redraw();
  }

  /**
   * @description Marked text at a point of the viewport - the smallest one containing it.
   * @param x Client X.
   * @param y Client Y.
   * @returns The text, null outside every text.
   */
  hit(x: number, y: number): OverlayItem | null {
    this.measure();
    let best: OverlayItem | null = null;
    let bestArea = Infinity;
    for (const item of this.items) {
      const r = item.rect;
      if (!this.isShown(r)) continue;
      if (x < r!.left - OUTLINE_GAP || x > r!.right + OUTLINE_GAP || y < r!.top - OUTLINE_GAP || y > r!.bottom + OUTLINE_GAP) continue;
      const area = r!.width * r!.height;
      if (area < bestArea) {
        best = item;
        bestArea = area;
      }
    }
    return best;
  }

  /** @description Texts of the page (tests, owner). */
  get count(): number {
    return this.items.length;
  }

  // ── Scanning ─────────────────────────────────────────────────

  /** @returns The marked texts of the body in document order (a text may span several nodes). */
  private collectItems(): OverlayItem[] {
    const items: OverlayItem[] = [];
    const open: { mark: FoundMark; node: Text }[] = [];
    const walker = this.doc.createTreeWalker(this.doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: node => /[⁡⁣⁤]/.test((node as Text).data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      for (const mark of scanMarks(node.data)) {
        if (mark.type === 'start') {
          open.push({ mark, node });
          continue;
        }
        const start = open.pop();
        if (!start) continue;
        const entry = this.host.entry(start.mark.index!);
        if (!entry) continue;
        const range = this.doc.createRange();
        range.setStart(start.node, start.mark.offset);
        range.setEnd(node, mark.offset + mark.length);
        const common = range.commonAncestorContainer;
        const element = common.nodeType === Node.ELEMENT_NODE ? common as Element : common.parentElement;
        if (element) {
          items.push({ entry, range, element, clippers: this.clippersOf(element), rect: null });
        }
      }
    }
    return items;
  }

  /**
   * @param element Element of a text.
   * @returns It and its ancestors (up to the body) that clip their content.
   */
  private clippersOf(element: Element): Element[] {
    const view = this.doc.defaultView!;
    const clippers: Element[] = [];
    for (let node: Element | null = element; node && node !== this.doc.body; node = node.parentElement) {
      const style = view.getComputedStyle(node);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        clippers.push(node);
      }
    }
    return clippers;
  }

  /** @returns Keys of the text attributes of the page (also the head: meta description…). */
  private attributeTexts(): TextEditorHiddenText[] {
    const found: TextEditorHiddenText[] = [];
    const selector = TEXT_ATTRIBUTES.map(name => `[${name}]`).join(',');
    this.doc.documentElement.querySelectorAll(selector).forEach(element => {
      for (const name of TEXT_ATTRIBUTES) {
        const value = element.getAttribute(name);
        if (!hasMarks(value)) continue;
        for (const mark of scanMarks(value!)) {
          const entry = mark.type === 'start' ? this.host.entry(mark.index!) : undefined;
          if (entry?.kind === 'text') {
            found.push({ key: entry.key, where: name });
          }
        }
      }
    });
    return found;
  }

  /** @description Sends what the page shows when it differs from the last report. */
  private report(): void {
    const visible = new Set<string>();
    const missing = new Set<string>();
    const hidden = new Map<string, TextEditorHiddenText>();
    for (const item of this.items) {
      if (item.entry.kind !== 'text') continue;
      if (this.isShown(item.rect)) {
        visible.add(item.entry.key);
        if (item.entry.missing) missing.add(item.entry.key);
      } else {
        // an option of a drop-down list is never drawn on the page itself
        const where = item.element.closest('option, select, datalist') ? 'option' : 'hidden';
        hidden.set(`${item.entry.key}|hidden`, { key: item.entry.key, where });
      }
    }
    for (const text of this.attributeTexts()) {
      hidden.set(`${text.key}|${text.where}`, text);
    }
    for (const key of visible) {
      hidden.delete(`${key}|hidden`);
    }
    const location = this.doc.defaultView!.location;
    const path = stripLanguagePrefix(location.pathname);
    const scan = {
      // the page "Lišta cookies a nabídka jazyka" of the editor is the home page with its query
      path: path === '/' && isBannersQuery(location.search) ? TEXT_EDITOR_BANNERS_PATH : path,
      title: stripMarks(this.doc.title),
      visible: [...visible],
      missing: [...missing],
      hidden: [...hidden.values()],
    };
    const serialized = JSON.stringify(scan);
    if (serialized !== this.lastScan) {
      this.lastScan = serialized;
      this.host.onScan(scan);
    }
  }

  // ── Drawing ──────────────────────────────────────────────────

  /**
   * @description Measures every text (viewport coordinates): the part not clipped by its
   *   ancestors; a text hidden by `visibility` or clipped away entirely has no size.
   */
  private measure(): void {
    for (const item of this.items) {
      const element = item.element as Element & { checkVisibility?: (options?: object) => boolean };
      if (element.checkVisibility && !element.checkVisibility({ visibilityProperty: true })) {
        item.rect = new DOMRect(0, 0, 0, 0);
        continue;
      }
      let { left, top, right, bottom } = item.range.getBoundingClientRect();
      for (const clipper of item.clippers) {
        const c = clipper.getBoundingClientRect();
        left = Math.max(left, c.left);
        top = Math.max(top, c.top);
        right = Math.min(right, c.right);
        bottom = Math.min(bottom, c.bottom);
      }
      item.rect = right > left && bottom > top ? new DOMRect(left, top, right - left, bottom - top) : new DOMRect(0, 0, 0, 0);
    }
  }

  /** @returns Whether a measured box can be seen (has a size). */
  private isShown(rect: DOMRect | null): boolean {
    return !!rect && rect.width > 0.5 && rect.height > 0.5;
  }

  /** @description Redraws on the next frame (scroll / resize bursts). */
  private scheduleRedraw(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.redraw());
  }

  /** @description Rescans shortly after the page changed. */
  private scheduleScan(): void {
    if (!this.root) return; // stopped meanwhile
    if (this.rescanTimer) clearTimeout(this.rescanTimer);
    this.rescanTimer = setTimeout(() => {
      this.rescanTimer = null;
      this.scan();
    }, RESCAN_DELAY_MS);
  }

  /** @description Draws the outlines of the texts in view and the labels of the hovered / selected ones. */
  private redraw(): void {
    const layer = this.layer;
    if (!layer) return;
    this.measure();
    const view = this.doc.defaultView!;
    const parts: HTMLElement[] = [];
    for (const item of this.items) {
      const r = item.rect;
      if (!this.isShown(r) || r!.bottom < -OUTLINE_GAP || r!.top > view.innerHeight + OUTLINE_GAP) continue;
      const selected = item.entry.kind === 'text' && item.entry.key === this.selectedKey;
      const hovered = item === this.hovered;
      const box = this.doc.createElement('div');
      const missingText = item.entry.missing ? ' m' : '';
      box.className = `b${item.entry.kind === 'content' ? ' c' : ''}${missingText}${hovered ? ' h' : ''}${selected ? ' s' : ''}`;
      box.style.cssText = `left:${r!.left - OUTLINE_GAP}px;top:${r!.top - OUTLINE_GAP}px;width:${r!.width + 2 * OUTLINE_GAP}px;height:${r!.height + 2 * OUTLINE_GAP}px;`;
      parts.push(box);
      if (hovered || selected) {
        const label = this.doc.createElement('div');
        label.className = `l${item.entry.kind === 'content' ? ' c' : ''}${missingText}`;
        const name = item.entry.kind === 'text' ? item.entry.key : this.host.contentLabel(item.entry.section);
        label.textContent = item.entry.missing ? `${this.host.missingLabel()} · ${name}` : name;
        const above = r!.top - OUTLINE_GAP - 20;
        label.style.cssText = `left:${r!.left - OUTLINE_GAP}px;top:${above >= 2 ? above : r!.bottom + OUTLINE_GAP + 2}px;`;
        parts.push(label);
      }
    }
    layer.replaceChildren(...parts);
    // a label of a text at the right edge would leave the screen - shift it left to fit
    const right = this.doc.documentElement.clientWidth - LABEL_MARGIN;
    for (const label of layer.querySelectorAll<HTMLElement>('.l')) {
      const box = label.getBoundingClientRect();
      if (box.right > right) {
        label.style.left = `${Math.max(LABEL_MARGIN, right - box.width)}px`;
      }
    }
  }

  // ── Pointer ──────────────────────────────────────────────────

  /**
   * @description New text under the pointer: its label and the pointer cursor.
   * @param item Text under the pointer, null = none.
   */
  private hover(item: OverlayItem | null): void {
    if (item === this.hovered) return;
    this.hovered = item;
    this.doc.documentElement.classList.toggle(HOVER_CLASS, !!item);
    this.redraw();
  }

  /**
   * @description A click selects a text (a link around it is not followed, another control - an
   *   accordion of an answer, tabs - works as on the website); a click on content is let
   *   through (opens an answer, a detail) and reported; leaving the editor is blocked.
   * @param event Click (capture phase).
   */
  private click(event: MouseEvent): void {
    // a control may show / hide texts by CSS only (an accordion with a checkbox) - scan again
    // once its transition is over
    setTimeout(() => this.scheduleScan(), CLICK_RESCAN_MS);
    const item = event.detail === 0
      ? this.itemOfElement(event.target)
      : this.hit(event.clientX, event.clientY) ?? this.itemOfControl(event.target);
    if (item?.entry.kind === 'text') {
      // A link would leave the page - only the text is selected. Any other control (opening an
      // answer, switching a tab) still works, so a hidden text can be shown and edited.
      if (event.target instanceof Element && event.target.closest('a[href]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      this.selectedKey = item.entry.key;
      this.redraw();
      this.host.onSelect(item.entry.key);
      return;
    }
    if (item?.entry.kind === 'content') {
      this.host.onContent(item.entry.section);
    }
    this.blockLeaving(event);
  }

  /**
   * @description Text of a focused element (keyboard click).
   * @param target Target of the event.
   * @returns The text in / around it, the smallest first.
   */
  private itemOfElement(target: EventTarget | null): OverlayItem | null {
    if (!(target instanceof Element)) return null;
    const matching = this.items.filter(i => i.element.contains(target) || target.contains(i.element));
    matching.sort((a, b) => (a.element.contains(b.element) ? 1 : b.element.contains(a.element) ? -1 : 0));
    return matching[0] ?? null;
  }

  /**
   * @description Text of a link / button clicked beside its text (its padding, an icon, a number):
   *   the text of the control, a translation before content; another element clicked beside its
   *   text (padding of a paragraph): its text when it holds exactly one.
   * @param target Target of the event.
   * @returns The text, null outside every control with a text.
   */
  private itemOfControl(target: EventTarget | null): OverlayItem | null {
    if (!(target instanceof Element)) return null;
    const control = target.closest('a, button, [role="button"], summary, label');
    if (control) {
      const inside = this.items.filter(i => control.contains(i.element));
      return inside.find(i => i.entry.kind === 'text') ?? inside[0] ?? null;
    }
    // a paragraph / heading clicked in its padding: its one text (never a guess among several)
    const own = this.items.filter(i => target.contains(i.element) && this.isShown(i.rect));
    return own.length === 1 ? own[0] : null;
  }

  /**
   * @description Keeps links from leaving the editor: a new tab / window, another site, e-mail,
   *   phone and downloads are not opened. Links inside the website still work.
   * @param event Click / middle click.
   */
  private blockLeaving(event: MouseEvent): void {
    const link = (event.target instanceof Element) ? event.target.closest('a[href]') as HTMLAnchorElement | null : null;
    if (!link) return;
    const view = this.doc.defaultView!;
    let external = true;
    try {
      const url = new URL(link.href, view.location.href);
      external = url.origin !== view.location.origin;
    } catch {
      external = true;
    }
    if (event.type === 'auxclick' || external || link.target === '_blank' || link.hasAttribute('download')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
