/**
 * @file button-builder.component.ts
 * @path src/app/admin/components/button-builder/button-builder.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2025
 * @description Presentational component that dynamically renders a group of buttons based on an input configuration array.
 * @dependencies
 * - Button: Interface defining the structure of the button configuration.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Button } from '../../../../shared/interfaces/button';

/**
 * @description A reusable utility component that constructs UI button groups from provided configuration objects.
 * @usage Used in various administrative list and detail pages to generate consistent action toolbars.
 * @note Utilizes OnPush change detection to optimize rendering performance when configuration inputs are updated.
 */
@Component({
  selector: 'app-button-builder',
  standalone: true,
  imports: [],
  templateUrl: './button-builder.component.html',
  styleUrl: './button-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonBuilderComponent {
  /** * @description Array of button configurations to be rendered.
   */
  @Input() configs: Button[] = [];
  
  /** * @description Event emitter that propagates the action identifier defined in the button configuration.
   */
  @Output() actionTriggered = new EventEmitter<string>();

  /**
   * @description Handles button click events and emits the associated action string to the parent component.
   * @param action The unique identifier or action type associated with the clicked button.
   */
  onBtnClick(action: string): void {
    this.actionTriggered.emit(action);
  }
}