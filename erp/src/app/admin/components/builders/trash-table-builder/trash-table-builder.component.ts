import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Import tvého Core namespace
import * as Core from '../../../../shared/imports/core-providers';

// Specifické importy
import { ColumnDefinition } from '../../../../shared/interfaces/generic-form-column-definiton';
import { BaseDataComponent } from '../../base-data/base-data.component';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';
import { SHARED_UI_BUILDERS } from '../../../../shared/imports/shared-ui-builders';

@Component({
  selector: 'app-trash-table-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SHARED_UI_BUILDERS
  ],
  templateUrl: './trash-table-builder.component.html',
  styleUrls: ['../table-style.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrashTableBuilderComponent extends BaseDataComponent<any> implements Core.OnInit, Core.OnChanges {
  @Input() override data: any[] = [];
  @Input('columns') columnDefinitions: ColumnDefinition[] = [];
  @Input() tableCaption?: string;
  @Input() override apiEndpoint: string = '';
  @Input() uploadsBaseUrl: string = '';
  
  buttons: TableButtons[] = [
    { display_name: '♻️', header_name: "Obnovit", isActive: true, type: 'confirm_button', action: "restore" },
    { display_name: '🧨', header_name: "Trvale smazat", isActive: true, type: 'delete_button', action: "delete" },
  ];

  deleteAllButtonConfig: Core.Button[] = [
    {
      action: 'deleteAll',
      label: 'Smazat vše',
      icon: '🗑️',
      class: 'btn-trash small-btn',
      isActive: false,
      showIf: true
    }
  ];

  public isFullWidth: boolean = true;

  @Output() itemRestored = new EventEmitter<void>();
  @Output() itemDeletedPermanently = new EventEmitter<void>();

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private confirmDialogService: ConfirmDialogService,
  ) {
    super(dataHandler, cd, genericTableService);
  }

  // OPRAVA: parametr je nyní string, protože builder emituje jen název akce
  handleToolbarAction(action: string): void {
    if (action === 'deleteAll') {
      this.deleteAll();
    }
  }

  override ngOnChanges(changes: Core.SimpleChanges): void {
    super.ngOnChanges(changes);
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  getCellValue(item: any, column: ColumnDefinition): any {
    const keys = column.key.split('.');
    const value = keys.reduce((obj, key) => obj?.[key], item);
    
    // 🌟 Používáme přetypování na 'any', aby TS nehlásil chybu u 'array' a 'object'
    switch (column.type as any) {
      case 'currency': {
        if (value === undefined || value === null || value === '') return '';
        
        // 🌟 Dynamické získání kódu měny (např. 'CZK', 'EUR'), výchozí je 'CZK'
        const currency = column.currencyCode ? column.currencyCode.toUpperCase() : 'CZK';
        
        // Formátování: pro CZK české (100 Kč), pro EUR evropské standardy (100 €)
        const locale = currency === 'CZK' ? 'cs-CZ' : 'de-DE';

        try {
          return (new CurrencyPipe(locale)).transform(value, currency, 'symbol-narrow', '1.2-2');
        } catch (e) {
          // Fallback, pokud by se v datech objevila nepodporovaná měna
          return `${value} ${currency}`;
        }
      }
      
      case 'date':
        return value ? (new DatePipe('cs-CZ')).transform(value, column.format || 'shortDate') : '';
      case 'boolean':
        return value ? 'Ano' : 'Ne';
      case 'image':
        return value ? `${this.uploadsBaseUrl}${value}` : '';
      case 'array':
        return Array.isArray(value) ? value.join(', ') : value;
      case 'object':
        return this.isObject(value) ? JSON.stringify(value) : value;
      default:
        return value;
    }
  }

  isObject(value: any): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  
  handleAction(item: any, action: string): void {
    if (!item.id) return;

    switch (action) {
      case 'restore':
        this.confirmDialogService.open('Potvrzení obnovení', 'Opravdu chcete obnovit tuto položku?').then(result => {
          if (result) {
            this.restoreDataFromApi(item.id).subscribe({
              next: () => {
                this.alertDialogService.open('Úspěch', 'Položka byla úspěšně obnovena.', 'success');
                this.removeItemFromLocalData(item.id);
                this.itemRestored.emit();
              },
              error: (err: any) => {
                this.alertDialogService.open('Chyba', 'Při obnovení položky nastala chyba.', 'danger');
              }
            });
          }
        });
        break;

      case 'delete':
        this.confirmDialogService.open('Potvrzení trvalého smazání', 'Opravdu si přejete TRVALE smazat tuto položku? Tato akce je nevratná!').then(result => {
          if (result) {
            this.deleteData(item.id, true).subscribe({
              next: () => {
                this.alertDialogService.open('Úspěch', 'Položka byla trvale smazána.', 'success');
                this.removeItemFromLocalData(item.id);
                this.itemDeletedPermanently.emit();
              },
              error: (err: any) => {
                this.alertDialogService.open('Chyba', 'Při trvalém mazání položky nastala chyba.', 'danger');
              }
            });
          }
        });
        break;
    }
  }

  private removeItemFromLocalData(id: number): void {
    const index = this.data.findIndex(dataItem => dataItem.id === id);
    if (index > -1) {
      this.data.splice(index, 1);
      this.cd.markForCheck();
    }
  }

  deleteAll(): void {
    if (this.data.length === 0) {
      this.alertDialogService.open('Upozornění', 'Nejsou k dispozici žádné položky ke smazání.', 'warning');
      return;
    }
    
    this.confirmDialogService.open('Trvalé smazání všech položek', 'Opravdu si přejete TRVALE smazat VŠECHNY položky? Tato akce je nevratná!')
      .then(result => {
        if (result) {
          this.hardDeleteAllTrashedDataFromApi().subscribe({
            next: () => {
              this.alertDialogService.open('Úspěch', 'Všechny položky byly trvale smazány.', 'success');
              this.data = [];
              this.itemDeletedPermanently.emit();
              this.cd.markForCheck();
            },
            error: (err: any) => {
              this.alertDialogService.open('Chyba', 'Při trvalém mazání položek nastala chyba.', 'danger');
            }
          });
        }
      });
  }

  get colspanValue(): number {
    const activeButtonsCount = this.buttons?.filter(b => b.isActive).length || 0;
    return this.columnDefinitions.length + (activeButtonsCount > 0 ? 1 : 0);
  }
}