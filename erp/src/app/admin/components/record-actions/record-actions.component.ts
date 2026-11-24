/**
 * @file record-actions.component.ts
 * @path src/app/admin/components/record-actions/record-actions.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Actions of a record on the left of the footer of a record popup (the popup opened
 *   by a click on a table row): the row buttons the user may use on the record - up to two other
 *   actions as buttons, more of them under "⋯ More" (a menu opening upwards), Delete always
 *   visible, last and red (on a phone only its icon, the name stays as its label). The top right
 *   corner of the popup stays for the close button.
 * @usage <app-record-actions [actions]="recordActions" (action)="onRecordAction($event)" />
 *   inside `<ng-container modal-footer>` before the Cancel / Save buttons.
 * @dependencies
 * - TableButtons: the row button configuration (permission / visibleWhen already applied by
 *   TableBuilderComponent.recordActions()).
 * - IconComponent: icons of the actions; AdminLocalizationService: the "More" label.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TableButtons } from '../../../shared/interfaces/table-buttons';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

@Component({
  selector: 'app-record-actions',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './record-actions.component.html',
  styleUrl: './record-actions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordActionsComponent {
  /** Actions of the record (the row buttons the user may use on it). */
  @Input() actions: TableButtons[] = [];
  /** An action was clicked - carries its `action` (e.g. 'delete'). */
  @Output() action = new EventEmitter<string>();

  /** The "⋯ More" menu is open. */
  isMoreActionsOpen = false;

  private readonly i18n = inject(AdminLocalizationService);

  /**
   * @description Text of the section `record-actions`.
   * @param key Key in the section.
   */
  label(key: string): string {
    return this.i18n.getValue(`record-actions.${key}`);
  }

  /**
   * @description Name of an action: its button text, else its column header (some row buttons
   *   show only an icon and have an empty text).
   * @param action Row button.
   */
  nameOf(action: TableButtons): string {
    return action.display_name || action.header_name || action.action;
  }

  /** @description Delete actions - always visible, last and red. */
  get dangerActions(): TableButtons[] {
    return this.actions.filter(action => action.type === 'delete_button');
  }

  /** @description Other actions of the record (e.g. Variants, Images, Reset password). */
  get otherActions(): TableButtons[] {
    return this.actions.filter(action => action.type !== 'delete_button');
  }

  /** @description More than two other actions go under "⋯ More" (the footer stays one row). */
  get moreActionsMenu(): boolean {
    return this.otherActions.length > 2;
  }

  /** @description Opens / closes the "⋯ More" menu. */
  toggleMoreActions(): void {
    this.isMoreActionsOpen = !this.isMoreActionsOpen;
  }

  /**
   * @description Runs an action (also an item of "⋯ More", which then closes).
   * @param action `action` of the button.
   */
  run(action: string): void {
    this.isMoreActionsOpen = false;
    this.action.emit(action);
  }
}
