/**
 * @file administrators.component.ts
 * @path src/app/admin/web-pages/administrators/administrators.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages administrative user accounts, including CRUD operations, password resets, and audit trail viewing.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for API interactions, pagination, and state management.
 * - TableBuilderComponent: Used for rendering the administrators data grid.
 * - SHARED_UI_BUILDERS: Centralized collection of UI components for the dashboard.
 * @bugfix-note (2026) `role_id` select options bývaly natvrdo `[{sysadmin},{admin}]`
 *       v administrators.config.ts. Teď, když jsou role spravovány dynamicky
 *       (viz /admin/edit-roles - vytváření/mazání custom rolí), by nově vytvořené
 *       role nešlo přes tenhle formulář vůbec nikomu přiřadit.
 *       Options pro `role_id` (ve formuláři i ve filtru) se proto teď načítají
 *       dynamicky z `core/roles` při inicializaci komponenty - viz loadRoleOptions().
 */

import { Component, ViewChild, ChangeDetectionStrategy, OnInit } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './administrators.config';

/** Tvar jedné položky v roles-endpointu, jen pole, která tu skutečně potřebujeme. */
interface RoleOptionSource {
  id: number;
  role_name: string;
}

/**
 * @description Component for the administration of platform administrators.
 * @usage Provides secure management of user roles, account credentials, and system access.
 * @note Extends BaseDataComponent to handle standard entity lifecycles while adding specific password reset functionality.
 */
