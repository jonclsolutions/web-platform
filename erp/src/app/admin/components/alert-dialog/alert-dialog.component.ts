import { Component, EventEmitter, Output, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertType = 'info' | 'warning' | 'danger' | 'success';

@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-dialog.component.html',
  styleUrls: ['./alert-dialog.component.css']
})
export class AlertDialogComponent implements OnDestroy {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() type: AlertType = 'info';

  @Output() onOk = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>(); // PŘIDÁNO: Událost pro úplné smazání z paměti

  isVisible: boolean = false;
  private autoHideTimeout: any;

  show(): void {
    this.isVisible = true;
    
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }

    // Success a info zmizí za 5s, danger a warning nezmizí vůbec
    if (this.type === 'success' || this.type === 'info') {
      this.autoHideTimeout = setTimeout(() => {
        this.hide();
      }, 5000); 
    }
  }

  public hide(): void {
    this.isVisible = false;
    this.onClose.emit(); // PŘIDÁNO: Řekneme rodiči, že se může komponenty zbavit
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }
  }

  ok(): void {
    this.onOk.emit();
    this.hide();
  }

  closeClick(): void {
    this.hide();
  }

  ngOnDestroy(): void {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }
  }

  getDialogClass(): string {
    switch (this.type) {
      case 'warning': return 'warning-dialog';
      case 'danger': return 'danger-dialog';
      case 'success': return 'success-dialog';
      default: return 'info-dialog';
    }
  }
}