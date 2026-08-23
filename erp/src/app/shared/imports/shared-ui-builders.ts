import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TableBuilderComponent } from '../../admin/components/builders/table-builder/table-builder.component';
import { TrashTableBuilderComponent } from '../../admin/components/builders/trash-table-builder/trash-table-builder.component';
import { FormBuilderComponent } from '../../admin/components/builders/form-builder/form-builder.component';
import { FilterFormBuilderComponent } from '../../admin/components/builders/filter-form-builder/filter-form-builder.component';
import { DetailsBuilderComponent } from '../../admin/components/builders/details-builder/details-builder.component';
import { PaginationButtonsBuilderComponent } from '../../admin/components/builders/pagination-buttons-builder/pagination-buttons-builder.component';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { ButtonBuilderComponent } from '../../admin/components/builders/button-builder/button-builder.component';
import { ActionMenuBuilderComponent } from '../../admin/components/builders/action-menu-builder/action-menu-builder.component';
export const SHARED_UI_BUILDERS = [
  CommonModule,
  FormsModule,
  ReactiveFormsModule,
  TableBuilderComponent,
  TrashTableBuilderComponent,
  FormBuilderComponent,
  FilterFormBuilderComponent,
  DetailsBuilderComponent,
  PaginationButtonsBuilderComponent,
  HasPermissionDirective,
  ButtonBuilderComponent,
  ActionMenuBuilderComponent
] as const;