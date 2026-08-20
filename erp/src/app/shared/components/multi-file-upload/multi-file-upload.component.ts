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
 *
 * @refactor-note (2026-08-19) BACKLOG "existující přílohy vidět v editu": přidán
 * `@Input() existingFiles` - read-only seznam už nahraných příloh (z API, typicky
 * `formDataToEdit.attachments`), zobrazený NAD dropzonou pro nové soubory. Limit počtu
 * souborů (`maxFiles`) počítá `existingFiles.length + files.length`, ne jen nově
 * přidávané - admin tak nemůže klientsky "omylem" navrhnout víc příloh, než kolik
 * záznam po uložení reálně unese, i když už nějaké má.
 *
 * @refactor-note (2026-08-19v2) BACKLOG "mazání existujících příloh v editu - staged":
 * přidáno tlačítko "✕" u existující přílohy - klik ji OKAMŽITĚ jen VIZUÁLNĚ schová
 * (žádné API volání odsud, žádná změna na disku/DB v tuhle chvíli) a přidá její `id` do
 * `removedExistingIds`. Nový `@Output() existingFileRemoved` emituje aktuální seznam
 * odebraných ID při každé změně - konzumující `FormBuilderComponent` si ho uloží do
 * `formData` a pošle spolu s ostatními daty AŽ při reálném uložení formuláře (viz
 * form-builder.component.ts). Storno/zrušení formuláře komponentu celou zahodí (typicky
 * `@if`/`*ngIf` na rodiči), takže žádný extra reset stavu není potřeba - při příštím
 * otevření je to čerstvá instance. `visibleExistingFiles`/`combinedCount`/`addFiles()`
 * limit počtu souborů teď počítají jen s NEODEBRANÝMI existujícími přílohami.
 */

import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * @description Minimální tvar existující přílohy potřebný pro zobrazení - odpovídá
 * `WebAttachmentResource` z API, ale typ je zde záměrně vlastní (ne import backendového
 * DTO), ať komponenta zůstává nezávislá na konkrétním resource.
 */
export interface ExistingAttachment {
  id: number;
  original_filename: string;
  size_bytes: number;
  download_url?: string | null;
  view_url?: string | null;
}

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

  /**
   * @description Read-only přílohy, které záznam už má (z API) - komponenta je sama
   * nemaže na serveru, jen umožní je STAGED odebrat z pohledu (viz `removeExistingFile()`
   * / `existingFileRemoved` output). Default `[]` = beze změny chování (nový záznam,
   * žádné existující přílohy).
   */
  @Input() existingFiles: ExistingAttachment[] = [];

  @Output() filesChanged = new EventEmitter<File[]>();

  /**
   * @description Emituje aktuální seznam ID existujících příloh označených ke smazání
   * (celé pole, ne jen nově přidané ID) - konzumující komponenta si tenhle seznam uloží
   * a pošle ho na server až při reálném uložení formuláře. Nic se odsud samo neposílá.
   */
  @Output() existingFileRemoved = new EventEmitter<number[]>();

  files: File[] = [];
  errorMessage: string | null = null;
  isDragging = false;

  /** ID existujících příloh, které uživatel v UI odebral - jen lokální stav do uložení. */
  removedExistingIds = new Set<number>();

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

  /** @description Existující přílohy, které uživatel (zatím jen v UI) NEoznačil ke smazání. */
  get visibleExistingFiles(): ExistingAttachment[] {
    return this.existingFiles.filter(f => !this.removedExistingIds.has(f.id));
  }

  /**
   * @description Staged odebrání existující přílohy - žádné API volání, jen vizuální
   * skrytí + evidence ID pro pozdější odeslání s uložením formuláře. Nevratné v rámci
   * TÉTO komponenty (žádné "vrátit zpět" tlačítko) - jediný způsob, jak si to uživatel
   * rozmyslí, je formulář zavřít bez uložení (Storno), čímž se celá komponenta zahodí.
   */
  removeExistingFile(id: number): void {
    this.removedExistingIds.add(id);
    this.existingFileRemoved.emit(Array.from(this.removedExistingIds));
    this.cd.markForCheck();
  }

  /**
   * @bugfix-note (2026-08-19) Limit počtu souborů teď počítá `visibleExistingFiles`
   * (existující MÍNUS staged odebrané), ne surové `existingFiles` - jinak by odebrání
   * staré přílohy neuvolnilo místo pro novou, dokud by se formulář reálně neuložil.
   */
  private addFiles(newFiles: File[]): void {
    this.errorMessage = null;
    const combined = [...this.files, ...newFiles];
    const existingCount = this.visibleExistingFiles.length;
    const totalCount = existingCount + combined.length;

    if (totalCount > this.maxFiles) {
      this.errorMessage = existingCount > 0
        ? `Můžete mít nahráno maximálně ${this.maxFiles} souborů (včetně ${existingCount} již existujících).`
        : `Můžete nahrát maximálně ${this.maxFiles} souborů.`;
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

  /** @description Kolik souborů celkem (neodebrané existující + nově vybrané) - pro počítadlo v šabloně. */
  get combinedCount(): number {
    return this.visibleExistingFiles.length + this.files.length;
  }
}