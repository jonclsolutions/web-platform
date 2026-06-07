import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import * as Core from '../../../../shared/imports/core-providers';
import { ColumnDefinition } from '../../../../shared/interfaces/generic-form-column-definiton';
import { BaseDataComponent } from '../../base-data/base-data.component';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';

@Component({
  selector: 'app-table-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './table-builder.component.html',
  styleUrls: ['../table-style.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableBuilderComponent extends BaseDataComponent<any> implements Core.OnInit, Core.OnChanges {
  @Input() override data: any[] = [];
  @Input('columns') columnDefinitions: ColumnDefinition[] = [];
  @Input() inputDefinitions: InputDefinition[] = [];
  @Input() tableCaption?: string;
  @Input() override apiEndpoint: string = '';
  @Input() uploadsBaseUrl: string = '';
  @Input() buttons: TableButtons[] = [];
  @Input() isAdminTable: boolean = false;
  @Input() isFullWidth: boolean = true;
  @Input() currentFilters: any = {};

  @Output() itemDeleted = new EventEmitter<any>();
  @Output() createFormOpened = new EventEmitter<void>();
  @Output() editFormOpened = new EventEmitter<any>();
  @Output() viewDetailsOpened = new EventEmitter<any>();
  @Output() generateFormOpened = new EventEmitter<any>();
  @Output() resetPasswordFormOpened = new EventEmitter<any>(); 
  @Output() openImagesModal = new EventEmitter<any>(); 
  @Output() openVariantsModal = new EventEmitter<any>(); 

  web_logs_endpoint: string = 'web/logs';
  
  // Flag k prevenci double-click a souběžných operací
  private processingItemIds = new Set<any>();

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private confirmDialogService: ConfirmDialogService,
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void { 
    super.ngOnInit(); 
  }

  override ngOnChanges(changes: Core.SimpleChanges): void { 
    super.ngOnChanges(changes); 
  }

getCellValue(item: any, column: ColumnDefinition): any {
    const keys = column.key.split('.');
    const value = keys.reduce((obj, key) => obj?.[key], item);
    
    switch (column.type) {
      case 'currency': {
        if (value === undefined || value === null || value === '') return '';
        
        // 🌟 Získání kódu měny z konfigurace sloupce, výchozí je CZK
        const currency = column.currencyCode ? column.currencyCode.toUpperCase() : 'CZK';
        
        // 🌟 Volba lokalizace podle měny, aby symboly a mezery vypadaly přirozeně
        // de-DE formátuje EUR správně se symbolem na konci a mezerou (např. 50,00 €)
        const locale = currency === 'CZK' ? 'cs-CZ' : 'de-DE';

        try {
          return (new CurrencyPipe(locale)).transform(value, currency, 'symbol-narrow', '1.2-2');
        } catch (e) {
          // Záložní zobrazení, pokud by selhal CurrencyPipe (neznámá měna nebo chybějící lokalizace)
          return `${value} ${currency}`;
        }
      }
      
      case 'date':
        return value ? (new DatePipe('cs-CZ')).transform(value, column.format || 'd.M.yyyy') : '';
      case 'boolean':
        return (value == true || value === 'true' || value == 1) ? 'Ano' : 'Ne';
      case 'image':
        return value ? `${this.uploadsBaseUrl}${value}` : '';
      default:
        const fieldDef = this.inputDefinitions.find(i => i.column_name === column.key);
        if (fieldDef?.options) {
          const option = fieldDef.options.find(opt => String(opt.value) === String(value));
          return option ? option.label : value;
        }
        return value;
    }
  }

  handleAction(item: any, buttonAction: string): void {
    // ⚠️ DOUBLE-CLICK PREVENTION: Kontrola, jestli je položka již zpracovávána
    if (this.processingItemIds.has(item.id)) {
      console.warn(`⚠️ Akce pro položku ID ${item.id} je již zpracovávána. Ignoruji duplikát.`);
      return;
    }

    // ⚠️ Označíme položku jako zpracovávanou
    this.processingItemIds.add(item.id);

    // ⚠️ Async wrapper pro oddělení event loopu
    setTimeout(() => {
      try {
        // === INLINE SWITCH - ŽÁDNÁ NOVÁ METODA ===
        switch (buttonAction) {
          case 'generate_form': 
            this.generateFormOpened.emit(item); 
            break;
          case 'details': 
            this.viewDetailsOpened.emit(item); 
            break;
          case 'edit': 
            this.editFormOpened.emit(item); 
            break;
          case 'delete': 
            this.onDeleteAction(item); 
            break;
          case 'password_reset': 
            this.resetPasswordFormOpened.emit(item); 
            break; 
          case 'custom_prod_var': 
            this.openVariantsModal.emit(item); 
            break; 
          case 'custom_prod_img': 
            this.openImagesModal.emit(item); 
            break; 
          default: 
            console.warn('⚠️ Neznámý typ akce:', buttonAction);
        }
        
        // ⚠️ Zajisti update change detection
        this.cd.markForCheck();
      } finally {
        // ⚠️ Cleanup - odstraň položku ze zpracování po určité době
        setTimeout(() => {
          this.processingItemIds.delete(item.id);
        }, 500);
      }
    }, 0);
  }

  public onDeleteAction(item: any): void {
    this.confirmDialogService.open('Potvrzení smazání', 'Opravdu si přejete smazat tuto položku?')
      .then(result => {
        if (result) {
          this.deleteData(item.id).subscribe({
            next: () => {
              this.removeItemFromLocal(item.id);
              this.itemDeleted.emit(item);
              this.alertDialogService.open('Úspěch', 'Položka byla smazána.', 'success');
            },
            error: () => {
              // ⚠️ Cleanup na error
              this.processingItemIds.delete(item.id);
              this.alertDialogService.open('Chyba', 'Smazání se nezdařilo.', 'danger');
            }
          });
        } else {
          // ⚠️ Cleanup pokud uživatel zrušil
          this.processingItemIds.delete(item.id);
        }
      })
      .catch(() => {
        // ⚠️ Cleanup pokud dialog selhal
        this.processingItemIds.delete(item.id);
      });
  }

  private removeItemFromLocal(id: any): void {
    const index = this.data.findIndex(d => d.id === id);
    if (index > -1) {
      this.data.splice(index, 1);
      this.cd.markForCheck();
    }
  }

  async exportToCSV() {
    try {
      this.cd.markForCheck();
      const responseData = await firstValueFrom(this.loadDataAsCollection());
      const allData: any[] = Array.isArray(responseData) ? responseData : [];
      if (allData.length > 0) {
        let csv = this.columnDefinitions.map(col => col.header || col.key).join(';') + '\n';
        allData.forEach(item => {
          csv += this.columnDefinitions.map(col => `"${String(this.getCellValue(item, col) || '').replace(/"/g, '""')}"`).join(';') + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${this.tableCaption || 'export'}.csv`;
        link.click();
        this.logExportActivity(allData.length);
      } else {
        this.alertDialogService.open('Export', 'Žádná data k exportu.', 'warning');
      }
    } catch (error) {
      console.error('Export error:', error);
      this.alertDialogService.open('Chyba', 'Při exportu nastala chyba.', 'danger');
    } finally {
      this.cd.markForCheck();
    }
  }

  private logExportActivity(rowCount: number): void {
    const logData = {
      event_type: 'DATA_EXPORT',
      module: this.apiEndpoint,
      description: `Uživatel exportoval ${rowCount} záznamů z tabulky: ${this.tableCaption || this.apiEndpoint}.`,
      affected_entity_type: 'collection',
      user_id_plain: this.authService.getUserId()?.toString(),
      user_plain: this.authService.getUserEmail()
    };
    this.dataHandler.post(this.web_logs_endpoint, logData).subscribe({
      error: (err) => console.error('Nepodařilo se zalogovat export:', err)
    });
  }

  private loadDataAsCollection() {
    const params = { ...this.currentFilters, no_pagination: 'true' };
    if (!params.sort_by) params.sort_by = 'id';
    if (!params.sort_direction) params.sort_direction = 'desc';
    return this.dataHandler.getCollection<any>(this.apiEndpoint, params);
  }

  get colspanValue(): number {
    return this.columnDefinitions.length + (this.buttons?.filter(b => b.isActive).length || 0);
  }
}