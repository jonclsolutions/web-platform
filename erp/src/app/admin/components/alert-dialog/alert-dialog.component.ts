import { Component, EventEmitter, Output, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertType = 'info' | 'warning' | 'danger' | 'success';

export interface AlertToastItem {
  id: number;
  title: string;
  message: string;
  type: AlertType;
  leaving?: boolean;
}

@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-dialog.component.html',
  styleUrls: ['./alert-dialog.component.css']
})
export class AlertDialogComponent implements OnDestroy {
  toasts: AlertToastItem[] = [];

  @Output() toastClosed = new EventEmitter<number>();

  private autoHideTimeouts = new Map<number, any>();
  private cdr = inject(ChangeDetectorRef);

  private static readonly EXIT_ANIMATION_MS = 220;

  addToast(toast: AlertToastItem): void {
    // Nový toast dáváme na začátek (nahoru)
    this.toasts = [toast, ...this.toasts];
    this.cdr.detectChanges(); // Vynutíme detekci pro dynamicky mountnutou komponentu

    if (toast.type === 'success' || toast.type === 'info') {
      const timeout = setTimeout(() => this.removeToast(toast.id), 5000);
      this.autoHideTimeouts.set(toast.id, timeout);
    }
  }

  ok(id: number): void {
    this.removeToast(id);
  }

  closeClick(id: number, event: Event): void {
    event.stopPropagation();
    this.removeToast(id);
  }

  private removeToast(id: number): void {
    const toast = this.toasts.find(t => t.id === id);
    if (!toast || toast.leaving) return;

    this.clearTimeoutFor(id);
    toast.leaving = true;
    this.toasts = [...this.toasts];
    this.toastClosed.emit(id);
    this.cdr.detectChanges();

    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
      this.cdr.detectChanges();
    }, AlertDialogComponent.EXIT_ANIMATION_MS);
  }

  private clearTimeoutFor(id: number): void {
    const timeout = this.autoHideTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.autoHideTimeouts.delete(id);
    }
  }

  getDialogClass(type: AlertType): string {
    switch (type) {
      case 'warning': return 'warning-dialog';
      case 'danger': return 'danger-dialog';
      case 'success': return 'success-dialog';
      default: return 'info-dialog';
    }
  }

  ngOnDestroy(): void {
    this.autoHideTimeouts.forEach(timeout => clearTimeout(timeout));
    this.autoHideTimeouts.clear();
  }
}