/**
 * @file editor-store.spec.ts
 * @path src/app/apps/js-creator/admin/images/editor/editor-store.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of EditorStore: history (undo / redo, coalescing of similar changes,
 *   limit), unsaved changes, selection, adding / deleting / duplicating / copying layers (with
 *   their fields), order, alignment, spreading, anchors, resize, read-only mode and pruning of
 *   unused fields.
 * @dependencies EditorStore, editor-test-data.ts.
 */

import { EditorStore, HISTORY_LIMIT } from './editor-store';
import { imageField, shapeLayer, testTemplate, textField, textLayer } from './editor-test-data';
import { layerRect } from '../../shared/render/geometry';

describe('EditorStore', () => {
  /**
   * @description Changes are steps of the history; undo / redo move between them; a new change
   *   clears redo; the state compares to the saved one (dirty).
   * @input add a shape, move it, undo, redo, undo + new change
   * @output 1 → 0 → 1 layers; dirty after a change, clean after undo to the start; redo cleared
   */
  it('keeps the history and the unsaved state', () => {
    const store = new EditorStore(testTemplate(), true);
    expect(store.dirty()).toBeFalse();
    const id = store.addLayer('shape');
    expect(store.layers().length).toBe(1);
    expect(store.selection()).toEqual([id]);
    expect(store.dirty()).toBeTrue();
    store.updateLayer(id, { x: 50 });
    store.undo();
    expect(store.layers()[0].x).toBe(0);
    store.undo();
    expect(store.layers().length).toBe(0);
    expect(store.dirty()).toBeFalse();
    expect(store.canRedo()).toBeTrue();
    store.redo();
    expect(store.layers().length).toBe(1);
    store.addLayer('text');
    expect(store.canRedo()).toBeFalse();
  });

  /**
   * @description Similar changes in a row (same key) are one step; a different key or the end of
   *   a step starts a new one; the history keeps at most HISTORY_LIMIT steps.
   * @input three nudges; a resize; endStep + nudge; HISTORY_LIMIT + 10 changes
   * @output one undo reverts all nudges; limit kept
   */
  it('coalesces similar changes and limits the history', () => {
    const store = new EditorStore(testTemplate({ layers: [shapeLayer('a')] }), true);
    store.select(['a']);
    store.nudge(1, 0);
    store.nudge(1, 0);
    store.nudge(1, 0);
    expect(store.layers()[0].x).toBe(3);
    store.undo();
    expect(store.layers()[0].x).toBe(0);

    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      store.updateLayer('a', { x: i });
      store.endStep();
    }
    let undos = 0;
    while (store.canUndo()) {
      store.undo();
      undos++;
    }
    expect(undos).toBe(HISTORY_LIMIT);
  });

  /**
   * @description Selection by ids, adding / toggling, all; ids of deleted layers drop out.
   * @input layers a, b, c (c locked)
   * @output select a; toggle b; toggle a; select all = a, b (not locked c); delete b → a
   */
  it('selects layers', () => {
    const c = { ...shapeLayer('c'), locked: true };
    const store = new EditorStore(testTemplate({ layers: [shapeLayer('a'), shapeLayer('b'), c] }), true);
    store.select(['a']);
    store.select(['b'], true);
    expect(store.selection()).toEqual(['a', 'b']);
    store.select(['a'], true);
    expect(store.selection()).toEqual(['b']);
    store.selectAll();
    expect(store.selection()).toEqual(['a', 'b']);
    store.select(['b']);
    store.removeSelected();
    expect(store.layers().map(l => l.id)).toEqual(['a', 'c']);
    expect(store.selection()).toEqual([]);
  });

  /**
   * @description Duplicate shifts copies by 20 px with new ids; copy + paste into another
   *   template adds the fields of the copied layers (a key used by another kind gets a new key).
   * @input text with field "title"; duplicate; copy; paste into a template where "title" is an image field
   * @output copy at +20 with a new id; pasted layer uses field "title_2" (text), fields kept
   */
  it('duplicates, copies and pastes layers with their fields', () => {
    const store = new EditorStore(testTemplate({ layers: [textLayer('t', { field: 'title' })], fields: [textField('title')] }), true);
    store.select(['t']);
    store.duplicateSelected();
    const copy = store.layers()[1];
    expect(copy.id).not.toBe('t');
    expect([copy.x, copy.y]).toEqual([30, 30]);
    expect(store.selection()).toEqual([copy.id]);

    store.select(['t']);
    store.copySelected();
    expect(store.hasClipboard()).toBeTrue();
    const other = new EditorStore(testTemplate({ id: 99, layers: [{ ...shapeLayer('img'), type: 'image', source: { kind: 'field', field: 'title' } } as never], fields: [imageField('title')] }), true);
    other.paste();
    const pasted = other.layers()[1];
    expect(pasted.type).toBe('text');
    expect(pasted.type === 'text' && pasted.field).toBe('title_2');
    expect(other.doc().fields.map(f => [f.key, f.type])).toEqual([['title', 'image'], ['title_2', 'text']]);
    expect([pasted.x, pasted.y]).toEqual([10, 10]);
  });

  /**
   * @description Order of drawing: up / down by one, to the top / bottom, to an index.
   * @input layers a, b, c
   * @output a up → b, a, c; c bottom → c, b, a; moveLayerTo(c, 2) → b, a, c
   */
  it('changes the order of layers', () => {
    const store = new EditorStore(testTemplate({ layers: [shapeLayer('a'), shapeLayer('b'), shapeLayer('c')] }), true);
    const order = () => store.layers().map(l => l.id).join(',');
    store.select(['a']);
    store.arrange('up');
    expect(order()).toBe('b,a,c');
    store.select(['c']);
    store.arrange('bottom');
    expect(order()).toBe('c,b,a');
    store.arrange('top');
    expect(order()).toBe('b,a,c');
    store.moveLayerTo('c', 0);
    expect(order()).toBe('c,b,a');
  });

  /**
   * @description One layer aligns to the canvas, more layers to their common box; three layers
   *   spread evenly.
   * @input a at 0,0; b at 300,100; c at 50,600 (100 × 100 each)
   * @output a right → x 900; a+b top → y 0 both; a, b, c spread horizontally with equal gaps
   */
  it('aligns and spreads layers', () => {
    const store = new EditorStore(testTemplate({ layers: [shapeLayer('a'), shapeLayer('b', 300, 100), shapeLayer('c', 50, 600)] }), true);
    store.select(['a']);
    store.align('right');
    expect(store.layers()[0].x).toBe(900);
    store.select(['a', 'b']);
    store.align('top');
    expect(store.layers().slice(0, 2).map(l => l.y)).toEqual([0, 0]);

    store.select(['a', 'b', 'c']);
    store.distribute('horizontal');
    const xs = store.layers().map(l => l.x).sort((p, q) => p - q);
    expect(xs[1] - xs[0]).toBe(xs[2] - xs[1]);
  });

  /**
   * @description A new anchor keeps the place of the layer; resizing the canvas keeps anchors.
   * @input text 100 × 50 at 10, 10 (tl) → anchor br; canvas 1000 × 1500
   * @output same box on the canvas; offset -890 / -940; after the resize it keeps 940 px from the
   *   bottom edge (y 510)
   */
  it('changes anchors and the size of the canvas', () => {
    const store = new EditorStore(testTemplate({ layers: [textLayer('t')] }), true);
    store.setAnchor('t', 'br');
    const layer = store.layers()[0];
    expect([layer.anchor, layer.x, layer.y]).toEqual(['br', -890, -940]);
    expect(layerRect(layer, store.size())).toEqual({ x: 10, y: 10, w: 100, h: 50 });
    store.resize({ width: 1000, height: 1500 });
    expect(layerRect(store.layers()[0], store.size()).y).toBe(510);
  });

  /**
   * @description Fields no layer uses are dropped with the change that left them unused.
   * @input text with field "title" + unused field "old"; switch the text to fixed text
   * @output first change drops "old"; then "title" disappears
   */
  it('drops unused fields', () => {
    const store = new EditorStore(testTemplate({ layers: [textLayer('t', { field: 'title' })], fields: [textField('title'), textField('old')] }), true);
    store.updateLayer('t', { name: 'Headline' });
    expect(store.doc().fields.map(f => f.key)).toEqual(['title']);
    store.updateLayer('t', { field: null } as never);
    expect(store.doc().fields).toEqual([]);
  });

  /**
   * @description A read-only editor changes nothing and is never dirty; the save body carries
   *   the state and the version.
   * @input editable = false; addLayer; editable store with caption "" and name " A "
   * @output no layers; body with version 3, null caption, trimmed name
   */
  it('respects read only and builds the save body', () => {
    const readOnly = new EditorStore(testTemplate(), false);
    readOnly.mutate(doc => doc.pages[0].layers.push(shapeLayer('x')));
    expect(readOnly.layers().length).toBe(0);
    expect(readOnly.dirty()).toBeFalse();

    const store = new EditorStore(testTemplate(), true);
    store.commit(draft => { draft.name = ' A '; draft.caption = ''; });
    const body = store.saveBody();
    expect([body.name, body.caption_template, body.version, body.width]).toEqual(['A', null, 3, 1000]);
  });
});
