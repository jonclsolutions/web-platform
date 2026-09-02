/**
 * @file details-builder.component.ts
 * @path src/app/admin/components/builders/details-builder/details-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A dynamic detail viewer component that generates structured layouts from data objects and column definitions.
 * @dependencies
 * - CommonModule, DatePipe, CurrencyPipe: Formatting utilities.
 * - ItemDetailsColumns: Interface for column metadata.
 * - InputDefinition: Interface for field configuration and options.
 * - ScrollLockService: Sdílený zámek scrollu na pozadí (viz refactor-note 2026-08-31).
 *
 * @refactor-note (2026-08) Přidán typ `'files'` (množné číslo) - zobrazuje seznam VÍCE
 * příloh (z `web_attachments` relace, pole objektů `{id, original_filename, mime_type,
 * size_bytes, url, download_url, view_url, created_at}`) místo jediného souboru, jak to
 * řešil dosavadní `'file'` case. `formatFileSize()` přidán jako pomocná metoda pro
 * čitelný výpis velikosti.
 *
 * @refactor-note (2026-08-31) BACKLOG "privátní úložiště citlivých příloh": `downloadFile()`
 * a `getViewUrl()` dřív RUČNĚ skládaly URL z `file.url` (přímý storage odkaz) přes
 * starý vzor `/download-file/{folder}/{file}` / `/view-file/{folder}/{file}`
 * (`PublicFileDownloadController`, dva route parametry) - ten vzor už NEEXISTUJE (viz
 * `AttachmentDownloadController`, `routes/api.php`, jeden wildcard `{path}` +
 * `signed` middleware). `WebAttachmentResource` teď navíc VŽDY posílá HOTOVÉ,
 * krátkodobě podepsané (10 min TTL) `download_url`/`view_url` pro každou přílohu -
 * šablona (viz `@case ('files')`) je používá PŘÍMO, žádné skládání na frontendu není
 * potřeba ani žádoucí (frontend nezná/nemá znát interní route strukturu ani podpis).
 * `downloadFile()` proto zjednodušen na prosté `window.location.href = downloadUrl`
 * (vstup je už hotová `download_url`, ne syrový storage `url`). `getViewUrl()` zůstává
 * jako tenký passthrough kvůli zpětné kompatibilitě `@case ('file')` (legacy sloupce
 * nesoucí přímý URL string, ne objekt přílohy) - u zdrojů na `private` disku ale
 * fungovat NEBUDE (žádný symlink, žádná signed URL), dokud takový sloupec
 * nepřejde na typ `'files'` s reálnou `web_attachments` vazbou.
 */

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ItemDetailsColumns } from '../../../../shared/interfaces/item-details-columns';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';

/**
 * @description Provides a reusable way to display object details in a modal overlay with automatic formatting based on column metadata.
 * @usage Used in admin list components to show expanded information for a selected record.
 * @note Manages DOM overflow state to ensure the modal occupies the screen correctly and uses pipes for data localization.
 */
@Component({
selector: 'app-details-builder',
standalone: true,
imports: [CommonModule],
templateUrl: './details-builder.component.html',
styleUrl: './details-builder.component.css',
providers: [DatePipe, CurrencyPipe]
})
export class DetailsBuilderComponent implements OnInit, OnDestroy {
  @Input() itemData: any;
  @Input() itemDetailColumns: ItemDetailsColumns[] = [];
  @Input() inputDefinitions: InputDefinition[] = [];
  @Output() closeDetails = new EventEmitter<void>();

  private scrollLock = inject(ScrollLockService);

  constructor(
private datePipe: DatePipe,
private currencyPipe: CurrencyPipe
  ) {}

/**
   * @description Locks page scrolling while the detail modal is active.
   */
ngOnInit(): void {
    this.scrollLock.lock();
  }

/**
   * @description Restores page scrolling upon component destruction.
   */
ngOnDestroy(): void {
    this.scrollLock.unlock();
  }

onClose(): void {
this.closeDetails.emit();
  }

onOverlayClick(event: MouseEvent): void {
if (event.target === event.currentTarget) {
this.onClose();
    }
  }

/**
   * @description Attempts to parse a JSON-formatted string into an object.
   * @param val Input value to check.
   * @returns The parsed object if successful, or the original value.
   */
getJsonValue(val: any): any {
if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
try {
return JSON.parse(val);
      } catch (e) {
return val;
      }
    }
return val;
  }

/**
   * @description Determines if a value should be rendered as a JSON block.
   * @param val Input value to validate.
   * @returns {boolean} True if the value is an object or a parsable JSON string.
   */
isObject(val: any): boolean {
if (val === null || val === undefined) return false;
if (typeof val === 'object' && !(val instanceof Date)) return true;
if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) return true;
return false;
  }

/**
   * @description Extracts a filename from a given storage URL.
   */
getFileName(url: string): string {
if (!url) return 'file';
const parts = url.split('/');
return parts[parts.length - 1].split('?')[0] || 'file';
  }

/**
   * @description Formats a byte count into a human-readable KB/MB string.
   */
formatFileSize(bytes: number): string {
if (!bytes && bytes !== 0) return '';
if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /**
   * @description Spustí stažení souboru přesměrováním na už hotovou, backendem
   * vygenerovanou `download_url` (podepsaná, viz refactor-note v hlavičce souboru).
   * @param downloadUrl Hotová `download_url` z WebAttachmentResource.
   */
downloadFile(downloadUrl: string): void {
    if (!downloadUrl) return;
    window.location.href = downloadUrl;
  }

  /**
   * @description Tenký passthrough pro zpětnou kompatibilitu `@case ('file')` (legacy
   * sloupce s přímým URL stringem) - viz refactor-note v hlavičce souboru. Pro
   * `@case ('files')` (reálné přílohy) šablona používá `file.view_url` PŘÍMO, tahle
   * metoda se pro ně nevolá.
   * @param fullUrl Syrová hodnota sloupce (typicky `itemData[column.key]`).
   */
  getViewUrl(fullUrl: string): string {
    return fullUrl || '';
  }

/**
   * @description Transforms raw data into a human-readable format based on column type definitions.
   * @param obj The source data object.
   * @param path The dot-notation string path to the property.
   * @param columnDef The configuration for the column being processed.
   * @returns The formatted string or value.
   */
getFormattedValue(obj: any, path: string, columnDef: ItemDetailsColumns): any {
const value = this.getValueByPath(obj, path);
if (value === null || value === undefined || value === '') return null;

switch (columnDef.type) {
case 'currency':
return this.currencyPipe.transform(value, 'CZK', 'symbol-narrow', '1.0-0', 'cs-CZ');
case 'date':
const date = new Date(value);
return isNaN(date.getTime()) ? value : this.datePipe.transform(date, columnDef.format || 'dd.MM.yyyy HH:mm', 'cs-CZ');
case 'boolean':
return (value == true || value == 1) ? 'Yes' : 'No';
default:
const fieldDef = this.inputDefinitions.find(i => i.column_name === columnDef.key);
if (fieldDef?.options) {
const option = fieldDef.options.find(opt => String(opt.value) === String(value));
return option ? option.label : value;
        }
return value;
    }
  }

/**
   * @description Resolves a value from a nested object using a dot-notation path.
   * @param obj The source object.
   * @param path String like 'user.profile.name'.
   * @returns The resolved value.
   */
getValueByPath(obj: any, path: string): any {
if (!obj || !path) return '';
const keys = path.split('.');
let current = obj;
for (const key of keys) {
if (current === null || current === undefined) return '';
current = current[key];
    }
return current;
  }
}