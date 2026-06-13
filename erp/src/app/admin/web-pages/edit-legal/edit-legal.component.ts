import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormsModule } from '@angular/forms';
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
}

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

  // ---- Stav záložek ----
  activeTab: 1 | 2 = 1;

  // ---- Inline edit state ----
  editingIds: Set<number> = new Set();
  editBuffer: Record<number, { heading: string; content: string }> = {};

  // ---- Nová sekce ----
  showAddForm = false;
  newHeading = '';
  newContent = '';
  saving = false;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
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
    this.refreshData();
  }

  override refreshData(): void {
    this.dataHandler.getCollection<DocumentSection>(
      `${this.apiEndpoint}?document_type_id=${this.activeTab}`
    ).subscribe(res => {
      this.data = Array.isArray(res) ? res : (res as any)?.data ?? [];
      this.cd.markForCheck();
    });
  }

  switchTab(tabId: 1 | 2): void {
    if (this.activeTab === tabId) return;
    this.activeTab = tabId;
    this.editingIds.clear();
    this.editBuffer = {};
    this.showAddForm = false;
    this.newHeading = '';
    this.newContent = '';
    this.refreshData();
  }

  // ---- Inline edit ----
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

  saveEdit(item: DocumentSection): void {
    const buf = this.editBuffer[item.id];
    if (!buf || !buf.content?.trim()) {
      this.alertDialog.open('Chyba', 'Obsah sekce nesmí být prázdný.', 'warning');
      return;
    }

    this.saving = true;
    const payload: any = {
      heading: buf.heading,
      content: buf.content,
      document_type_id: item.document_type_id,
      position: item.position,
    };

    this.updateData(item.id, payload as DocumentSection).subscribe({
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

  // ---- Přidání nové sekce ----
  openAddForm(): void {
    this.showAddForm = true;
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
      position: this.data.length + 1,
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

  // ---- Smazání ----
  async confirmDelete(item: DocumentSection): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      'Smazat sekci',
      `Opravdu chcete smazat sekci „${item.heading}“? Tato akce je nevratná.`
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

  // ---- Helpers ----
  get tabLabel(): string {
    return this.activeTab === 1 ? 'GDPR' : 'Obchodní podmínky';
  }

  trackById(_: number, item: DocumentSection): number {
    return item.id;
  }
}