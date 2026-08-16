/**
 * @file administrators.component.ts
 * @path src/app/admin/core-pages/administrators/administrators.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages administrative user accounts, including CRUD operations, password resets, and audit trail viewing.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for API interactions, pagination, and state management.
 * - TableBuilderComponent: Used for rendering the administrators data grid.
 * - RoleOptionsService: TTL-cached zdroj `core/roles` pro `role_id` select options.
 * - SHARED_UI_BUILDERS: Centralized collection of UI components for the dashboard.
 *
 * @refactor-note (2026-08-6) `loadRoleOptions()` přes `RoleOptionsService` (TTL cache).
 *
 * @refactor-note (2026-08-16) BACKLOG "captcha + 2FA na mail", body 2+3+4:
 * - `visibleFormFields` je NOVÁ property bindovaná do šablony (`[inputDefinitions]`)
 *   místo přímo `formFields` - počítá se dynamicky při KAŽDÉM otevření formuláře
 *   (`handleCreateFormOpened`/`handleEditFormOpened`) podle role editovaného účtu:
 *   `enable_2fa` je disabled+checked, pokud je role vynucená (admin/sysadmin nebo
 *   `forces_2fa=true`); `two_fa_forced_by_admin` je z formuláře úplně ODEBRÁNO, pokud
 *   (a) přihlášený actor NENÍ sysadmin, nebo (b) role je už vynucená jinak (override by
 *   byl bezpředmětný). `formFields` (baseline se stavem `role_id` options) se nemění a
 *   slouží jen jako zdroj pro odvození `visibleFormFields` - díky tomu loadRoleOptions()
 *   nemusí nic vědět o 2FA logice.
 * - Toto je jen UX předvyplnění/optimistický náhled - SKUTEČNÉ vynucení dělá backend
 *   (UserController::update()), který při rozporu vrací 422. Proto `handleFormSubmitted`
 *   teď MÁ error handler (dřív chyběl úplně) - dřív FormBuilderComponent ukázal zelený
 *   "success" toast HNED po emitu, ještě před odpovědí serveru, takže i selhání na
 *   backendu vypadalo jako úspěch. Teď se po chybě zobrazí navazující červený toast se
 *   skutečnou zprávou z backendu.
 * - `loadRolesForces2fa()` načítá `core/roles?no_pagination=true` PŘÍMO (ne přes
 *   RoleOptionsService, který v době psaní nebyl k dispozici pro kontrolu, zda vrací
 *   `forces_2fa`) - staví si vlastní mapu roleId -> {role_name, forces_2fa}.
 */

import { Component, ViewChild, ChangeDetectionStrategy, OnInit } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { RoleOptionsService } from '../../../core/services/role-options.service';
import { InputDefinition } from '../../../shared/interfaces/input-definiton';
import * as Config from './administrators.config';

/** Role s napevno vynuceným 2FA - musí sedět s backend User::FORCED_2FA_ROLE_NAMES. */
const HARDCODED_FORCED_ROLE_NAMES = ['admin', 'sysadmin'];

interface RoleMeta {
  role_name: string;
  forces_2fa: boolean;
}

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
  /** Baseline definice (role_id options se sem promítají z loadRoleOptions()). */
  formFields = Config.FORM_FIELDS;
  /** Co se REÁLNĚ vykresluje ve formuláři - viz computeFieldsForTarget(). */
  visibleFormFields: InputDefinition[] = Config.FORM_FIELDS;

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

  roleOptions: { value: string; label: string }[] = [];

  /** Mapa role_id -> {role_name, forces_2fa}, pro dynamické disable/hide 2FA polí. */
  private rolesMeta = new Map<number, RoleMeta>();

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private roleOptionsService: RoleOptionsService,
    public override authService: Core.AuthService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

  /** @description Jen UX - reálné oprávnění vynucuje backend (UserController). */
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
    this.loadRolesForces2fa();
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
        this.visibleFormFields = this.formFields;

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

  /**
   * @description Načte 2FA-relevantní metadata rolí (role_name + forces_2fa) přímo,
   * nezávisle na RoleOptionsService cache (viz refactor-note v hlavičce souboru).
   */
  private loadRolesForces2fa(): void {
    this.dataHandler.get<any[]>('core/roles?no_pagination=true').subscribe({
      next: (roles) => {
        this.rolesMeta.clear();
        (roles || []).forEach((r: any) => {
          if (r?.id !== undefined) {
            this.rolesMeta.set(Number(r.id), {
              role_name: r.role_name,
              forces_2fa: !!r.forces_2fa,
            });
          }
        });
      },
      error: () => {
        // Neblokující - v nejhorším případě jen frontend nebude předem disablovat
        // políčka (backend 422 kontrolu má nezávisle na tomhle).
      }
    });
  }

  /** @description Jestli daná role (podle id) vynucuje 2FA - hardcoded role nebo forces_2fa. */
  private isRoleForced(roleId: number | string | undefined | null): boolean {
    if (roleId === undefined || roleId === null || roleId === '') return false;
    const meta = this.rolesMeta.get(Number(roleId));
    if (!meta) return false;
    return HARDCODED_FORCED_ROLE_NAMES.includes(meta.role_name) || meta.forces_2fa;
  }

  /**
   * @description Odvodí, jaké 2FA pole se má ve formuláři reálně zobrazit/disablovat
   * pro danou cílovou roli - viz refactor-note v hlavičce souboru. `roleId` je `null`
   * u nové (dosud nevybrané) role při vytváření účtu.
   */
