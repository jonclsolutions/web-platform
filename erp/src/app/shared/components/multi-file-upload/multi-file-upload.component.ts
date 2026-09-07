/**
 * @file multi-file-upload.component.ts
 * @path src/app/shared/components/multi-file-upload/multi-file-upload.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Univerzální komponenta pro výběr více souborů (drag&drop i klik), s
 * klientskou validací počtu/velikosti - jen UX pomůcka, skutečnou hranici vždy vynucuje
 * backend (viz StoreWebRawRequestCommissionRequest/StoreWebSalesOrderRequest).
 * Znovupoužitelná napříč veřejnými i admin formuláři.
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
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * Tahle komponenta je sdílená mezi PUBLIC webem (LocalizationService, DB-editovatelný
 * obsah, typicky 1-2 jazyky) a ADMIN rozhraním (AdminLocalizationService, statický
 * bundlovaný JSON, potenciálně 10+ jazyků). Injektovat KTEROUKOLIV z těch dvou služeb
 * přímo sem by komponentu natvrdo svázalo s jedním z těch dvou kontextů a rozbilo
 * použití ve druhém - proto místo toho zůstává ČISTĚ PREZENTAČNÍ: žádné texty si
 * neshání sama, všechny přijímá zvenku přes `@Input() textOverrides` (viz
 * `DEFAULT_MULTI_FILE_UPLOAD_TEXTS` níže pro výchozí/fallback hodnoty - použijí se,
 * pokud konzument nic nepředá, takže žádné dosavadní použití touhle změnou nespadne).
 * Konzument (form-builder.component.ts v adminu, libovolná public stránka) si texty
 * vytáhne ze SVÉ VLASTNÍ i18n vrstvy a pošle je dovnitř jako obyčejná data - stejný
 * vzor, jaký už dřív existoval jen pro `@Input() label`, teď rozšířený na VŠECHNY
 * dřív natvrdo psané texty (error hlášky, popisky, tlačítka). Texty s proměnnou
 * ({count}/{max}/{filename}/{size}) jsou šablony nahrazované přes `.replace()` v
 * gettrech/metodách níže - žádný templating engine, stejný vzor jako jinde v projektu.
 *
 * @refactor-note (2026-09v2) BUGFIX "hint pod labelem zůstával česky natvrdo": limitový
 * hint ("(max. X souborů, Y MB/soubor, Z MB celkem)") byl PŮVODNĚ natvrdo napsaný přímo
 * v šabloně vedle `{{ label }}` a unikl první vlně migrace (2026-09), protože nebyl
 * součástí `MultiFileUploadTexts`. Přidán jako `limitsHint` (šablona s {max}/{maxMb}/
 * {totalMb}, stejný `.replace()` vzor jako ostatní parametrizované texty zde) + getter
 * `limitsHintText` níže.
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

/**
 * @description Kompletní sada textů, které komponenta potřebuje vykreslit. Konzument
 * (public i admin) posílá `Partial<MultiFileUploadTexts>` - cokoliv nepředá, doplní se
 * z `DEFAULT_MULTI_FILE_UPLOAD_TEXTS`. Placeholdery ve tvaru `{name}` nahrazuje sama
 * komponenta přes `.replace()`, NIKDY konzument - konzument posílá šablonu, ne hotový
 * text (jinak by musel znát interní detaily typu `existingCount`).
 */
export interface MultiFileUploadTexts {
  /** Hint vedle labelu - {max} = maxFiles, {maxMb} = maxFileSizeMb, {totalMb} = maxTotalSizeMb */
  limitsHint: string;
  /** "Již nahrané přílohy ({count})" - {count} = visibleExistingFiles.length */
  existingSectionTitle: string;
  /** title atribut tlačítka "✕" u existující přílohy */
  removeExistingTitle: string;
  /** Text uvnitř dropzony */
  dropzoneLabel: string;
  /** Chyba při překročení limitu POČTU souborů, když už nějaké existující jsou -
   * {max} = maxFiles, {existing} = počet existujících */
  errorMaxFilesWithExisting: string;
  /** Chyba při překročení limitu POČTU souborů bez existujících - {max} = maxFiles */
  errorMaxFiles: string;
  /** Chyba jednotlivého souboru nad limit - {filename}, {maxMb} */
  errorFileTooLarge: string;
  /** Chyba celkové velikosti nad limit - {maxMb} */
  errorTotalSizeExceeded: string;
  /** Počítadlo dole - {count} = combinedCount, {max} = maxFiles */
  totalLabel: string;
  /** Připojeno za totalLabel, jen když jsou nové soubory - {size} = totalSizeLabel */
  totalNewSuffix: string;
}

