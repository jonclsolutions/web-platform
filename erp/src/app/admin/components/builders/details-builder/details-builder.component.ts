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
 * - ScrollLockService: Shared background scroll lock.
 * - AdminLocalizationService: Static (bundled) localization of the admin UI.
 * - UserAvatarComponent: `avatar` columns (profile photo).
 */

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ItemDetailsColumns } from '../../../../shared/interfaces/item-details-columns';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { UserAvatarComponent } from '../../user-avatar/user-avatar.component';

/**
 * @description Provides a reusable way to display object details in a modal overlay with automatic formatting based on column metadata.
 * @usage Used in admin list components to show expanded information for a selected record.
 * @note Manages DOM overflow state to ensure the modal occupies the screen correctly and uses pipes for data localization.
 */
@Component({
selector: 'app-details-builder',
standalone: true,
imports: [CommonModule, UserAvatarComponent],
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