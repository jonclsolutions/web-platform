/**
 * @file details-builder.component.ts
 * @path src/app/admin/components/builders/details-builder/details-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description A dynamic detail viewer component that generates structured layouts from data objects and column definitions.
 * @dependencies
 * - CommonModule, DatePipe, CurrencyPipe: Formatting utilities.
 * - ItemDetailsColumns: Interface for column metadata.
 * - InputDefinition: Interface for field configuration and options.
 * - AdminModalComponent: the shared popup frame (page scroll lock, Escape / backdrop / close).
 * - AdminLocalizationService: Static (bundled) localization of the admin UI.
 * - UserAvatarComponent: `avatar` columns (profile photo).
 * - RecordActionsComponent: actions of the record in the footer (detail opened by a table row).
 */

import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ItemDetailsColumns } from '../../../../shared/interfaces/item-details-columns';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { UserAvatarComponent } from '../../user-avatar/user-avatar.component';
import { AdminModalComponent } from '../../admin-modal/admin-modal.component';
import { RecordActionsComponent } from '../../record-actions/record-actions.component';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';

/**
 * @description Provides a reusable way to display object details in a modal overlay with automatic formatting based on column metadata.
 * @usage Used in admin list components to show expanded information for a selected record.
 * @note Uses pipes for data localization; the frame (AdminModalComponent) locks the page scroll.
 */
@Component({
selector: 'app-details-builder',
standalone: true,
imports: [CommonModule, UserAvatarComponent, AdminModalComponent, RecordActionsComponent],
templateUrl: './details-builder.component.html',
styleUrls: ['../../../shared-styles/modal.css', './details-builder.component.css'],
providers: [DatePipe, CurrencyPipe]
})
export class DetailsBuilderComponent {
  @Input() itemData: any;
  @Input() itemDetailColumns: ItemDetailsColumns[] = [];
  @Input() inputDefinitions: InputDefinition[] = [];
  @Output() closeDetails = new EventEmitter<void>();
  /** Only the values, without the popup frame - inside another popup (the record popup). */
  @Input() embedded = false;
  /** Embedded as a short block of read-only values (several per row) above a form. */
  @Input() compact = false;
  /**
   * Actions of the record on the left of the footer (the detail opened by a click on a table row
   * when the user may not edit it - e.g. Delete with the delete permission).
   */
  @Input() recordActions: TableButtons[] = [];
  /** An action of the record was clicked - carries its `action`. */
  @Output() recordAction = new EventEmitter<string>();

  public readonly i18n = inject(AdminLocalizationService);

  constructor(
private datePipe: DatePipe,
private currencyPipe: CurrencyPipe
  ) {}

  /**
   * @description Merged `shared` + `details-builder` i18n section.
   * @note Type `any` on purpose - see `AdminLocalizationService.getMergedSection()`.
   */
  public get strings(): any {
    return this.i18n.getMergedSection('details-builder');
  }

/**
   * @description Closes the detail (footer button, close button, Escape, backdrop).
   */
onClose(): void {
this.closeDetails.emit();
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
   * @description Formats a byte count into a human-readable KB/MB string.
   */
formatFileSize(bytes: number): string {
if (!bytes && bytes !== 0) return '';
if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /**
   * @description Starts a file download by navigating to the ready `download_url` generated
   * (signed) by the backend.
   * @param downloadUrl Ready `download_url` from WebAttachmentResource.
   */
downloadFile(downloadUrl: string): void {
    if (!downloadUrl) return;
    window.location.href = downloadUrl;
  }

  /**
   * @description Thin passthrough for backward compatibility of `@case ('file')` (legacy
   * columns with a plain URL string). For `@case ('files')` (real attachments) the template
   * uses `file.view_url` DIRECTLY, this method is not called for them.
   * @param fullUrl Raw value of the column (typically `itemData[column.key]`).
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
return (value == true || value == 1) ? this.i18n.getValue('shared.yes') : this.i18n.getValue('shared.no');
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