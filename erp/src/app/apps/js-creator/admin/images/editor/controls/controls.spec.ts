/**
 * @file controls.spec.ts
 * @path src/app/apps/js-creator/admin/images/editor/controls/controls.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the small controls of the editor: colour with opacity, fill (kind
 *   switch keeping colours, gradient stops), anchor grid and the source of an image (none, field,
 *   new field, library image through its popup).
 * @dependencies ColorInputComponent, FillEditorComponent, AnchorPickerComponent,
 *   SourcePickerComponent, admin-test-helpers.ts.
 */

import { TestBed } from '@angular/core/testing';
import { ColorInputComponent, withAlpha } from './color-input.component';
import { FillEditorComponent } from './fill-editor.component';
import { AnchorPickerComponent } from './anchor-picker.component';
import { SourcePickerComponent } from './source-picker.component';
import { Fill, ImageSource } from '../../../shared/render/document';
import { AdminTestContext, createAdminTestContext } from '../../../../../../../testing/admin-test-helpers';
import { of } from 'rxjs';
import { PreferencesService } from '../../../shared/preferences.service';
import { imageField, testAsset } from '../editor-test-data';

describe('editor controls', () => {
  let ctx: AdminTestContext;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({
      imports: [ColorInputComponent, FillEditorComponent, AnchorPickerComponent, SourcePickerComponent],
      providers: ctx.providers,
    }).compileComponents();
  });

  /**
   * @description Colours keep their opacity: 100 % = #rrggbb, less = #rrggbbaa; typed codes are
   *   accepted only when valid.
   * @input withAlpha 50 / 100 / 0; picker #00ff00 at 50 %; typed "12AB34"; typed "red"
   * @output #ff000080, #ff0000, #ff000000; #00ff0080; #12ab34; value restored
   */
  it('handles colours with opacity', () => {
    expect(withAlpha('#FF0000', 50)).toBe('#ff000080');
    expect(withAlpha('#ff0000', 100)).toBe('#ff0000');
    expect(withAlpha('#ff0000', 0)).toBe('#ff000000');

    const fixture = TestBed.createComponent(ColorInputComponent);
    const component = fixture.componentInstance;
    component.value = '#ff000080';
    const values: string[] = [];
    component.valueChange.subscribe(v => values.push(v));
    fixture.detectChanges();
    expect(component.alphaPercent).toBe(50);
    component.pick('#00ff00');
    const hex = fixture.nativeElement.querySelector('.jc-color-hex') as HTMLInputElement;
    hex.value = '12AB34';
    component.typed(hex);
    hex.value = 'red';
    component.typed(hex);
    expect(values).toEqual(['#00ff0080', '#12ab34']);
    expect(hex.value).toBe('#ff000080');
  });

  /**
   * @description The fill editor switches kinds keeping the colour, edits gradient stops (2-6)
   *   and offers "none" only when allowed.
   * @input solid #112233 → linear; add a stop; remove (3 → 2); remove at 2 stays; → none
   * @output linear 180° from #112233; 3 stops; 2 stops; still 2; null
   */
  it('edits fills', () => {
    const fixture = TestBed.createComponent(FillEditorComponent);
    const component = fixture.componentInstance;
    const fills: (Fill | null)[] = [];
    component.fillChange.subscribe(f => {
      fills.push(f);
      component.fill = f;
    });
    component.fill = { type: 'solid', color: '#112233' };
    component.allowNone = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('option').length).toBe(4);

    component.setKind('linear');
    expect(fills[0]).toEqual({ type: 'linear', angle: 180, stops: [{ offset: 0, color: '#112233' }, { offset: 1, color: '#ffffff' }] });
    component.addStop();
    expect(component.stops.length).toBe(3);
    component.removeStop(1);
    component.removeStop(0);
    expect(component.stops.length).toBe(2);
    component.setAngle(-90);
    expect((component.fill as unknown as { angle: number }).angle).toBe(270);
    component.setKind('none');
    expect(fills[fills.length - 1]).toBeNull();
  });

  /**
   * @description The anchor grid marks the value and emits a clicked point.
   * @input value tr; click on the last point
   * @output 9 points, the third pressed; emits br
   */
  it('picks anchors', () => {
    const fixture = TestBed.createComponent(AnchorPickerComponent);
    fixture.componentInstance.value = 'tr';
    const picked: string[] = [];
    fixture.componentInstance.picked.subscribe(a => picked.push(a));
    fixture.detectChanges();
    const dots = fixture.nativeElement.querySelectorAll('.jc-anchor-dot') as NodeListOf<HTMLButtonElement>;
    expect(dots.length).toBe(9);
    expect(dots[2].getAttribute('aria-pressed')).toBe('true');
    dots[8].click();
    expect(picked).toEqual(['br']);
  });

  /**
   * @description The source picker: none, an existing field, a new field (asked from the
   *   parent), a library image chosen in its popup.
   * @input fields [photo]; kinds none / field; field select "new"; kind asset + choose image 5; no fields + kind field
   * @output none; field photo; newField; popup open, then asset 5 and assetPicked; newField
   */
  it('chooses image sources', () => {
    const fixture = TestBed.createComponent(SourcePickerComponent);
    const component = fixture.componentInstance;
    component.source = { kind: 'none' };
    component.fields = [imageField('photo') as never];
    const sources: ImageSource[] = [];
    let newFields = 0;
    const picked: number[] = [];
    component.sourceChange.subscribe(s => sources.push(s));
    component.newField.subscribe(() => newFields++);
    component.assetPicked.subscribe(a => picked.push(a.id));
    fixture.detectChanges();

    component.setKind('none');
    component.setKind('field');
    component.setField(component.newFieldValue);
    component.setKind('asset');
    expect(component.choosing).toBeTrue();
    component.pick(testAsset(5));
    component.fields = [];
    component.setKind('field');

    expect(sources).toEqual([{ kind: 'none' }, { kind: 'field', field: 'photo' }, { kind: 'asset', assetId: 5 }]);
    expect(newFields).toBe(2);
    expect(picked).toEqual([5]);
    expect(component.choosing).toBeFalse();
  });

  /**
   * @description Brand colours under a colour input: a click uses one (the opacity stays), +
   *   saves the current colour (not when it is there already).
   * @input brand colours [#1e1b4b]; value #ff000080; click the swatch; +
   * @output value #1e1b4b80; PUT preferences with [#1e1b4b, #ff0000]; no + for #1e1b4b
   */
  it('offers the brand colours', async () => {
    const prefs = TestBed.inject(PreferencesService);
    prefs.preferences.set({ colors: ['#1e1b4b'], hashtag_sets: [] });
    const fixture = TestBed.createComponent(ColorInputComponent);
    fixture.componentInstance.value = '#ff000080';
    const values: string[] = [];
    fixture.componentInstance.valueChange.subscribe(v => values.push(v));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.jc-swatch:not(.jc-swatch--add)') as HTMLButtonElement).click();
    expect(values).toEqual(['#1e1b4b80']);
    ctx.dataHandler.putQuietly.and.returnValue(of({ colors: ['#1e1b4b', '#ff0000'], hashtag_sets: [] }) as never);
    (fixture.nativeElement.querySelector('.jc-swatch--add') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(ctx.dataHandler.putQuietly).toHaveBeenCalledWith('js-creator/preferences', { colors: ['#1e1b4b', '#ff0000'], hashtag_sets: [] });
    expect(prefs.preferences().colors).toEqual(['#1e1b4b', '#ff0000']);
    fixture.componentInstance.value = '#1e1b4b';
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.jc-swatch--add')).toBeNull();
    prefs.preferences.set({ colors: [], hashtag_sets: [] });
  });
});
