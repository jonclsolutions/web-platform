import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

import { Button } from '../../../../shared/interfaces/button';

@Component({
  selector: 'app-button-builder',
  standalone: true,
  imports: [],
  templateUrl: './button-builder.component.html',
  styleUrl: './button-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonBuilderComponent {
  /** Pole konfigurací pro tlačítka */
  @Input() configs: Button[] = [];
  
  /** Emituje akci definovanou v konfiguraci tlačítka */
  @Output() actionTriggered = new EventEmitter<string>();

  onBtnClick(action: string): void {
    this.actionTriggered.emit(action);
  }
}