/**
 * @file editor-store.spec.ts
 * @path src/app/apps/js-creator/admin/images/editor/editor-store.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of EditorStore: history (undo / redo, coalescing of similar changes,
 *   limit), unsaved changes (also changes made while a save runs), selection, adding / deleting / duplicating / copying layers (with
 *   their fields), order, alignment, spreading, anchors, resize, read-only mode, pruning of
 *   unused fields and block instances (insert, scale, sync with the block, block from the
 *   selection, unpack, no instances pasted into a block).
 * @dependencies EditorStore, editor-test-data.ts.
 */

import { EditorStore, HISTORY_LIMIT, blockAsTemplate } from './editor-store';
import { BlockDef } from '../../shared/render/block-fields';
import { BlockLayer, TextLayer, emptyDocument } from '../../shared/render/document';
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
   * @description The answer of an own save becomes the saved state; changes made while the save
   *   was running are kept as unsaved changes (not replaced by the answer); the history stays.
   * @input a shape added, state sent, then moved to x 50 before the answer (version 2 with the
   *   sent document); a second save answered without further changes (version 3)
   * @output shape still at x 50, dirty, version 2, undo possible; after the second answer clean
   *   with version 3
   */
  it('keeps changes made while a save runs', () => {
    const store = new EditorStore(testTemplate(), true);
    const id = store.addLayer('shape');
    const sent = store.stateJson();
    const answer = { ...testTemplate(), version: 2, document: structuredClone(store.saveBody().document) };
    store.updateLayer(id, { x: 50 });
    store.saved(answer, sent);
    expect(store.layers()[0].x).toBe(50);
    expect(store.dirty()).toBeTrue();
    expect(store.version()).toBe(2);
    expect(store.canUndo()).toBeTrue();

    const again = store.stateJson();
    store.saved({ ...testTemplate(), version: 3, document: structuredClone(store.saveBody().document) }, again);
    expect(store.dirty()).toBeFalse();
    expect(store.version()).toBe(3);
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
  /**
   * @description Instances: inserted fitted and selected, scaled with their box, their boxes follow
   *   the current size of the block after loading (without unsaved changes), selected layers are
   *   replaced by an instance in one step (undo brings them back), an instance unpacks into layers
   *   with its fields; a block never takes instances (not even pasted).
   * @input block 200 × 100 with a text of the field price; insert; scale 0.5; a stored instance
   *   400 × 200 at scale 1; two shapes → block; unpack; paste of an instance into a block
   * @output instance 200 × 100 selected; 100 × 50; synced to 200 × 100 and clean; one instance in
   *   place of the shapes, undo → shapes; unpacked text with the field price; paste skips 1
   */
  it('works with block instances', () => {
    const block: BlockDef = { id: 9, name: 'Tag', width: 200, height: 100, document: emptyDocument(true) };
    block.document.pages[0].layers = [textLayer('bt', { field: 'price', w: 200, h: 100, x: 0, y: 0 })];
    block.document.fields = [textField('price')];

    const store = new EditorStore(testTemplate(), true);
    const id = store.addBlock(block) as string;
    expect(store.selectedLayer()).toEqual(jasmine.objectContaining({ type: 'block', blockId: 9, w: 200, h: 100, scale: 1 }));
    store.setScale(id, 0.5, block);
    expect([store.layers()[0].w, store.layers()[0].h]).toEqual([100, 50]);

    const stored = { ...(store.layers()[0] as BlockLayer), id: 'old', w: 400, h: 200, scale: 1 };
    const loaded = new EditorStore(testTemplate({ layers: [stored] }), true);
    loaded.syncInstances(blockId => (blockId === 9 ? block : undefined));
    expect([loaded.layers()[0].w, loaded.layers()[0].h]).toEqual([200, 100]);
    expect(loaded.dirty()).toBeFalse();

    const shapes = new EditorStore(testTemplate({ layers: [shapeLayer('a', 10, 10), shapeLayer('b', 50, 50), shapeLayer('c', 500, 500)] }), true);
    shapes.select(['a', 'b']);
    const instanceId = shapes.replaceWithInstance(['a', 'b'], { id: 9, width: 140, height: 140 }, { x: 10, y: 10, w: 140, h: 140 });
    expect(shapes.layers().map(l => l.type)).toEqual(['block', 'shape']);
    expect(layerRect(shapes.layers()[0], shapes.size())).toEqual({ x: 10, y: 10, w: 140, h: 140 });
    expect(shapes.selection()).toEqual([instanceId]);
    shapes.undo();
    expect(shapes.layers().map(l => l.id)).toEqual(['a', 'b', 'c']);

    const unpacking = new EditorStore(testTemplate({ layers: [{ ...stored, w: 200, h: 100 }] }), true);
    expect(unpacking.unpack('old', block, [{ ...textField('price'), origin: { layerId: 'old', blockId: 9, key: 'price' } }])).toBeTrue();
    expect(unpacking.layers().map(l => l.type)).toEqual(['text']);
    expect((unpacking.layers()[0] as TextLayer).field).toBe('price');
    expect(unpacking.doc().fields.map(f => f.key)).toEqual(['price']);

    store.select([id]);
    store.copySelected();
    const blockStore = new EditorStore(blockAsTemplate({ ...testTemplate({ id: 9 }), used_by: [] } as never), true, 'block');
    expect(blockStore.addBlock(block)).toBeNull();
    expect(blockStore.paste()).toBe(1);
    expect(blockStore.layers().length).toBe(0);
    expect(blockStore.blockSaveBody()).toEqual(jasmine.objectContaining({ name: 'Post', width: 1000, version: 3 }));
  });

  /**
   * @description Slides of a carousel: a new empty slide keeps the background, a copy gets new
   *   layer ids, layers and selection belong to the shown slide, slides move and are deleted (one
   *   step each), a field used only on another slide stays; a block gets no slides; at most 20.
   * @input template with layers a (text with field title) and b; addPage(); add a shape; addPage(true);
   *   movePage(-1); removePage(); undo; block store; 19 more slides
   * @output 2 slides, slide 2 empty with the background; copy with ids ≠ a/b; order after move;
   *   field title kept; undo brings the slide back; block: false; canAddPage false at 20
   */
  it('works with slides of a carousel', () => {
    const store = new EditorStore(testTemplate({ layers: [textLayer('a', { field: 'title' }), shapeLayer('b')], fields: [textField()] }), true);
    store.select(['a']);
    expect(store.addPage()).toBeTrue();
    expect(store.pageCount()).toBe(2);
    expect(store.pageIndex()).toBe(1);
    expect(store.layers()).toEqual([]);
    expect(store.selection()).toEqual([]);
    expect(store.doc().pages[1].background).toEqual(store.doc().pages[0].background);
    const added = store.addLayer('shape');
    expect(store.doc().pages[1].layers.map(l => l.id)).toEqual([added]);
    expect(store.doc().pages[0].layers.map(l => l.id)).toEqual(['a', 'b']);

    store.setPage(0);
    store.select(['a']);
    store.addPage(true);
    const copyIds = store.layers().map(l => l.id);
    expect(copyIds.length).toBe(2);
    expect(copyIds.some(id => ['a', 'b', added].includes(id))).toBeFalse();
    expect(store.pageIndex()).toBe(1);

    store.movePage(1);
    expect(store.pageIndex()).toBe(2);
    expect(store.doc().pages[1].layers.map(l => l.id)).toEqual([added]);
    store.setPage(0);
    store.removePage();
    expect(store.pageCount()).toBe(2);
    expect(store.doc().fields.map(f => f.key)).toEqual(['title']);
    store.undo();
    expect(store.pageCount()).toBe(3);

    while (store.pageCount() < 20) store.addPage();
    expect(store.canAddPage()).toBeFalse();
    expect(store.addPage()).toBeFalse();

    const block = new EditorStore(testTemplate(), true, 'block');
    expect(block.addPage()).toBeFalse();
  });
});