private computeFieldsForTarget(
  roleId: number | string | undefined | null,
  adminForced: boolean = false
): InputDefinition[] {
  const forced = this.isRoleForced(roleId) || adminForced;

  let fields = this.formFields.map(f => {
    if (f.column_name === 'enable_2fa' && forced) {
      return { ...f, editable: false };
    }
    return f;
  });

  const showOverrideField = this.isSysadmin && !this.isRoleForced(roleId);
  if (!showOverrideField) {
    fields = fields.filter(f => f.column_name !== 'two_fa_forced_by_admin');
  }

  return fields;
}

  override refreshData(): void { this.forceFullRefresh(this.filters); }

  handlePageChange(page: number): void { this.onHandlePageChange(page, this.filters); }

  handleItemsPerPageChange(value: number): void { this.onHandleItemsPerPageChange(value, this.filters); }

  applyFilters(newFilters: any): void { this.filters = { ...newFilters }; this.refreshData(); }

  clearFilters(): void { this.filters = { sort_by: 'id', sort_direction: 'desc' }; this.refreshData(); }

  exportActiveTable(): void { if (this.activeTable) this.activeTable.exportToCSV(); }

  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    // Při vytváření zatím žádná role není vybraná - forced=false, override pole se
    // stejně nezobrazí (show_in_create: false v configu), enable_2fa je editovatelné.
    // Skutečné vynucení podle zvolené role v běhu formuláře řeší backend 422 při submitu.
    this.visibleFormFields = this.computeFieldsForTarget(null);
    this.showCreateForm = true;
  }

handleEditFormOpened(item: any): void {
  const itemToEdit = { ...item };
  if (itemToEdit.roles?.length > 0) itemToEdit.role_id = itemToEdit.roles[0].id;

  const forced = this.isRoleForced(itemToEdit.role_id) || !!itemToEdit.two_fa_forced_by_admin;
  if (forced) {
    itemToEdit.enable_2fa = true;
  }

  this.visibleFormFields = this.computeFieldsForTarget(itemToEdit.role_id, !!itemToEdit.two_fa_forced_by_admin);
  this.selectedItemForEdit = itemToEdit;
  this.showCreateForm = true;
}

  /**
   * @description Submits user data. Error handler DOPLNĚN (dřív chyběl) - viz
   * refactor-note v hlavičce souboru: FormBuilderComponent ukazuje zelený toast hned po
   * emitu, ještě před odpovědí serveru, takže reálná chyba backendu (např. 422 při
   * pokusu vypnout vynucenou 2FA) se bez tohoto handleru vůbec neprojevila v UI.
   */
handleFormSubmitted(formData: any): void {
  const payload = { ...formData };
  if (payload.role_id) payload.role_id = parseInt(payload.role_id, 10);

  // Needitovatelná pole se nesmí odesílat - i kdyby formData obsahovalo
  // předvyplněnou vizuální hodnotu (viz handleEditFormOpened), odeslání by ji
  // tiše zapsalo do DB při JAKÉKOLIV nesouvisející editaci. Backend při chybějícím
  // klíči použije stávající hodnotu ($validated['enable_2fa'] ?? $user->enable_2fa).
  const nonEditableFields = this.visibleFormFields
    .filter(f => f.editable === false)
    .map(f => f.column_name);
  nonEditableFields.forEach(key => delete payload[key]);

  const request$ = payload.id ? this.updateData(payload.id, payload) : this.postData(payload);
  request$.pipe(Core.finalize(() => { this.showCreateForm = false; this.cd.markForCheck(); }))
    .subscribe({
      next: () => this.refreshData(),
      error: (err: any) => {
        const message = err?.error?.message || 'Uložení se nezdařilo.';
        this.alertDialogService.open('Chyba', message, 'danger');
      }
    });
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

  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }
}