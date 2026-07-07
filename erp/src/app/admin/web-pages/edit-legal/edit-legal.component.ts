/**
 * @file edit-legal.component.ts
 * @path src/app/admin/web-pages/edit-legal/edit-legal.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Provides a multi-language content management interface for legal document sections (e.g., GDPR, Terms of Service).
 * @dependencies
 * - BaseDataComponent: Manages core CRUD operations and API communication.
 * - ConfirmDialogService: Facilitates secure deletion of content sections.
 * - AlertDialogService: Provides feedback to users after operations.
 * - RxJS: Used for reactive data fetching and cross-language consistency checks.
 */

import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';

interface DocumentSection {
  id: number;
  document_type_id: number;
  position: number;
  heading: string;
  content: string;
  lang?: string;
}

/**
 * @description Manages the editing lifecycle of localized legal document content.
 * @usage Allows administrators to toggle between document types (GDPR, TOS) and languages, ensuring content parity across translations.
 * @note Implements an inline editing pattern with a completeness checker to warn users about missing translations.
 */
@Component({
  selector: 'app-edit-legal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './edit-legal.component.html',
  styleUrl: './edit-legal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditLegalComponent extends BaseDataComponent<DocumentSection> implements OnInit {
  override apiEndpoint: string = 'legal/document-sections';

  private readonly LANG_MODULE = 'web';

  activeTab: 1 | 2 = 1;

  languages: any[] = [];
  activeLang: string = 'cz';

  missingSummary: Record<number, string[]> = {};

  editingIds: Set<number> = new Set();
  editBuffer: Record<number, { heading: string; content: string }> = {};

  showAddForm = false;
  newHeading = '';
  newContent = '';
  saving = false;

  addForPosition: number | null = null;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private fb: FormBuilder,
    private router: Core.Router,
    private confirmDialog: ConfirmDialogService,
    private alertDialog: AlertDialogService
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    this.initWithAuthCheck(this.router);
    this.loadLanguages();
  }

  /**
   * @description Retrieves supported languages for the 'web' module and initializes the active language state.
   */
  private loadLanguages(): void {
    this.dataHandler.getCollection<any>(`languages/${this.LANG_MODULE}`)
      .pipe(catchError(() => of({ languages: [] })))
      .subscribe((res: any) => {
        this.languages = (res?.languages ?? []).filter((l: any) => l.active !== false);

        if (this.languages.length > 0 && !this.languages.find(l => l.code === this.activeLang)) {
          this.activeLang = this.languages[0].code;
        }

        this.refreshData();
        this.cd.markForCheck();
      });
  }

  /**
   * @description Updates the active language and resets transient UI states to prevent editing collisions.
   * @param code The language ISO code to switch to.
   */
  switchLang(code: string): void {
    if (this.activeLang === code) return;
    this.activeLang = code;
    this.editingIds.clear();
    this.editBuffer = {};
    this.showAddForm = false;
    this.addForPosition = null;
    this.newHeading = '';
    this.newContent = '';
    this.refreshData();
  }

  getLangName(code: string): string {
    return this.languages.find(l => l.code === code)?.name ?? code.toUpperCase();
  }

  override refreshData(): void {
    const params = {
      document_type_id: this.activeTab,
      lang: this.activeLang
    };
    
    this.loadAllData(params).subscribe({
      next: (res) => {
        this.data = Array.isArray(res) ? res : [];
        this.checkCompleteness();
        this.cd.markForCheck();
      }
    });
  }

  switchTab(tabId: 1 | 2): void {
    if (this.activeTab === tabId) return;
    this.activeTab = tabId;
    this.editingIds.clear();
    this.editBuffer = {};
    this.showAddForm = false;
    this.addForPosition = null;
    this.newHeading = '';
    this.newContent = '';
    this.refreshData();
  }

  /**
   * @description Performs an asynchronous check across all languages to identify missing translations for existing sections.
   * @note Uses forkJoin to aggregate data for every supported language and compares position availability.
   */
  private checkCompleteness(): void {
    if (this.languages.length <= 1) {
      this.missingSummary = {};
      this.cd.markForCheck();
      return;
    }

    const requests = this.languages.map(lang =>
      this.loadAllData({
        document_type_id: this.activeTab,
        lang: lang.code
      }).pipe(
        map(res => ({
          lang: lang.code,
          positions: new Set<number>((Array.isArray(res) ? res : []).map((s: DocumentSection) => s.position))
        })),
        catchError(() => of({ lang: lang.code, positions: new Set<number>() }))
      )
    );

    forkJoin(requests).subscribe(results => {
      const allPositions = new Set<number>();
      results.forEach(r => r.positions.forEach(p => allPositions.add(p)));

      const summary: Record<number, string[]> = {};
      allPositions.forEach(pos => {
        const missing = results.filter(r => !r.positions.has(pos)).map(r => r.lang);
        if (missing.length > 0) {
          summary[pos] = missing;
        }
      });

      this.missingSummary = summary;
      this.cd.markForCheck();
    });
  }

  getMissingForPosition(position: number): string[] {
    return this.missingSummary[position] ?? [];
  }

  langHasWarning(langCode: string): boolean {
    return Object.values(this.missingSummary).some(missing => missing.includes(langCode));
  }

  get totalWarnings(): number {
    return Object.values(this.missingSummary).reduce((sum, arr) => sum + arr.length, 0);
  }

  get missingPositionsForCurrentLang(): number[] {
    return Object.keys(this.missingSummary)
      .map(Number)
      .filter(pos => this.missingSummary[pos].includes(this.activeLang))
      .sort((a, b) => a - b);
  }

  /**
   * @description Initializes the buffer for inline editing of a specific document section.
   * @param item The section to start editing.
   */
  startEdit(item: DocumentSection): void {
    this.editingIds.add(item.id);
    this.editBuffer[item.id] = {
      heading: item.heading ?? '',
      content: item.content ?? '',
    };
    this.cd.markForCheck();
  }

  cancelEdit(id: number): void {
    this.editingIds.delete(id);
    delete this.editBuffer[id];
    this.cd.markForCheck();
  }

  /**
   * @description Commits edited data to the API and refreshes the current view.
   * @param item The original item containing the ID.
   */
  saveEdit(item: DocumentSection): void {
    const buf = this.editBuffer[item.id];
    if (!buf || !buf.content?.trim()) {
      this.alertDialog.open('Chyba', 'Obsah sekce nesmí být prázdný.', 'warning');
      return;
    }

    this.saving = true;
    const payload: DocumentSection = {
      ...item,
      heading: buf.heading,
      content: buf.content,
      lang: this.activeLang,
    };

    this.updateData(item.id, payload).subscribe({
      next: () => {
        this.cancelEdit(item.id);
        this.saving = false;
        this.refreshData();
        this.alertDialog.open('Úspěch', 'Změny byly uloženy.', 'success');
      },
      error: () => {
        this.saving = false;
        this.alertDialog.open('Chyba', 'Nepodařilo se uložit změny.', 'danger');
        this.cd.markForCheck();
      }
    });
  }

  isEditing(id: number): boolean {
    return this.editingIds.has(id);
  }

  /**
   * @description Displays the creation form and scrolls it into view.
   * @param position Optional numeric index for ordering.
   */
  openAddForm(position?: number): void {
    this.showAddForm = true;
    this.addForPosition = position ?? null;
    this.newHeading = '';
    this.newContent = '';
    setTimeout(() => {
      const el = document.getElementById('add-form-anchor');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    this.cd.markForCheck();
  }

  cancelAdd(): void {
    this.showAddForm = false;
    this.addForPosition = null;
    this.newHeading = '';
    this.newContent = '';
    this.cd.markForCheck();
  }

  submitAdd(): void {
    if (!this.newContent?.trim() || !this.newHeading?.trim()) {
      this.alertDialog.open('Validace', 'Nadpis i obsah musí být vyplněny.', 'warning');
      return;
    }

    this.saving = true;
    const payload: any = {
      document_type_id: this.activeTab,
      heading: this.newHeading,
      content: this.newContent,
      position: this.addForPosition ?? (this.data.length + 1),
      lang: this.activeLang,
    };

    this.postData(payload as DocumentSection).subscribe({
      next: () => {
        this.cancelAdd();
        this.saving = false;
        this.refreshData();
        this.alertDialog.open('Úspěch', 'Sekce byla úspěšně přidána.', 'success');
      },
      error: () => {
        this.saving = false;
        this.alertDialog.open('Chyba', 'Nepodařilo se přidat sekci.', 'danger');
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Prompts the user for confirmation before performing a hard delete of a content section.
   * @param item The target record for deletion.
   */
  async confirmDelete(item: DocumentSection): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      'Smazat sekci',
      `Opravdu chcete smazat sekci „${item.heading}" (${this.activeLang.toUpperCase()})? Tato akce je nevratná.`
    );

    if (confirmed) {
      this.deleteData(item.id).subscribe({
        next: () => {
          this.refreshData();
          this.alertDialog.open('Úspěch', 'Sekce byla smazána.', 'success');
        },
        error: () => {
          this.alertDialog.open('Chyba', 'Nepodařilo se smazat sekci.', 'danger');
        }
      });
    }
  }

  get tabLabel(): string {
    return this.activeTab === 1 ? 'GDPR' : 'Obchodní podmínky';
  }

  trackById(_: number, item: DocumentSection): number {
    return item.id;
  }
}