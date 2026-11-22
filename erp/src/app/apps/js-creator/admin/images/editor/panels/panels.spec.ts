/**
 * @file panels.spec.ts
 * @path src/app/apps/js-creator/admin/images/editor/panels/panels.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the panels of the editor:
 *   - Properties: empty state, a text switched to a new field and back, highlighting a selection,
 *     own font faces, moving to an edge, grid cells as fields, locked layers disabled;
 *   - Fields: renaming a key changes every use (layers and caption), invalid / taken keys, order;
 *   - Layers: top first, labels, selection with Shift, lock / hide, rename, drop reorder;
 *   - Template: size, background image with a new field, output quality, caption field insert.
 * @dependencies the panels, EditorStore, editor-test-data.ts, admin-test-helpers.ts.
 */

import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorStore } from '../editor-store';
import { PropertiesPanelComponent } from './properties-panel.component';
import { FieldsPanelComponent } from './fields-panel.component';
import { LayersPanelComponent } from './layers-panel.component';
import { TemplatePanelComponent } from './template-panel.component';
import { TEST_CURATED, imageField, shapeLayer, testFont, testTemplate, textField, textLayer } from '../editor-test-data';
import { GridLayer, TextLayer, createLayer } from '../../../shared/render/document';
import { createAdminTestContext } from '../../../../../../../testing/admin-test-helpers';

/**
 * @description Creates a panel bound to a store.
 * @param type Panel component.
 * @param store Editor.
 */
function mount<T>(type: Type<T>, store: EditorStore): ComponentFixture<T> {
  const fixture = TestBed.createComponent(type);
  fixture.componentRef.setInput('store', store);
  fixture.detectChanges();
  return fixture;
}

