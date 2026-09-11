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
 * - RoleOptionsService: TTL-cached source of `core/roles` for `role_id` select options.
 * - PermissionOptionsService: TTL-cached source of `core/permissions` for the
 *   `permission_ids` multiselect (explicit extra permissions).
 * - SHARED_UI_BUILDERS: Centralized collection of UI components for the dashboard.
 *
 * (Earlier refactor-notes for 2FA locking, role assignability, permission_ids
 * pre-checking/wipe-on-role-change, and the i18n `t()` override are unchanged - see
 * version history, omitted here for brevity. `translationSection`/`t()` override was
 * ALREADY present before this update.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.TABLE_BUTTONS`/`FORM_FIELDS`/etc. konstanty nahrazeny `Config.create*()`
 * factory funkcemi. NA ROZDÍL od ostatních stránek má tahle DVA nezávislé zdroje
 * mutace `formFields`/`filterColumns`: i18n (text) a async `loadRoleOptions()`/
 * `loadPermissionOptions()` (dynamická role/permission data, NIKDY nepřekládaná -
 * jsou to reálná jména z DB, ne enum sluggy). Řešeno novou `rebuildFormFields()`
 * metodou volanou z OBOU zdrojů (i18n `translations$.subscribe()` i
 * `loadRoleOptions()`/`loadPermissionOptions()` callbacků) - `this.formFields` je
 * vždy aktuální kombinace obou. Pokud je formulář zrovna otevřený, `rebuildFormFields()`
 * navíc přepočítá `visibleFormFields` se zachovaným kontextem (aktuálně zvolená role),
 * ať přepnutí jazyka za běhu s otevřeným formulářem nezobrazí zastaralý text.
 *
 * @bugfix-note (2026-09-08) `openGraphBuilder` permission oprava - viz
 * administrators.config.ts stejné datum.
 */

import { Component, ViewChild, ChangeDetectionStrategy, OnInit } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { RoleOptionsService } from '../../../core/services/role-options.service';
import { PermissionOptionsService, CorePermissionOption } from '../../../core/services/permission-options.service';
import { InputDefinition } from '../../../shared/interfaces/input-definiton';
import * as Config from './administrators.config';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/**
 * Roles with 2FA hardcoded ON - must match backend `User::FORCED_2FA_ROLE_NAMES`.
 */
const HARDCODED_FORCED_ROLE_NAMES = ['sysadmin'];

/**
 * Roles whose accounts can NEVER be blocked - must match backend
 * `UserController::NEVER_BLOCK_ROLE_NAMES`.
 */
const NEVER_BLOCKABLE_ROLE_NAMES = ['sysadmin'];

interface RoleMeta {
  role_name: string;
  forces_2fa: boolean;
  permissionKeys: string[];
}

/** One whitelist entry - see CoreEmailAccessRule on the backend. */
interface EmailAccessRule {
  id: number;
  type: 'domain' | 'email';
  value: string;
}

@Component({
  selector: 'app-administrators',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './administrators.component.html',
  styleUrls: ['../default-style.css', './email-access-policy-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdministratorsComponent extends BaseDataComponent<any> implements OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  protected override translationSection: string = 'administrators';

  public override t(key: string): string {
    return this.i18n.getValue(`administrators.${key}`);
  }

  get tableCaption(): string { return this.t('table_header_accounts'); }

  override apiEndpoint: string = 'core/users';

  buttons: Core.TableButtons[] = [];
  /** Baseline definition - role_id/permission_ids options land here from loadRoleOptions()/loadPermissionOptions() via rebuildFormFields(). */
  formFields: InputDefinition[] = [];
  /** What is ACTUALLY rendered in the form - see computeFieldsForTarget(). */
  visibleFormFields: InputDefinition[] = [];
  formFieldOverrides: Record<string, any> | null = null;

  tableColumns: Core.ColumnDefinition[] = [];
  trashTableColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];
  resetPasswordFormFields: Core.InputDefinition[] = [];

  showResetPasswordForm: boolean = false;
  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;
  get resetPasswordTitle(): string { return this._resetPasswordTitle; }
  private _resetPasswordTitle: string = '';
  filters: Core.FilterParams = { sort_by: 'id', sort_direction: 'desc' };

  roleOptions: { value: string; label: string }[] = [];
  /** Full permission catalogue, for the `permission_ids` multiselect. */
  permissionOptions: { value: string; label: string }[] = [];
  private permissionsCatalog: CorePermissionOption[] = [];

  /** Map role_id -> {role_name, forces_2fa, permissionKeys}, for dynamic field disable/hide. */
  private rolesMeta = new Map<number, RoleMeta>();

  // ── Email access policy modal ──────────────────────────────────────────
  showEmailAccessPolicyModal = false;
  emailAccessPolicyLoading = false;
  emailAccessPolicySaving = false;
  primaryEmailDomain: string | null = null;
  emailAccessRules: EmailAccessRule[] = [];
  newRuleType: 'domain' | 'email' = 'domain';
  newRuleValue = '';
  showGraphBuilder = false;

  /** @refactor-note (2026-09-08) Přestalo být `readonly` field initializer - přepočítáno v rebuildFormFields()/subscribe. */
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private roleOptionsService: RoleOptionsService,
    private permissionOptionsService: PermissionOptionsService,
    public override authService: Core.AuthService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.buttons = Config.createTableButtons(this.i18n);
      this.resetPasswordFormFields = Config.createResetPasswordFormFields(this.i18n);
      this.tableColumns = Config.createTableColumns(this.i18n);
      this.trashTableColumns = Config.createTrashTableColumns(this.i18n);
      this.detailsColumns = Config.createDetailsColumns(this.i18n);
      this.graphColumns = this.detailsColumns
        .filter(col => col.chartable === true)
        .map(col => ({
          key: col.key,
          label: col.displayName,
          aggregation: col.chartAggregation ?? 'count',
          possibleValues: col.chartPossibleValues,
        }));
      this.rebuildFormFields();
      this.cd.markForCheck();
    });
  }

  /** @description UX only - the real authority check happens on the backend. */
  get isSysadmin(): boolean {
    return this.authService.getUserRole() === 'sysadmin';
  }

  get toolbarButtons(): Core.Button[] {
    return Config.createToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
        case 'triggerImport':
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'openEmailAccessPolicy':
          updatedBtn.showIf = this.isSysadmin;
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? this.t('toolbar_show_active') : this.t('toolbar_show_trash');
          updatedBtn.isActive = this.showTrashTable;
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
      openGraphBuilder: () => this.openGraphBuilder(),
      openEmailAccessPolicy: () => this.openEmailAccessPolicyModal(),
      toggleTable: () => this.toggleTable()
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this._resetPasswordTitle = this.t('reset_password_title_default');
    this.initWithAuthCheck(this.router);
    this.loadRoleOptions();
    this.loadRolesForces2fa();
    this.loadPermissionOptions();
  }

  /**
   * @description Jediné místo, kde se `formFields`/`filterColumns` skládají z DVOU
   * nezávislých zdrojů - přeloženého textu (`Config.createFormFields(i18n)`) a
   * dynamických role/permission dat (`this.roleOptions`/`this.permissionOptions`,
   * NIKDY nepřekládaných). Volá se z konstruktoru (i18n subscribe) i z
   * `loadRoleOptions()`/`loadPermissionOptions()` callbacků, ať je `formFields` vždy
   * aktuální kombinace obou. Pokud je zrovna otevřený formulář, přepočítá i
   * `visibleFormFields` se zachovaným kontextem (aktuálně zvolená role) - přepnutí
   * jazyka s otevřeným formulářem tak nezobrazí zastaralý text.
   */
  private rebuildFormFields(): void {
    this.formFields = Config.createFormFields(this.i18n).map(field => {
      if (field.column_name === 'role_id') return { ...field, options: this.roleOptions };
      if (field.column_name === 'permission_ids') return { ...field, options: this.permissionOptions };
      return field;
    });

    this.filterColumns = Config.createFilterColumns(this.i18n).map(col =>
      col.key === 'role_id' ? { ...col, options: this.roleOptions } : col
    );

    if (this.showCreateForm) {
      const roleId = this.selectedItemForEdit?.role_id ?? null;
      this.visibleFormFields = this.computeFieldsForTarget(roleId, !!this.selectedItemForEdit?.two_fa_forced_by_admin);
    } else {
      this.visibleFormFields = this.formFields;
    }
  }

  private loadRoleOptions(): void {
    this.roleOptionsService.getRoles().subscribe({
      next: (roles) => {
        this.roleOptions = (roles || [])
          .filter((r): r is { id: number; role_name: string } => !!r)
          .map(r => ({ value: String(r.id), label: r.role_name }));

        this.rebuildFormFields();
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Loads the full permission catalogue for the `permission_ids`
   * multiselect. Non-blocking on error - in the worst case the multiselect is
   * simply empty until a retry.
   */
  private loadPermissionOptions(): void {
    this.permissionOptionsService.getPermissions().subscribe({
      next: (permissions) => {
        this.permissionsCatalog = permissions || [];
        this.permissionOptions = this.permissionsCatalog
          .map(p => ({ value: String(p.id), label: `${p.permission_key}${p.description ? ' — ' + p.description : ''}` }));

        this.rebuildFormFields();
        this.cd.markForCheck();
      }
    });
  }

  private loadRolesForces2fa(): void {
    this.dataHandler.get<any[]>('core/roles?no_pagination=true').subscribe({
      next: (roles) => {
        this.rolesMeta.clear();
        (roles || []).forEach((r: any) => {
          if (r?.id !== undefined) {
            this.rolesMeta.set(Number(r.id), {
              role_name: r.role_name,
              forces_2fa: !!r.forces_2fa,
              permissionKeys: Array.isArray(r.permissions) ? r.permissions : [],
            });
          }
        });
      },
      error: () => {
        // Non-blocking - worst case the frontend just won't pre-disable fields.
      }
    });
  }

  private isRoleForced(roleId: number | string | undefined | null): boolean {
    if (roleId === undefined || roleId === null || roleId === '') return false;
    const meta = this.rolesMeta.get(Number(roleId));
    if (!meta) return false;
    return HARDCODED_FORCED_ROLE_NAMES.includes(meta.role_name) || meta.forces_2fa;
  }

  private isNeverBlockableRole(roleId: number | string | undefined | null): boolean {
    if (roleId === undefined || roleId === null || roleId === '') return false;
    const meta = this.rolesMeta.get(Number(roleId));
    return !!meta && NEVER_BLOCKABLE_ROLE_NAMES.includes(meta.role_name);
  }

  private rolePermissionOptionIds(roleId: number | string | undefined | null): string[] {
    if (roleId === undefined || roleId === null || roleId === '') return [];
    const meta = this.rolesMeta.get(Number(roleId));
    if (!meta || meta.permissionKeys.length === 0) return [];

    const keySet = new Set(meta.permissionKeys);
    return this.permissionsCatalog
      .filter(p => keySet.has(p.permission_key))
      .map(p => String(p.id));
  }

  private isRoleAssignable(roleId: number | string | undefined | null): boolean {
    if (this.isSysadmin) return true;
    if (roleId === undefined || roleId === null || roleId === '') return false;

    const meta = this.rolesMeta.get(Number(roleId));
    if (!meta) return false;

    return meta.permissionKeys.every(key => this.permissionService.hasPermission(key));
  }

  private computeFieldsForTarget(
    roleId: number | string | undefined | null,
    adminForced: boolean = false
  ): InputDefinition[] {
    const forced = this.isRoleForced(roleId) || adminForced;
    const neverBlockable = this.isNeverBlockableRole(roleId);
    const rolePermissionIds = this.rolePermissionOptionIds(roleId);

    let fields = this.formFields.map(f => {
      if (f.column_name === 'enable_2fa' && forced) {
        return { ...f, editable: false };
      }
      if (f.column_name === 'is_blocked' && neverBlockable) {
        return { ...f, editable: false };
      }
      if (f.column_name === 'permission_ids') {
        return { ...f, disabledOptionValues: rolePermissionIds } as InputDefinition;
      }
      if (f.column_name === 'role_id' && !this.isSysadmin) {
        const assignableOptions = this.roleOptions.filter(opt =>
          String(opt.value) === String(roleId) || this.isRoleAssignable(opt.value)
        );
        return { ...f, options: assignableOptions };
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
    this.formFieldOverrides = null;
    this.visibleFormFields = this.computeFieldsForTarget(null);
    this.showCreateForm = true;
  }

  handleEditFormOpened(item: any): void {
    const itemToEdit = { ...item };
    if (itemToEdit.roles?.length > 0) itemToEdit.role_id = itemToEdit.roles[0].id;

    const explicitKeys: string[] = Array.isArray(itemToEdit.user_permissions) ? itemToEdit.user_permissions : [];
    const explicitIds = this.permissionsCatalog
      .filter(p => explicitKeys.includes(p.permission_key))
      .map(p => String(p.id));
    const roleIds = this.rolePermissionOptionIds(itemToEdit.role_id);
    itemToEdit.permission_ids = Array.from(new Set([...explicitIds, ...roleIds]));

    const forced = this.isRoleForced(itemToEdit.role_id) || !!itemToEdit.two_fa_forced_by_admin;
    if (forced) {
      itemToEdit.enable_2fa = true;
    }

    if (this.isNeverBlockableRole(itemToEdit.role_id)) {
      itemToEdit.is_blocked = false;
    }

    this.formFieldOverrides = null;
    this.visibleFormFields = this.computeFieldsForTarget(itemToEdit.role_id, !!itemToEdit.two_fa_forced_by_admin);
    this.selectedItemForEdit = itemToEdit;
    this.showCreateForm = true;
  }

  handleFieldChanged(event: { columnName: string; value: any }): void {
    if (event.columnName !== 'role_id') return;

    const newRoleId = event.value !== '' && event.value !== null && event.value !== undefined
      ? Number(event.value)
      : null;

    this.visibleFormFields = this.computeFieldsForTarget(newRoleId, !!this.selectedItemForEdit?.two_fa_forced_by_admin);
    this.formFieldOverrides = { permission_ids: this.rolePermissionOptionIds(newRoleId) };
    this.cd.markForCheck();
  }

  handleFormSubmitted(formData: any): void {
    const payload = { ...formData };
    if (payload.role_id) payload.role_id = parseInt(payload.role_id, 10);

    const originalRoleId = this.selectedItemForEdit?.role_id !== undefined && this.selectedItemForEdit?.role_id !== null
      ? Number(this.selectedItemForEdit.role_id)
      : null;
    const roleChanged = !!payload.id && originalRoleId !== null && payload.role_id !== originalRoleId;

    if (roleChanged) {
      payload.permission_ids = [];
      this.alertDialogService.open(
        this.t('role_changed_title'),
        this.t('role_changed_message'),
        'info'
      );
    } else if (Array.isArray(payload.permission_ids)) {
      const roleIds = new Set(this.rolePermissionOptionIds(payload.role_id));
      payload.permission_ids = payload.permission_ids
        .filter((id: string | number) => !roleIds.has(String(id)))
        .map((id: string | number) => Number(id));
    } else {
      delete payload.permission_ids;
    }

    const nonEditableFields = this.visibleFormFields
      .filter(f => f.editable === false)
      .map(f => f.column_name);
    nonEditableFields.forEach(key => delete payload[key]);

    const forcedNow = this.isRoleForced(payload.role_id);
    if (forcedNow) {
      delete payload.enable_2fa;
      delete payload.two_fa_forced_by_admin;
    }

    if (this.isNeverBlockableRole(payload.role_id)) {
      delete payload.is_blocked;
    }

    const request$ = payload.id ? this.updateData(payload.id, payload) : this.postData(payload);
    request$.pipe(Core.finalize(() => { this.showCreateForm = false; this.formFieldOverrides = null; this.cd.markForCheck(); }))
      .subscribe({
        next: () => {
          this.alertDialogService.open(this.t('success_title'), payload.id ? this.t('account_updated') : this.t('account_created'), 'success');
          this.refreshData();
        }
      });
  }

  handleResetPasswordFormOpened(item: any): void {
    this._resetPasswordTitle = this.t('reset_password_title_with_email').replace('{email}', item.user_email);
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
        next: () => this.alertDialogService.open(this.t('success_title'), this.t('password_changed'), 'success')
      });
  }

  handleResendActivation(item: any): void {
    if (item.activated_at) {
      this.alertDialogService.open(this.t('info_title'), this.t('account_already_active'), 'info');
      return;
    }

    this.dataHandler.post(`core/users/${item.id}/resend-activation`, {}).subscribe({
      next: () => this.alertDialogService.open(this.t('sent_title'), this.t('activation_email_resent'), 'success')
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

  // ── Email access policy modal ──────────────────────────────────────────

  openEmailAccessPolicyModal(): void {
    this.showEmailAccessPolicyModal = true;
    this.emailAccessPolicyLoading = true;
    this.newRuleType = 'domain';
    this.newRuleValue = '';
    this.cd.markForCheck();

    this.dataHandler.get<{ primary_email_domain: string | null; rules: EmailAccessRule[] }>('core/email-access-policy').subscribe({
      next: (res) => {
        this.primaryEmailDomain = res.primary_email_domain;
        this.emailAccessRules = res.rules || [];
        this.emailAccessPolicyLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.emailAccessPolicyLoading = false;
        this.cd.markForCheck();
      }
    });
  }

  closeEmailAccessPolicyModal(): void {
    if (this.emailAccessPolicySaving) return;
    this.showEmailAccessPolicyModal = false;
  }

  savePrimaryDomain(): void {
    if (this.emailAccessPolicySaving) return;
    this.emailAccessPolicySaving = true;
    this.cd.markForCheck();

    this.dataHandler.put<any>('core/email-access-policy/primary-domain', {
      primary_email_domain: this.primaryEmailDomain?.trim() || null,
    }).subscribe({
      next: (setting: any) => {
        this.emailAccessPolicySaving = false;
        this.primaryEmailDomain = setting?.primary_email_domain ?? this.primaryEmailDomain;
        this.alertDialogService.open(this.t('saved_title'), this.t('primary_domain_saved'), 'success');
        this.cd.markForCheck();
      },
      error: () => {
        this.emailAccessPolicySaving = false;
        this.cd.markForCheck();
      }
    });
  }

  addEmailAccessRule(): void {
    const value = this.newRuleValue.trim();
    if (!value) return;

    this.dataHandler.post<EmailAccessRule>('core/email-access-policy/rules', {
      type: this.newRuleType,
      value,
    }).subscribe({
      next: (rule) => {
        this.emailAccessRules = [...this.emailAccessRules, rule];
        this.newRuleValue = '';
        this.cd.markForCheck();
      }
    });
  }

  removeEmailAccessRule(id: number): void {
    this.dataHandler.delete(`core/email-access-policy/rules/${id}`).subscribe({
      next: () => {
        this.emailAccessRules = this.emailAccessRules.filter(r => r.id !== id);
        this.cd.markForCheck();
      }
    });
  }

  get domainRules(): EmailAccessRule[] {
    return this.emailAccessRules.filter(r => r.type === 'domain');
  }

  get emailRules(): EmailAccessRule[] {
    return this.emailAccessRules.filter(r => r.type === 'email');
  }

  openGraphBuilder(): void {
    this.showGraphBuilder = true;
    this.cd.markForCheck();
  }

  closeGraphBuilder(): void {
    this.showGraphBuilder = false;
    this.cd.markForCheck();
  }
}