/**
 * @description Výchozí (fallback) texty - české, zachovávají PŮVODNÍ chování komponenty
 * pro jakéhokoliv konzumenta, který `textOverrides` zatím nepředává (aby tahle změna
 * nikde nic nerozbila). Noví/upravovaní konzumenti by měli předat plnou lokalizovanou
 * sadu ze svojí i18n vrstvy.
 */
export const DEFAULT_MULTI_FILE_UPLOAD_TEXTS: MultiFileUploadTexts = {
  limitsHint: '(max. {max} souborů, {maxMb} MB/soubor, {totalMb} MB celkem)',
  existingSectionTitle: 'Již nahrané přílohy ({count})',
  removeExistingTitle: 'Odebrat přílohu',
  dropzoneLabel: '↑ Vyberte soubory nebo je přetáhněte sem',
  errorMaxFilesWithExisting: 'Můžete mít nahráno maximálně {max} souborů (včetně {existing} již existujících).',
  errorMaxFiles: 'Můžete nahrát maximálně {max} souborů.',
  errorFileTooLarge: 'Soubor "{filename}" přesahuje limit {maxMb} MB.',
  errorTotalSizeExceeded: 'Celková velikost příloh nesmí přesáhnout {maxMb} MB.',
  totalLabel: 'Celkem: {count} / {max} souborů',
  totalNewSuffix: ' ({size} nových)',
};

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

  /**
   * @description Texty pro tuhle instanci komponenty - viz refactor-note (2026-09) v
   * hlavičce souboru. Cokoliv nevyplněné se doplní z `DEFAULT_MULTI_FILE_UPLOAD_TEXTS`
   * (getter `t` níže).
   */
  @Input() textOverrides: Partial<MultiFileUploadTexts> = {};

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

  /**
   * @description Sloučené texty (výchozí + `textOverrides`) - jediné místo, odkud
   * šablona i interní metody čtou UI texty. Recomputed při každém přístupu (levné,
   * jde jen o spread malého objektu), takže reaguje i na `textOverrides` změněné za
   * běhu (např. přepnutí jazyka admin rozhraní, viz form-builder.component.ts).
   */
  get t(): MultiFileUploadTexts {
    return { ...DEFAULT_MULTI_FILE_UPLOAD_TEXTS, ...this.textOverrides };
  }

  /**
   * @description Hint vedle labelu s dosazenými limity - viz `t.limitsHint`.
   * @refactor-note (2026-09v2) viz hlavička souboru - dřív natvrdo v šabloně.
   */
  get limitsHintText(): string {
    return this.t.limitsHint
      .replace('{max}', String(this.maxFiles))
      .replace('{maxMb}', String(this.maxFileSizeMb))
      .replace('{totalMb}', String(this.maxTotalSizeMb));
  }

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

  /** @description "Již nahrané přílohy (N)" s dosazeným počtem - viz `t.existingSectionTitle`. */
  get existingSectionTitleText(): string {
    return this.t.existingSectionTitle.replace('{count}', String(this.visibleExistingFiles.length));
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
        ? this.t.errorMaxFilesWithExisting.replace('{max}', String(this.maxFiles)).replace('{existing}', String(existingCount))
        : this.t.errorMaxFiles.replace('{max}', String(this.maxFiles));
      this.cd.markForCheck();
      return;
    }

    const oversized = newFiles.find(f => f.size > this.maxFileSizeMb * 1024 * 1024);
    if (oversized) {
      this.errorMessage = this.t.errorFileTooLarge
        .replace('{filename}', oversized.name)
        .replace('{maxMb}', String(this.maxFileSizeMb));
      this.cd.markForCheck();
      return;
    }

    const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > this.maxTotalSizeMb * 1024 * 1024) {
      this.errorMessage = this.t.errorTotalSizeExceeded.replace('{maxMb}', String(this.maxTotalSizeMb));
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

  /** @description "Celkem: N / max souborů (X MB nových)" - viz `t.totalLabel`/`t.totalNewSuffix`. */
  get totalLabelText(): string {
    const base = this.t.totalLabel.replace('{count}', String(this.combinedCount)).replace('{max}', String(this.maxFiles));
    const suffix = this.files.length > 0 ? this.t.totalNewSuffix.replace('{size}', this.totalSizeLabel) : '';
    return base + suffix;
  }
}