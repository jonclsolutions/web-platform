/**
 * @file icon-chooser.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/controls/icon-chooser.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Popup choosing an icon of the icon set of JS Creator (Lucide, no brand logos) with
 *   a search by name. A click on an icon chooses it.
 * @usage `@if (choosingIcon) { <app-jc-icon-chooser (chosen)="setIcon($event)" (dismissed)="choosingIcon = false" /> }`
 * @dependencies AdminModalComponent, IconSetService, CreatorIconComponent,
 *   AdminLocalizationService (section `js-creator-editor`).
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { AdminModalComponent } from '../../../../../../admin/components/admin-modal/admin-modal.component';
import { IconSetService } from '../../../shared/icon-set.service';
import { CreatorIconComponent } from '../../../shared/creator-icon/creator-icon.component';

@Component({
  selector: 'app-jc-icon-chooser',
  standalone: true,
  imports: [AdminModalComponent, CreatorIconComponent],
  template: `
    <app-admin-modal [heading]="t('choose_icon')" size="lg" (dismissed)="dismissed.emit()">
      <div class="jc-chooser-bar">
        <input class="jc-input jc-chooser-search" type="search" [placeholder]="t('search')" [attr.aria-label]="t('search')"
          [value]="query()" (input)="query.set($any($event.target).value)" />
      </div>
      <div class="jc-chooser-icons">
        @for (icon of icons(); track icon.name) {
          <button type="button" class="jc-chooser-icon" [title]="icon.name" [attr.aria-label]="icon.name" (click)="chosen.emit(icon.name)">
            <app-creator-icon [nodes]="icon.nodes" [size]="28" />
            <span>{{ icon.name }}</span>
          </button>
        }
      </div>
    </app-admin-modal>
  `,
  styleUrls: ['../../../../../../admin/shared-styles/modal.css', './controls.css', './chooser.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconChooserComponent {
  private readonly i18n = inject(AdminLocalizationService);
  private readonly set = toSignal(inject(IconSetService).iconSet());

  /** An icon was chosen. */
  @Output() readonly chosen = new EventEmitter<string>();
  /** The popup was closed. */
  @Output() readonly dismissed = new EventEmitter<void>();

  /** Search. */
  readonly query = signal('');
  /** Icons matching the search. */
  readonly icons = computed(() => {
    const q = this.query().trim().toLowerCase();
    return Object.entries(this.set()?.icons ?? {})
      .filter(([name]) => !q || name.includes(q))
      .map(([name, nodes]) => ({ name, nodes }));
  });

  /**
   * @description Text of the editor.
   * @param key Key in `js-creator-editor`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-editor.${key}`);
  }
}