@Component({
  selector: 'app-administrators',
  standalone: true,
  imports: [SHARED_UI_BUILDERS],
  templateUrl: './administrators.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdministratorsComponent extends BaseDataComponent<any> implements OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'core/users';

  buttons = Config.TABLE_BUTTONS;
  formFields = Config.FORM_FIELDS;
  tableColumns = Config.TABLE_COLUMNS;
  trashTableColumns = Config.TRASH_TABLE_COLUMNS;
  filterColumns = Config.FILTER_COLUMNS;
  detailsColumns = Config.DETAILS_COLUMNS;
  resetPasswordFormFields = Config.RESET_PASSWORD_FORM_FIELDS;

  showResetPasswordForm: boolean = false;
  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;
  resetPasswordTitle: string = 'Resetovat heslo';
  filters: Core.FilterParams = { sort_by: 'id', sort_direction: 'desc' };

  /** Aktuální role načtené z API, ve tvaru pro select input (viz loadRoleOptions()). */
  roleOptions: { value: string; label: string }[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

  /**
   * @description Constructs the toolbar configuration.
   * @returns List of buttons updated based on user permissions, current view state, and UI toggle logic.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.TOOLBAR_BUTTONS.map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? 'Skrýt' : 'Filtry';
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
          // Hide actions when browsing the trash bin
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? 'Aktivní' : 'Smazané';
          break;
      }

      return updatedBtn;
    });
  }

  /**
   * @description Maps toolbar actions to component methods.
   * @param action The action string defined in the config.
   */
  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      exportActiveTable: () => this.exportActiveTable(),
      toggleTable: () => this.toggleTable()
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
    this.loadRoleOptions();
  }

  /**
   * @description Načte aktuální seznam rolí z API a doplní jím `options` u pole `role_id`
   *              ve formuláři i ve filtru. Bez tohoto by šlo uživatelům přiřazovat jen
   *              natvrdo zadrátované role (sysadmin/admin), ne nově vytvořené custom role
   * @note Endpoint vrací jen netrashnuté role (Eloquent SoftDeletes je defaultně vylučuje),
   *       takže smazané role se v nabídce logicky neobjeví.
   */
  private loadRoleOptions(): void {
    this.dataHandler.getCollection<RoleOptionSource>('core/roles?no_pagination=true').subscribe({
      next: (roles) => {
        this.roleOptions = (roles || [])
          .filter((r): r is RoleOptionSource => !!r)
          .map(r => ({ value: String(r.id), label: r.role_name }));

        // Nové pole objektů (ne mutace sdíleného Config exportu), ať se nic
        // neděje ostatním instancím/importům, které by na Config.FORM_FIELDS
        // odkazovaly jinde.
        this.formFields = this.formFields.map(field =>
          field.column_name === 'role_id' ? { ...field, options: this.roleOptions } : field
        );

        this.filterColumns = this.filterColumns.map(col =>
          col.key === 'role_id' ? { ...col, options: this.roleOptions.map(o => o.label) } : col
        );

        this.cd.markForCheck();
      },
      error: () => {
        this.alertDialogService.open(
          'Chyba',
          'Nepodařilo se načíst aktuální seznam rolí pro formulář. Zkuste prosím stránku obnovit.',
          'danger'
        );
      }
    });
  }

  override refreshData(): void { this.forceFullRefresh(this.filters); }
  
  handlePageChange(page: number): void { this.onHandlePageChange(page, this.filters); }
  
  handleItemsPerPageChange(value: number): void { this.onHandleItemsPerPageChange(value, this.filters); }
  
  /**
   * @description Applies filters and resets pagination to the first page.
   * @param newFilters The incoming filter criteria.
   */
  applyFilters(newFilters: any): void { this.filters = { ...newFilters }; this.refreshData(); }
  
  /**
   * @description Resets filter state to default sorting criteria.
   */
  clearFilters(): void { this.filters = { sort_by: 'id', sort_direction: 'desc' }; this.refreshData(); }
  
  exportActiveTable(): void { if (this.activeTable) this.activeTable.exportToCSV(); }

  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = true;
  }
  
  /**
   * @description Prepares item for editing, specifically normalizing the role ID for the form.
   * @param item The user record to be updated.
   */
  handleEditFormOpened(item: any): void {
    const itemToEdit = { ...item };
    if (itemToEdit.roles?.length > 0) itemToEdit.role_id = itemToEdit.roles[0].id;
    this.selectedItemForEdit = itemToEdit;
    this.showCreateForm = true;
  }

  /**
   * @description Submits user data and handles the distinction between update and creation requests.
   * @param formData The form data payload.
   */
  handleFormSubmitted(formData: any): void {
    const payload = { ...formData };
    if (payload.role_id) payload.role_id = parseInt(payload.role_id, 10);
    const request$ = payload.id ? this.updateData(payload.id, payload) : this.postData(payload);
    request$.pipe(Core.finalize(() => { this.showCreateForm = false; this.cd.markForCheck(); }))
      .subscribe({ next: () => this.refreshData() });
  }

  /**
   * @description Opens the password reset modal for a specific administrator.
   * @param item The user data for the target account.
   */
  handleResetPasswordFormOpened(item: any): void {
    this.resetPasswordTitle = `Resetovat heslo: ${item.user_email}`;
    this.selectedItemForEdit = { id: item.id, old_password: '', new_password: '' };
    this.showResetPasswordForm = true;
    this.cd.markForCheck();
  }

  /**
 * @description Performs the password change request against the user endpoint.
 * @note `formData.new_password` je teď garantovaně shodné s tím, co admin zadal do
 * potvrzovacího pole - `RESET_PASSWORD_FORM_FIELDS` používá `confirm-password` typ
 * (viz administrators.config.ts), takže FormBuilderComponent odeslání zablokuje
 * (`hasPasswordMismatch`), dokud se obě hodnoty neshodují. `new_password_confirmation`
 * proto můžeme bezpečně syntetizovat stejnou hodnotou pro backend `confirmed` pravidlo.
 * @param formData Password change credentials.
 */
handleResetPasswordFormSubmitted(formData: any): void {
  const payload = { 
      old_password: formData.old_password, 
      new_password: formData.new_password, 
      new_password_confirmation: formData.new_password 
  };
  this.dataHandler.put(`core/users/${formData.id}/change-password`, payload)
    .pipe(Core.finalize(() => { this.showResetPasswordForm = false; this.cd.markForCheck(); }))
    .subscribe({
      next: () => this.alertDialogService.open('Úspěch', 'Heslo bylo změněno.', 'success'),
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Akce selhala.', 'danger')
    });
}

  /**
   * @description Loads full entity details for inspection.
   * @param item The selected user record.
   */
  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe(details => {
      this.selectedItemForDetails = details;
      this.showDetails = true;
      this.cd.markForCheck();
    });
  }

  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }
}