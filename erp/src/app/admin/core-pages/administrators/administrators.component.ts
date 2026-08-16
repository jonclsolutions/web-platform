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
 * - RoleOptionsService: TTL-cached zdroj `core/roles` pro `role_id` select options.
 * - SHARED_UI_BUILDERS: Centralized collection of UI components for the dashboard.
 * @bugfix-note (2026) `role_id` select options bývaly natvrdo `[{sysadmin},{admin}]`
 *       v administrators.config.ts. Teď, když jsou role spravovány dynamicky
 *       (viz /admin/edit-roles - vytváření/mazání custom rolí), by nově vytvořené
 *       role nešlo přes tenhle formulář vůbec nikomu přiřadit.
 *       Options pro `role_id` (ve formuláři i ve filtru) se proto teď načítají
 *       dynamicky z `core/roles` při inicializaci komponenty - viz loadRoleOptions().
 *
 * @refactor-note (2026-08-6) `loadRoleOptions()` přepnut z přímého `dataHandler.
 * getCollection('core/roles?no_pagination=true')` na `RoleOptionsService.getRoles()` -
 * dřív šlo o jediné volání v celé komponentě, které obcházelo GenericTableService TTL
 * cache mechanismus, takže se seznam rolí stahoval znovu při KAŽDÉM vstupu na stránku.
 * RoleOptionsService má vlastní krátkou TTL cache (5 min, sdílenou napříč celou appkou).
 *
 * @refactor-note (2026-08-16) BACKLOG "captcha + 2FA na mail": přidán `toggleForced2fa()`
 * - umožňuje sysadminovi vynutit/zrušit vynucení 2FA u konkrétního uživatele (endpoint
 * `PUT core/users/{id}/two-factor-requirement`, chráněno VÝHRADNĚ backendem přes
 * role_name==='sysadmin' kontrolu v TwoFactorAdminController - frontend `isSysadmin`
 * getter je jen UX skrytí tlačítka, ne bezpečnostní hranice). Tlačítko je umístěno v
 * detail-panelu (`showDetails`), ne v TABLE_BUTTONS, protože TableBuilderComponent má
 * jen whitelistované akce (edit/delete/details/password_reset) s vlastními výstupy.
 */

import { Component, ViewChild, ChangeDetectionStrategy, OnInit } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { RoleOptionsService } from '../../../core/services/role-options.service';
import { AuthService } from '../../../core/auth/auth.service';
import * as Config from './administrators.config';

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

  isSavingForced2fa = false;

constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private roleOptionsService: RoleOptionsService,
    public override authService: AuthService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

  /** @description Jen UX skrytí tlačítka - reálné vynucení kontroluje backend (viz hlavička souboru). */
  get isSysadmin(): boolean {
    return this.authService.getUserRole() === 'sysadmin';
  }

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

  private loadRoleOptions(): void {
    this.roleOptionsService.getRoles().subscribe({
      next: (roles) => {
        this.roleOptions = (roles || [])
          .filter((r): r is { id: number; role_name: string } => !!r)
          .map(r => ({ value: String(r.id), label: r.role_name }));

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

  applyFilters(newFilters: any): void { this.filters = { ...newFilters }; this.refreshData(); }

  clearFilters(): void { this.filters = { sort_by: 'id', sort_direction: 'desc' }; this.refreshData(); }

  exportActiveTable(): void { if (this.activeTable) this.activeTable.exportToCSV(); }

  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = true;
  }

  handleEditFormOpened(item: any): void {
    const itemToEdit = { ...item };
    if (itemToEdit.roles?.length > 0) itemToEdit.role_id = itemToEdit.roles[0].id;
    this.selectedItemForEdit = itemToEdit;
    this.showCreateForm = true;
  }

  handleFormSubmitted(formData: any): void {
    const payload = { ...formData };
    if (payload.role_id) payload.role_id = parseInt(payload.role_id, 10);
    const request$ = payload.id ? this.updateData(payload.id, payload) : this.postData(payload);
    request$.pipe(Core.finalize(() => { this.showCreateForm = false; this.cd.markForCheck(); }))
      .subscribe({ next: () => this.refreshData() });
  }

  handleResetPasswordFormOpened(item: any): void {
    this.resetPasswordTitle = `Resetovat heslo: ${item.user_email}`;
    this.selectedItemForEdit = { id: item.id, old_password: '', new_password: '' };
    this.showResetPasswordForm = true;
    this.cd.markForCheck();
  }

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

  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe(details => {
      this.selectedItemForDetails = details;
      this.showDetails = true;
      this.cd.markForCheck();
    });
  }

  /**
   * @description Přepne 2FA vynucení pro uživatele v aktuálně otevřeném detailu.
   * Jen sysadmin (viz isSysadmin getter + backend TwoFactorAdminController kontrola).
   */
  toggleForced2fa(): void {
    if (!this.isSysadmin || !this.selectedItemForDetails?.id || this.isSavingForced2fa) return;

    const newValue = !this.selectedItemForDetails.two_fa_forced_by_admin;
    this.isSavingForced2fa = true;

    this.dataHandler.put(`core/users/${this.selectedItemForDetails.id}/two-factor-requirement`, { forced: newValue })
      .pipe(Core.finalize(() => { this.isSavingForced2fa = false; this.cd.markForCheck(); }))
      .subscribe({
        next: () => {
          this.selectedItemForDetails = { ...this.selectedItemForDetails, two_fa_forced_by_admin: newValue };
          this.refreshData();
        },
        error: () => this.alertDialogService.open('Chyba', 'Nepodařilo se změnit vyžadování 2FA.', 'danger')
      });
  }

  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }
}