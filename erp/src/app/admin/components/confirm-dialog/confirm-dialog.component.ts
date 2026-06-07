import { Component, EventEmitter, Output, Input } from '@angular/core';


@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent {
  @Input() title: string = 'Potvrzení';
  @Input() message: string = 'Opravdu si přejete provést tuto akci?';

  @Output() onConfirm = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();

  isVisible: boolean = false;

  show(): void {
    this.isVisible = true;
    this.blockBackgroundScroll();
  }

  public hide(): void {
    this.isVisible = false;
    this.unblockBackgroundScroll();
  }

  confirm(): void {
    this.onConfirm.emit();
    this.hide(); 
  }

  cancel(): void {
    this.onCancel.emit();
    this.hide(); 
  }

  private blockBackgroundScroll(): void {
    document.body.classList.add('no-scroll');
  }

  private unblockBackgroundScroll(): void {
    document.body.classList.remove('no-scroll');
  }
}