describe('editor panels', () => {
  beforeEach(async () => {
    const ctx = createAdminTestContext();
    await TestBed.configureTestingModule({
      imports: [PropertiesPanelComponent, FieldsPanelComponent, LayersPanelComponent, TemplatePanelComponent],
      providers: ctx.providers,
    }).compileComponents();
  });

  describe('PropertiesPanelComponent', () => {
    /**
     * @description Nothing selected = a hint; a text becomes a new field (label and sample from
     *   the text) and back a fixed text (the sample becomes the text, the field disappears).
     * @input no selection; text "Big sale" → new field; → fixed text
     * @output hint; field big_sale with the sample; fixed text "Big sale", no fields
     */
    it('switches a text between a fixed text and a field', () => {
      const store = new EditorStore(testTemplate({ layers: [textLayer('t', { text: 'Big sale' })] }), true);
      const fixture = mount(PropertiesPanelComponent, store);
      expect(fixture.nativeElement.querySelector('.pn-empty')).not.toBeNull();

      store.select(['t']);
      fixture.detectChanges();
      const panel = fixture.componentInstance;
      panel.setTextField(store.layers()[0] as TextLayer, panel.newField);
      expect(store.doc().fields).toEqual([{ key: 'big_sale', type: 'text', label: 'Big sale', help: '', required: true, sample: 'Big sale', maxLength: 200, multiline: false }]);
      expect((store.layers()[0] as TextLayer).field).toBe('big_sale');

      panel.setText(store.layers()[0] as TextLayer, 'Huge sale');
      expect((store.doc().fields[0] as { sample: string }).sample).toBe('Huge sale');
      panel.setTextField(store.layers()[0] as TextLayer, '');
      expect((store.layers()[0] as TextLayer).text).toBe('Huge sale');
      expect(store.doc().fields).toEqual([]);
    });

    /**
     * @description The selected part of the text is wrapped in highlight markers.
     * @input text "Big sale" with "sale" selected
     * @output "Big **sale**"
     */
    it('highlights the selected part of a text', () => {
      const store = new EditorStore(testTemplate({ layers: [textLayer('t', { text: 'Big sale' })] }), true);
      store.select(['t']);
      const fixture = mount(PropertiesPanelComponent, store);
      const area = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
      area.setSelectionRange(4, 8);
      fixture.componentInstance.highlightSelection(store.layers()[0] as TextLayer);
      expect((store.layers()[0] as TextLayer).text).toBe('Big **sale**');
    });

    /**
     * @description Fonts: a curated family takes the closest weight, an own family its closest
     *   face (the reference is the face id).
     * @input text 700 → Anton (only 400); → own "Brand" (faces 400 #3, 800 #4)
     * @output set:anton 400; user:4 800; faces of Brand listed
     */
    it('chooses curated and own fonts', () => {
      const store = new EditorStore(testTemplate({ layers: [textLayer('t')] }), true);
      store.select(['t']);
      const fixture = mount(PropertiesPanelComponent, store);
      fixture.componentRef.setInput('curated', TEST_CURATED);
      fixture.componentRef.setInput('ownFonts', [testFont(3, 'Brand', 400), testFont(4, 'Brand', 800)]);
      fixture.detectChanges();
      const panel = fixture.componentInstance;
      panel.setFamily(store.layers()[0] as TextLayer, 'set:anton');
      expect((store.layers()[0] as TextLayer).font).toEqual({ family: 'set:anton', weight: 400, style: 'normal' });
      store.updateLayer('t', { font: { family: 'set:inter', weight: 700, style: 'normal' } } as never);
      panel.setFamily(store.layers()[0] as TextLayer, 'own:Brand');
      expect((store.layers()[0] as TextLayer).font).toEqual({ family: 'user:4', weight: 800, style: 'normal' });
      expect(panel.faces(store.layers()[0] as TextLayer).map(f => f.value)).toEqual(['user:3', 'user:4']);
    });

    /**
     * @description "Move to the edge" pins the layer to a point with the margin; grid cells become
     *   fields; a locked layer shows disabled inputs.
     * @input place at tr with margin 40; grid 2x2 → cells as fields; lock
     * @output anchor tr, x -40, y 40; 4 image fields; fieldset disabled
     */
    it('places layers, makes grid fields and respects locking', () => {
      const grid = { ...createLayer('grid', { width: 1000, height: 1000 }, 'g'), name: 'Fotka' } as GridLayer;
      const store = new EditorStore(testTemplate({ layers: [textLayer('t'), grid] }), true);
      store.select(['t']);
      const fixture = mount(PropertiesPanelComponent, store);
      fixture.componentInstance.placeAt('tr');
      expect([store.layers()[0].anchor, store.layers()[0].x, store.layers()[0].y]).toEqual(['tr', -40, 40]);

      store.select(['g']);
      fixture.detectChanges();
      fixture.componentInstance.cellsAsFields(store.layers()[1] as GridLayer);
      expect(store.doc().fields.map(f => f.key)).toEqual(['fotka_1', 'fotka_2', 'fotka_3', 'fotka_4']);
      expect((store.layers()[1] as GridLayer).cells[3].source).toEqual({ kind: 'field', field: 'fotka_4' });

      store.updateLayer('g', { locked: true });
      fixture.detectChanges();
      const fieldsets = fixture.nativeElement.querySelectorAll('fieldset.pn-fieldset') as NodeListOf<HTMLFieldSetElement>;
      expect(fieldsets[fieldsets.length - 1].disabled).toBeTrue();
    });
  });

  describe('FieldsPanelComponent', () => {
    /**
     * @description Renaming a key changes the field, the layers using it and `{{key}}` of the
     *   caption; an invalid or taken key is refused with a message; fields move up / down.
     * @input text field "title" used by a text and in the caption; image field "photo"; rename
     *   to "headline"; to "Bad!"; to "photo"; move photo up
     * @output headline everywhere; errors key_invalid / key_taken; order photo, headline
     */
    it('renames keys and orders fields', () => {
      const image = { ...createLayer('image', { width: 1000, height: 1000 }, 'i'), source: { kind: 'field', field: 'photo' } } as never;
      const template = testTemplate({ layers: [textLayer('t', { field: 'title' }), image], fields: [textField('title'), imageField('photo')], caption: 'Hi {{title}}!' });
      const store = new EditorStore(template, true);
      const fixture = mount(FieldsPanelComponent, store);
      const panel = fixture.componentInstance;
      const input = document.createElement('input');

      input.value = 'headline';
      panel.renameKey(store.doc().fields[0], input);
      expect(store.doc().fields[0].key).toBe('headline');
      expect((store.layers()[0] as TextLayer).field).toBe('headline');
      expect(store.state().caption).toBe('Hi {{headline}}!');

      input.value = 'Bad!';
      panel.renameKey(store.doc().fields[0], input);
      expect(panel.keyErrors()['headline']).toBe('js-creator-editor.key_invalid');
      expect(input.value).toBe('headline');
      input.value = 'photo';
      panel.renameKey(store.doc().fields[0], input);
      expect(panel.keyErrors()['headline']).toBe('js-creator-editor.key_taken');

      panel.move(1, -1);
      expect(store.doc().fields.map(f => f.key)).toEqual(['photo', 'headline']);
      expect(panel.uses().get('photo')).toBe(1);
    });
  });

  describe('LayersPanelComponent', () => {
    /**
     * @description Rows from the top layer down with their labels; Shift adds to the selection;
     *   lock / hide toggle; rename; a dropped row takes the place of the target.
     * @input layers a (shape), t (text "Hello"); click t, Shift+click a; lock a; rename t; drag a onto the top row
     * @output labels [Hello, type_shape]; selection [t, a]; a locked; name "Title"; order t, a → a on top
     */
    it('lists, selects, toggles, renames and reorders layers', () => {
      const store = new EditorStore(testTemplate({ layers: [shapeLayer('a'), textLayer('t', { text: 'Hello' })] }), true);
      const fixture = mount(LayersPanelComponent, store);
      const panel = fixture.componentInstance;
      const rows = () => fixture.nativeElement.querySelectorAll('.ly-row') as NodeListOf<HTMLElement>;
      expect(Array.from(rows()).map(r => r.querySelector('.ly-name')?.textContent?.trim())).toEqual(['Hello', 'js-creator-editor.type_shape']);

      rows()[0].click();
      rows()[1].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
      expect(store.selection()).toEqual(['t', 'a']);

      panel.toggle(store.layers()[0], 'locked', new MouseEvent('click'));
      expect(store.layers()[0].locked).toBeTrue();

      panel.startRename(store.layers()[1]);
      panel.finishRename(store.layers()[1], ' Title ');
      expect(store.layers()[1].name).toBe('Title');

      panel.onDragStart(new DragEvent('dragstart'), store.layers()[0]);
      panel.onDrop(new DragEvent('drop'), 0);
      expect(store.layers().map(l => l.id)).toEqual(['t', 'a']);
    });
  });

  describe('TemplatePanelComponent', () => {
    /**
     * @description Size (only valid ones), background image with a new field, JPG quality and
     *   inserting a field into the caption at the cursor.
     * @input size 1080 × 1920; size 50 × 50; background image on + new field; quality 80; caption "Hi " + insert title
     * @output 1080 × 1920 kept; background uses a new field keyed by its label; quality 80;
     *   caption "Hi {{title}}"
     */
    it('changes size, background, output and caption', () => {
      const store = new EditorStore(testTemplate({ layers: [textLayer('t', { field: 'title' })], fields: [textField('title')] }), true);
      const fixture = mount(TemplatePanelComponent, store);
      const panel = fixture.componentInstance;
      panel.setSize({ width: 1080, height: 1920 });
      panel.setSize({ width: 50, height: 50 });
      expect(store.size()).toEqual({ width: 1080, height: 1920 });

      panel.toggleImage(true);
      panel.newBackgroundField();
      expect(store.doc().pages[0].background.image?.source).toEqual({ kind: 'field', field: 'js_creator_editor_background_field' });

      panel.setTemplate({ outputFormat: 'jpg' });
      panel.setQuality({ target: { valueAsNumber: 80 } } as unknown as Event);
      expect([store.state().outputFormat, store.state().outputQuality]).toEqual(['jpg', 80]);

      panel.setTemplate({ caption: 'Hi ' });
      fixture.detectChanges();
      panel.insertField('title');
      expect(store.state().caption).toBe('Hi {{title}}');
    });
  });
});
