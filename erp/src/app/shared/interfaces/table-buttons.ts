/**
 * @file table-buttons.ts
 * @path src/app/admin/shared/interfaces/table-buttons.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Defines the shape of a single row-level action button rendered by
 * TableBuilderComponent / TrashTableBuilderComponent (e.g. Edit, Delete, Details).
 */
import { IconName } from '../components/icon/icon.component'; // adjust path to your icon.component.ts

export interface TableButtons {
  display_name: string;
  header_name: string;
  isActive: boolean;
  action: string;
  type: string;
  /**
   * SVG icon rendered instead of `display_name` inside the row action <button>
   * (see IconComponent). `display_name` is kept as the required fallback / aria
   * text for buttons that haven't been migrated yet — once `icon` is set it takes
   * rendering priority, see table-builder.component.html / trash-table-builder...html.
   */
  icon?: IconName;
  permission?: string;
  visibleWhen?: (item: any) => boolean;
}