/**
 * @file layers-panel.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/panels/layers-panel.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Panel "Layers" of the editor: the layers from the top one down, a click selects
 *   (Shift adds / removes - also locked layers), dragging a row changes the order of drawing,
 *   double click renames, the switches hide / lock a layer. Field layers are marked.
 * @usage `<app-jc-layers [store]="store" />`
 * @dependencies EditorStore, CreatorIconComponent, ui-icons, text-layout (plainText),
 *   AdminLocalizationService (section `js-creator-editor`).
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { EditorStore } from '../editor-store';
import { Layer } from '../../../shared/render/document';
import { plainText } from '../../../shared/render/text-layout';
import { CreatorIconComponent } from '../../../shared/creator-icon/creator-icon.component';
import { UiIconName, uiIcon } from '../../../shared/ui-icons';

/** Interface icon of each kind of layer. */
const TYPE_ICONS: Record<Layer['type'], UiIconName> = { text: 'text', image: 'image', grid: 'grid', shape: 'shape', icon: 'icon' };

@Component({
  selector: 'app-jc-layers',
  standalone: true,
  imports: [CreatorIconComponent],
  template: `
    <div class="ly" role="listbox" [attr.aria-label]="t('layers')" aria-multiselectable="true">
      @for (layer of rows(); track layer.id; let i = $index) {
        <div class="ly-row" role="option" [attr.aria-selected]="selected().has(layer.id)" [class.ly-row--selected]="selected().has(layer.id)"
          [class.ly-row--hidden]="layer.hidden" [class.ly-row--over]="overIndex() === i" [draggable]="store().editable && renaming() !== layer.id"
          (click)="select(layer, $event)" (dblclick)="startRename(layer)"
          (dragstart)="onDragStart($event, layer)" (dragover)="onDragOver($event, i)" (dragleave)="overIndex.set(null)" (drop)="onDrop($event, i)" (dragend)="overIndex.set(null)">
          <span class="ly-type"><app-creator-icon [nodes]="typeIcon(layer)" [size]="15" /></span>
          @if (renaming() === layer.id) {
            <input class="jc-input ly-name-input" type="text" maxlength="80" [value]="layer.name" [attr.aria-label]="t('layer_name')" data-autofocus
              (keydown.enter)="finishRename(layer, $any($event.target).value)" (keydown.escape)="renaming.set(null)"
              (blur)="finishRename(layer, $any($event.target).value)" (click)="$event.stopPropagation()" />
          } @else {
            <span class="ly-name" [title]="label(layer)">{{ label(layer) }}</span>
          }
          @if (isField(layer)) {
            <span class="ly-badge" [title]="t('field_layer')">{{ t('field_badge') }}</span>
          }
          <button type="button" class="ly-btn" [class.ly-btn--on]="layer.locked" [disabled]="!store().editable" [title]="t('lock')"
            [attr.aria-label]="t('lock') + ': ' + label(layer)" [attr.aria-pressed]="layer.locked" (click)="toggle(layer, 'locked', $event)">
            <app-creator-icon [nodes]="icon(layer.locked ? 'lock' : 'unlock')" [size]="14" />
          </button>
          <button type="button" class="ly-btn" [class.ly-btn--on]="layer.hidden" [disabled]="!store().editable" [title]="t('hide')"
            [attr.aria-label]="t('hide') + ': ' + label(layer)" [attr.aria-pressed]="layer.hidden" (click)="toggle(layer, 'hidden', $event)">
            <app-creator-icon [nodes]="icon(layer.hidden ? 'eye-off' : 'eye')" [size]="14" />
          </button>
        </div>
      } @empty {
        <p class="ly-empty">{{ t('no_layers') }}</p>
      }
    </div>
  `,
  styleUrls: ['../controls/controls.css', './layers-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayersPanelComponent {
  private readonly i18n = inject(AdminLocalizationService);

  /** State of the editor. */
  readonly store = input.required<EditorStore>();

  /** Layer being renamed. */
  readonly renaming = signal<string | null>(null);
  /** Row a dragged layer is over. */
  readonly overIndex = signal<number | null>(null);
  /** Layers from the top one down. */
  readonly rows = computed(() => [...this.store().layers()].reverse());
  /** Ids of the selected layers. */
  readonly selected = computed(() => new Set(this.store().selection()));

  /** Id of the dragged layer. */
  private dragged: string | null = null;

  /**
   * @description Text of the editor.
   * @param key Key in `js-creator-editor`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-editor.${key}`);
  }

  /**
   * @description Elements of an interface icon.
   * @param name Name.
   */
  icon(name: UiIconName) {
    return uiIcon(name);
  }

  /**
   * @description Icon of the kind of a layer.
   * @param layer Layer.
   */
  typeIcon(layer: Layer) {
    return uiIcon(TYPE_ICONS[layer.type]);
  }

  /**
   * @description Shown name: own name, otherwise the text / field / kind.
   * @param layer Layer.
   */
  label(layer: Layer): string {
    if (layer.name) return layer.name;
    if (layer.type === 'text') {
      const field = layer.field ? this.store().doc().fields.find(f => f.key === layer.field) : null;
      return (field ? field.label : plainText(layer.text).replace(/\n/g, ' ')).slice(0, 40) || this.t('type_text');
    }
    if (layer.type === 'icon') return `${this.t('type_icon')}: ${layer.icon}`;
    return this.t('type_' + layer.type);
  }

  /**
   * @description Whether a layer is (or contains) a field.
   * @param layer Layer.
   */
  isField(layer: Layer): boolean {
    if (layer.type === 'text') return !!layer.field;
    if (layer.type === 'image') return layer.source.kind === 'field';
    if (layer.type === 'grid') return layer.cells.some(c => c.source.kind === 'field');
    return false;
  }

  /**
   * @description Selects a layer (Shift adds / removes).
   * @param layer Layer.
   * @param event Click.
   */
  select(layer: Layer, event: MouseEvent): void {
    this.store().select([layer.id], event.shiftKey || event.metaKey || event.ctrlKey);
  }

  /**
   * @description Switches hidden / locked.
   * @param layer Layer.
   * @param prop hidden | locked.
   * @param event Click (not a selection).
   */
  toggle(layer: Layer, prop: 'hidden' | 'locked', event: MouseEvent): void {
    event.stopPropagation();
    this.store().updateLayer(layer.id, { [prop]: !layer[prop] });
  }

  /**
   * @description Starts renaming.
   * @param layer Layer.
   */
  startRename(layer: Layer): void {
    if (!this.store().editable) return;
    this.renaming.set(layer.id);
    setTimeout(() => (document.querySelector('.ly-name-input') as HTMLInputElement | null)?.select());
  }

  /**
   * @description Ends renaming with a new name.
   * @param layer Layer.
   * @param name Name.
   */
  finishRename(layer: Layer, name: string): void {
    if (this.renaming() !== layer.id) return;
    this.renaming.set(null);
    const value = name.trim().slice(0, 80);
    if (value !== layer.name) this.store().updateLayer(layer.id, { name: value });
  }

  /**
   * @description A row starts to be dragged.
   * @param event Drag event.
   * @param layer Layer.
   */
  onDragStart(event: DragEvent, layer: Layer): void {
    this.dragged = layer.id;
    event.dataTransfer?.setData('text/plain', layer.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /**
   * @description A dragged row is over another one.
   * @param event Drag event.
   * @param index Row (from the top).
   */
  onDragOver(event: DragEvent, index: number): void {
    if (!this.dragged) return;
    event.preventDefault();
    this.overIndex.set(index);
  }

  /**
   * @description A row was dropped on another one: it takes its place.
   * @param event Drag event.
   * @param index Row (from the top).
   */
  onDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    this.overIndex.set(null);
    const id = this.dragged;
    this.dragged = null;
    if (id) this.store().moveLayerTo(id, this.rows().length - 1 - index);
  }
}
