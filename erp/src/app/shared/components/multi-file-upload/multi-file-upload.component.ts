/**
 * @file multi-file-upload.component.ts
 * @path src/app/shared/components/multi-file-upload/multi-file-upload.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Univerzální komponenta pro výběr více souborů (drag&drop i klik), s
 * klientskou validací počtu/velikosti - jen UX pomůcka, skutečnou hranici vždy vynucuje
 * backend (viz StoreWebRawRequestCommissionRequest/StoreWebSalesOrderRequest).
 * Znovupoužitelná napříč veřejnými i (v části 2) admin formuláři.
 * @usage `<app-multi-file-upload (filesChanged)="onFilesChanged($event)" />`
 */

import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-multi-file-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multi-file-upload.component.html',
  styleUrl: './multi-file-upload.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiFileUploadComponent {
  @Input() maxFiles = 10;
  @Input() maxFileSizeMb = 20;
  @Input() maxTotalSizeMb = 50;
  @Input() label = 'Přílohy';

  @Output() filesChanged = new EventEmitter<File[]>();

  files: File[] = [];
  errorMessage: string | null = null;
  isDragging = false;

  private cd = inject(ChangeDetectorRef);

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  private addFiles(newFiles: File[]): void {
    this.errorMessage = null;
    const combined = [...this.files, ...newFiles];

    if (combined.length > this.maxFiles) {
      this.errorMessage = `Můžete nahrát maximálně ${this.maxFiles} souborů.`;
      this.cd.markForCheck();
      return;
    }

    const oversized = newFiles.find(f => f.size > this.maxFileSizeMb * 1024 * 1024);
    if (oversized) {
      this.errorMessage = `Soubor "${oversized.name}" přesahuje limit ${this.maxFileSizeMb} MB.`;
      this.cd.markForCheck();
      return;
    }

    const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > this.maxTotalSizeMb * 1024 * 1024) {
      this.errorMessage = `Celková velikost příloh nesmí přesáhnout ${this.maxTotalSizeMb} MB.`;
      this.cd.markForCheck();
      return;
    }

    this.files = combined;
    this.filesChanged.emit(this.files);
    this.cd.markForCheck();
  }

  removeFile(index: number): void {
    this.files = this.files.filter((_, i) => i !== index);
    this.errorMessage = null;
    this.filesChanged.emit(this.files);
    this.cd.markForCheck();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  get totalSizeLabel(): string {
    const total = this.files.reduce((sum, f) => sum + f.size, 0);
    return this.formatSize(total);
  }
}