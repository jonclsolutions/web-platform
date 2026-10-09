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
 * - ScrollLockService: Blocks page scrolling behind the e-mail access policy modal.
 */

import { Component, ViewChild, ChangeDetectionStrategy, OnInit,inject } from '@angular/core';
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
import { ScrollLockService } from '../../../core/services/scroll-lock.service';

/**
 * Name of the role with unrestricted access. Only a sysadmin may assign it; the API refuses it
 * from anyone else as well.
 */
const SYSADMIN_ROLE_NAME = 'sysadmin';

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
  private scrollLock = inject(ScrollLockService);

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
  /**
   * Primary domain as SAVED on the server. `primaryEmailDomain` is bound to the modal input and
   * may hold a typed-but-unsaved value, so the e-mail check of the create form reads this one.
   */
  private savedPrimaryEmailDomain: string | null = null;
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
      this.buttons = Config.createTableButtons(this.i18n).map(button => this.restrictRowButton(button));
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
    return this.authService.getUserRole() === SYSADMIN_ROLE_NAME;
  }

  /**
   * @description Tells whether a table row / edited record is the signed-in user's own account.
   * @param account Row or record with an `id`; null for a new account.
   * @returns False for a new account.
   */
  private isOwnAccount(account: { id?: number | string } | null | undefined): boolean {
    return account?.id !== undefined && account?.id !== null
      && String(account.id) === String(this.authService.getUserId());
  }

  /**
   * @description Limits row buttons that only a sysadmin may use on SOMEONE ELSE'S account.
   * Currently the password change: everyone else sees it on their own row only.
   * @param button Row button from the config.
   * @returns The same button, with a per-row visibility rule where needed.
   * @note UX only - `UserController::changePassword()` refuses the request as well.
   */
  private restrictRowButton(button: Core.TableButtons): Core.TableButtons {
    if (button.action !== 'password_reset') return button;
    return { ...button, visibleWhen: (item: any) => this.isSysadmin || this.isOwnAccount(item) };
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

    /**
   * @description Releases the scroll lock when the page is left while the modal is still open.
   */
  override ngOnDestroy(): void {
    if (this.showEmailAccessPolicyModal) this.scrollLock.unlock();
    super.ngOnDestroy();
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
    // Needed up front for the live e-mail check in the create form. The endpoint is sysadmin-only,
    // so nobody else may even request it (it would only produce a 403 dialog).
    if (this.isSysadmin) this.loadEmailAccessPolicy();
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
      this.visibleFormFields = this.computeFieldsForTarget(
        roleId,
        !!this.selectedItemForEdit?.two_fa_forced_by_admin,
        !this.selectedItemForEdit,
        this.isEmailLocked(this.selectedItemForEdit),
        this.isOwnAccount(this.selectedItemForEdit)
      );
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

  /**
   * @description Lists the permissions the signed-in user must not grant to anyone as an extra
   * permission, i.e. those they do not hold themselves (no privilege escalation through the
   * `permission_ids` multiselect). They are not offered in the form at all.
   * @returns Option values (stringified permission IDs); empty for a sysadmin.
   * @note UX only - `UserController::applyExplicitPermissions()` decides what is really saved
   * and leaves grants outside the caller's authority untouched.
   */
  private ungrantablePermissionOptionIds(): string[] {
    if (this.isSysadmin) return [];
    return this.permissionsCatalog
      .filter(p => !this.permissionService.hasPermission(p.permission_key))
      .map(p => String(p.id));
  }

  /**
   * @description Tells whether the login e-mail must be read-only in the form: a non-sysadmin
   * may change the e-mail of their own account only (whoever controls the e-mail controls the
   * account - password reset and 2FA codes are sent there).
   * @param account Record being edited; null for a new account.
   * @returns False for a sysadmin, for a new account and for the user's own account.
   * @note UX only - `UserController::update()` refuses the change as well.
   */
  private isEmailLocked(account: { id?: number | string } | null | undefined): boolean {
    return !!account && !this.isSysadmin && !this.isOwnAccount(account);
  }

  private isRoleAssignable(roleId: number | string | undefined | null): boolean {
    if (this.isSysadmin) return true;
    if (roleId === undefined || roleId === null || roleId === '') return false;

    const meta = this.rolesMeta.get(Number(roleId));
    if (!meta) return false;
    // Never offered to a non-sysadmin, not even to a user who holds every single permission.
    if (meta.role_name === SYSADMIN_ROLE_NAME) return false;

    return meta.permissionKeys.every(key => this.permissionService.hasPermission(key));
  }

  /**
   * @description Derives the form definition for the account being created / edited.
   * @param roleId Role currently selected in the form.
   * @param adminForced True when a sysadmin forced 2FA on this particular account.
   * @param isNewAccount True for the create form. Only then is the login e-mail checked against
   *   the e-mail access policy (the backend does the same on create only).
   * @param emailLocked True when the login e-mail must be read-only, see `isEmailLocked()`.
   * @param roleLocked True when the role must be read-only - the signed-in user's own account,
   *   whose role nobody may change by themselves (sysadmin included).
   * @returns Form fields with the role-driven restrictions and the e-mail check applied. For a
   *   non-sysadmin the block switch and the "force 2FA" field are removed, and only the
   *   permissions they hold themselves (plus the ones the role grants) are offered. When 2FA is
   *   enforced, or the role is locked, the field is locked with a note saying why.
   */
  private computeFieldsForTarget(
    roleId: number | string | undefined | null,
    adminForced: boolean = false,
    isNewAccount: boolean = false,
    emailLocked: boolean = false,
    roleLocked: boolean = false
  ): InputDefinition[] {
    const forcedByRole = this.isRoleForced(roleId);
    const forced = forcedByRole || adminForced;
    const neverBlockable = this.isNeverBlockableRole(roleId);
    const rolePermissionIds = this.rolePermissionOptionIds(roleId);
    // Not offered at all: permissions the signed-in user does not hold. The ones the role grants
    // stay listed (locked, marked "from role") even then, because they describe the account.
    const roleGranted = new Set(rolePermissionIds);
    const hiddenPermissionIds = new Set(this.ungrantablePermissionOptionIds().filter(id => !roleGranted.has(id)));
    const emailPattern = isNewAccount ? this.allowedEmailPattern() : null;

    let fields = this.formFields.map(f => {
      if (f.column_name === 'user_email' && emailLocked) {
        return { ...f, editable: false };
      }
      if (f.column_name === 'user_email' && emailPattern) {
        return { ...f, pattern: emailPattern, errorMessage: this.t('field_email_domain_error') };
      }
      if (f.column_name === 'enable_2fa' && forced) {
        // The role wins when both apply: changing the role is the only way to lift it.
        const hintKey = forcedByRole ? 'field_enable_2fa_forced_by_role_hint' : 'field_enable_2fa_forced_by_admin_hint';
        return { ...f, editable: false, hint: this.t(hintKey) };
      }
      if (f.column_name === 'is_blocked' && neverBlockable) {
        return { ...f, editable: false };
      }
      if (f.column_name === 'permission_ids') {
        const offeredOptions = (f.options ?? []).filter(opt => !hiddenPermissionIds.has(String(opt.value)));
        return { ...f, options: offeredOptions, disabledOptionValues: rolePermissionIds } as InputDefinition;
      }
      if (f.column_name === 'role_id' && roleLocked) {
        // Own account: the current role stays visible but cannot be changed (the API ignores it).
        return { ...f, editable: false, hint: this.t('field_role_own_account_hint') };
      }
      if (f.column_name === 'role_id' && !this.isSysadmin) {
        const assignableOptions = this.roleOptions.filter(opt =>
          String(opt.value) === String(roleId) || this.isRoleAssignable(opt.value)
        );
        return { ...f, options: assignableOptions };
      }
      return f;
    });

    const showOverrideField = this.isSysadmin && !forcedByRole;
    if (!showOverrideField) {
      fields = fields.filter(f => f.column_name !== 'two_fa_forced_by_admin');
    }

    // Blocking and unblocking is sysadmin-only (the API refuses it from anyone else). A hidden
    // field is also never sent, see handleFormSubmitted().
    if (!this.isSysadmin) {
      fields = fields.filter(f => f.column_name !== 'is_blocked');
    }

    return fields;
  }

  /**
   * @description Builds the validation pattern of the login e-mail of a NEW account from the
   * e-mail access policy, mirroring `UserController::assertEmailDomainAllowed()`: the address is
   * accepted when its domain is the primary domain or an allowed domain, or when the whole
   * address is listed as an exception.
   * @returns Pattern source for the form field; null when there is nothing to check (policy not
   *   loaded, which is always the case for a non-sysadmin, or no primary domain = no restriction).
   * @note UX only. The backend stays the authority and checks the address again on save.
   */
  private allowedEmailPattern(): string | null {
    const primaryDomain = this.savedPrimaryEmailDomain?.trim();
    if (!primaryDomain) return null;

    // The backend compares lower-cased values, so every letter is matched in both cases (a string
    // pattern cannot carry the `i` flag). `-` is deliberately left unescaped: outside a character
    // class that escape is invalid in the unicode mode browsers use for the `pattern` attribute.
    const toSource = (value: string): string => value
      .replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
      .replace(/[a-z]/gi, letter => `[${letter.toLowerCase()}${letter.toUpperCase()}]`);
    const valuesOf = (type: EmailAccessRule['type']): string[] =>
      this.emailAccessRules.filter(rule => rule.type === type).map(rule => rule.value);

    const domains = [primaryDomain, ...valuesOf('domain')]
      .map(domain => domain.trim().replace(/^@/, ''))
      .filter(Boolean)
      .map(toSource);
    const addresses = valuesOf('email').map(address => address.trim()).filter(Boolean).map(toSource);

    return `(?:${[`[^@\\s]+@(?:${domains.join('|')})`, ...addresses].join('|')})`;
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
    this.visibleFormFields = this.computeFieldsForTarget(null, false, true);
    this.showCreateForm = true;
  }

  handleEditFormOpened(item: any): void {
    const itemToEdit = { ...item };
    if (itemToEdit.roles?.length > 0) itemToEdit.role_id = itemToEdit.roles[0].id;

    const explicitKeys: string[] = Array.isArray(itemToEdit.user_permissions) ? itemToEdit.user_permissions : [];
    // Extra permissions the signed-in user does not hold are not offered in the form, so they
    // are not pre-selected either. The API keeps them on the account untouched.
    const notOffered = new Set(this.ungrantablePermissionOptionIds());
    const explicitIds = this.permissionsCatalog
      .filter(p => explicitKeys.includes(p.permission_key))
      .map(p => String(p.id))
      .filter(id => !notOffered.has(id));
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
    this.visibleFormFields = this.computeFieldsForTarget(
      itemToEdit.role_id,
      !!itemToEdit.two_fa_forced_by_admin,
      false,
      this.isEmailLocked(itemToEdit),
      this.isOwnAccount(itemToEdit)
    );
    this.selectedItemForEdit = itemToEdit;
    this.showCreateForm = true;
  }

    /**
   * @description Reacts to a role change in the open form: recomputes the fields, pre-selects
   * the permissions of the new role and, when 2FA is enforced, shows its checkbox checked.
   * @param event Field change reported by FormBuilderComponent.
   * @note When the new role does not enforce 2FA, the checkbox keeps its current value and
   *   becomes editable again.
   */
  handleFieldChanged(event: { columnName: string; value: any }): void {
    if (event.columnName !== 'role_id') return;

    const newRoleId = event.value !== '' && event.value !== null && event.value !== undefined
      ? Number(event.value)
      : null;
    const adminForced = !!this.selectedItemForEdit?.two_fa_forced_by_admin;

    this.visibleFormFields = this.computeFieldsForTarget(
      newRoleId,
      adminForced,
      !this.selectedItemForEdit,
      this.isEmailLocked(this.selectedItemForEdit),
      this.isOwnAccount(this.selectedItemForEdit)
    );

    const overrides: Record<string, any> = { permission_ids: this.rolePermissionOptionIds(newRoleId) };
    // Enforced 2FA is shown as checked; the API turns it on anyway (the locked field is not sent).
    if (this.isRoleForced(newRoleId) || adminForced) {
      overrides['enable_2fa'] = true;
    }
    this.formFieldOverrides = overrides;
    this.cd.markForCheck();
  }

    handleFormSubmitted(formData: any): void {
    const payload = { ...formData };
    if (payload.role_id) payload.role_id = parseInt(payload.role_id, 10);

    // FormBuilderComponent initializes an untouched checkbox to '' (see its ngOnInit), which the
    // API rejects ("must be true or false"). Every checkbox field is sent as a real boolean.
    const CHECKED_VALUES: unknown[] = [true, 1, '1', 'true', 'on'];
    this.visibleFormFields
      .filter(field => field.type === 'checkbox' && field.column_name in payload)
      .forEach(field => { payload[field.column_name] = CHECKED_VALUES.includes(payload[field.column_name]); });

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

    // The role the account has after saving. Read BEFORE locked fields are removed: on the own
    // account `role_id` is locked and therefore not sent, but the checks below still need it.
    const targetRoleId = payload.role_id;

    const nonEditableFields = this.visibleFormFields
      .filter(f => f.editable === false)
      .map(f => f.column_name);
    nonEditableFields.forEach(key => delete payload[key]);

    // A field hidden from the current user (e.g. "force 2FA" for a non-sysadmin) is never sent.
    // The form still carries its value from the edited record and the API refuses the key itself.
    const visibleFieldNames = new Set(this.visibleFormFields.map(f => f.column_name));
    this.formFields
      .filter(f => !visibleFieldNames.has(f.column_name))
      .forEach(f => delete payload[f.column_name]);

    const forcedNow = this.isRoleForced(targetRoleId);
    if (forcedNow) {
      delete payload.enable_2fa;
      delete payload.two_fa_forced_by_admin;
    }

    if (this.isNeverBlockableRole(targetRoleId)) {
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
    // Guard: every lock() must be paired with exactly one unlock().
    if (this.showEmailAccessPolicyModal) return;

    this.scrollLock.lock();
    this.showEmailAccessPolicyModal = true;
    this.newRuleType = 'domain';
    this.newRuleValue = '';
    this.loadEmailAccessPolicy();
  }

  /**
   * @description Loads the e-mail access policy: the single source of both the policy modal and
   * the live e-mail check in the create form.
   * @note Call it for a sysadmin only; the endpoint refuses everyone else.
   */
  private loadEmailAccessPolicy(): void {
    this.emailAccessPolicyLoading = true;
    this.cd.markForCheck();

    this.dataHandler.get<{ primary_email_domain: string | null; rules: EmailAccessRule[] }>('core/email-access-policy').subscribe({
      next: (res) => {
        this.primaryEmailDomain = res.primary_email_domain;
        this.savedPrimaryEmailDomain = res.primary_email_domain;
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
    this.scrollLock.unlock();
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
        this.savedPrimaryEmailDomain = this.primaryEmailDomain?.trim() || null;
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