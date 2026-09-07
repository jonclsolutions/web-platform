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
 * (Earlier refactor-notes for the 2FA/is_blocked/email-domain-policy/error-toast
 * work, and for the 'admin' role removal, are unchanged and omitted here for
 * brevity - see version history.)
 *
 * @refactor-note (2026-09-05) BACKLOG "role/admin UX improvement": `permission_ids`
 * multiselect now shows the FULL permission catalogue with the selected role's own
 * permissions rendered pre-checked and disabled (`disabledOptionValues`, see
 * `rolePermissionOptionIds()`/`computeFieldsForTarget()`), instead of an
 * undifferentiated flat list. `handleEditFormOpened()` seeds `permission_ids` with
 * the union of the account's own explicit grants and the role's own grants so the
 * role's share renders checked. `handleFormSubmitted()` strips role-covered ids
 * before sending (display-only, never real explicit grants).
 *
 * @refactor-note (2026-09-06) BACKLOG "who can change roles + role change UX/security":
 * - New `isRoleAssignable()` mirrors backend `UserController::actorCanAssignRole()`
 *   client-side (UX only - the backend re-checks independently and is the actual
 *   security boundary): a non-sysadmin actor should not even be OFFERED a role in
 *   the `role_id` select whose permissions exceed their own effective permissions.
 *   `computeFieldsForTarget()` filters the `role_id` field's options accordingly,
 *   always keeping the currently-assigned role in the list so an existing
 *   assignment never renders blank.
 * - `handleFormSubmitted()` now detects an actual role CHANGE (comparing the
 *   submitted role against the role the form was opened with) and, when it
 *   differs, forces `permission_ids` to an empty array and shows an info notice -
 *   mirroring the backend's unconditional wipe-on-role-change rule in
 *   `UserController::update()`, so the admin isn't left staring at a form whose
 *   checked permissions silently didn't persist.
 * - NEW: this no longer requires closing and reopening the form to take effect.
 *   `handleFieldChanged()` reacts to a LIVE `role_id` change inside an already-open
 *   form (via `FormBuilderComponent`'s new generic `(fieldChanged)` output),
 *   recomputes `visibleFormFields` for the newly selected role (assignable role
 *   list, disabled permission options, 2FA/blockability locks) and pushes a fresh
 *   `permission_ids` value - exactly what the new role covers, zero explicit
 *   extras - into the open form via `FormBuilderComponent`'s new generic
 *   `[fieldOverrides]` input. This keeps the on-screen state honest with what
 *   submitting would actually persist, without the admin needing to close/reopen
 *   the modal to see it.
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * Komponenta DĚDÍ BaseDataComponent, proto `translationSection = 'administrators'` a
 * zděděné `strings`/`t()`. Přidán LOKÁLNÍ override `t(key)` doplňující prefix
 * `administrators.` (stejná oprava jako u EditRolesComponent/WebSettingsComponent -
 * zděděná `BaseDataComponent.t(path)` čeká PLNOU cestu se sekcí, ne krátký klíč).
 * Nahrazeny VŠECHNY natvrdo psané texty vlastní této komponentě - `Config.*`
 * konstanty (TABLE_BUTTONS/TOOLBAR_BUTTONS/FORM_FIELDS/...) záměrně MIMO SCOPE
 * tohoto kroku (budou řešeny samostatně jako *.config.ts factory funkce, stejně
 * jako user-request.config.ts). Přepisy labelů uvnitř `toolbarButtons` getteru
 * (Filtry/Skrýt filtry/Koš/Zobrazit aktivní) JSOU administrators-specifické (žijí
 * přímo v této třídě, ne v configu) a byly migrovány stejně jako u
 * UserRequestComponent. Info banner s <strong>bez hesla</strong> řešen rozdělením
 * na prefix/bold/suffix v šabloně (stejný důvod jako edit-legal missing-banner -
 * vyhnout se [innerHTML] jen kvůli tučnému textu).
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
 * @refactor-note (2026-09-02) Narrowed to sysadmin-only - 'admin' role removed.
 */
const HARDCODED_FORCED_ROLE_NAMES = ['sysadmin'];

/**
 * Roles whose accounts can NEVER be blocked - same list as
 * HARDCODED_FORCED_ROLE_NAMES today, but kept as its own constant so it can evolve
 * independently in the future. Must match backend `UserController::NEVER_BLOCK_ROLE_NAMES`.
 * @refactor-note (2026-09-02) Narrowed to sysadmin-only - 'admin' role removed.
 */
const NEVER_BLOCKABLE_ROLE_NAMES = ['sysadmin'];

interface RoleMeta {
  role_name: string;
  forces_2fa: boolean;
  /**
   * Permission keys this role grants - used to pre-check & disable them in the
   * `permission_ids` multiselect, and to decide role assignability, see
   * loadRolesForces2fa()/rolePermissionOptionIds()/isRoleAssignable().
   * @refactor-note (2026-09-05) BACKLOG "role/admin UX improvement".
   */
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
  // ActionMenuBuilderComponent added explicitly until it is folded into the
  // SHARED_UI_BUILDERS bundle.
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent,GraphBuilderComponent],
  templateUrl: './administrators.component.html',
  styleUrls: ['../default-style.css', './email-access-policy-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdministratorsComponent extends BaseDataComponent<any> implements OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  protected override translationSection: string = 'administrators';

  /**
   * @refactor-note (2026-09) BUGFIX - viz hlavička souboru. Zděděná
   * `BaseDataComponent.t(path)` čeká plnou cestu se sekcí; tenhle override doplní
   * prefix `administrators.` automaticky, takže volání `this.t('xxx')` v celém
   * souboru fungují s krátkým klíčem.
   */
  public override t(key: string): string {
    return this.i18n.getValue(`administrators.${key}`);
  }

  get tableCaption(): string { return this.t('table_header_accounts'); }

  override apiEndpoint: string = 'core/users';

  buttons = Config.TABLE_BUTTONS;
  /** Baseline definition (role_id/permission_ids options land here from loadRoleOptions()/loadPermissionOptions()). */
  formFields = Config.FORM_FIELDS;
  /** What is ACTUALLY rendered in the form - see computeFieldsForTarget(). */
  visibleFormFields: InputDefinition[] = Config.FORM_FIELDS;
  /**
   * Forced value overrides pushed into the currently open form-builder instance,
   * e.g. resetting `permission_ids` when the role changes live - see
   * `handleFieldChanged()`. `null` means "nothing to force right now".
   * @refactor-note (2026-09-06) BACKLOG "who can change roles + role change UX/security".
   */
  formFieldOverrides: Record<string, any> | null = null;

  tableColumns = Config.TABLE_COLUMNS;
  trashTableColumns = Config.TRASH_TABLE_COLUMNS;
  filterColumns = Config.FILTER_COLUMNS;
  detailsColumns = Config.DETAILS_COLUMNS;
  resetPasswordFormFields = Config.RESET_PASSWORD_FORM_FIELDS;

  showResetPasswordForm: boolean = false;
  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;
  get resetPasswordTitle(): string { return this._resetPasswordTitle; }
  private _resetPasswordTitle: string = '';
  filters: Core.FilterParams = { sort_by: 'id', sort_direction: 'desc' };

  roleOptions: { value: string; label: string }[] = [];
  /** Full permission catalogue, for the `permission_ids` multiselect. */
  permissionOptions: { value: string; label: string }[] = [];
  /**
   * Raw catalogue (id + permission_key) - needed to map a role's permission_key
   * list onto option ids for the disabled/pre-checked state, see
   * rolePermissionOptionIds().
   * @refactor-note (2026-09-05) BACKLOG "role/admin UX improvement".
   */
  private permissionsCatalog: CorePermissionOption[] = [];

  /** Map role_id -> {role_name, forces_2fa, permissionKeys}, for dynamic field disable/hide. */
  private rolesMeta = new Map<number, RoleMeta>();

  // ── Email access policy modal (BACKLOG "core-admin-email-domain-restriction") ──────
  showEmailAccessPolicyModal = false;
  emailAccessPolicyLoading = false;
  emailAccessPolicySaving = false;
  primaryEmailDomain: string | null = null;
  emailAccessRules: EmailAccessRule[] = [];
  newRuleType: 'domain' | 'email' = 'domain';
  newRuleValue = '';
  showGraphBuilder = false;
  readonly graphColumns: GraphColumnOption[] = Config.DETAILS_COLUMNS
     .filter(col => col.chartable === true)
     .map(col => ({
       key: col.key,
       label: col.displayName,
      aggregation: col.chartAggregation ?? 'count',
      possibleValues: col.chartPossibleValues
     }));

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
  }

  /** @description UX only - the real authority check happens on the backend. */
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
          // Sysadmin-only - see refactor-note (2026-08-25) in the header. The backend
          // protects itself independently of this - hiding the button is UX only.
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
      }
    });
  }

  /**
   * @description Loads the full permission catalogue for the `permission_ids`
   * multiselect - same TTL-cache-backed pattern as loadRoleOptions(), just against
   * PermissionOptionsService/`core/permissions` instead of roles. Non-blocking on
   * error (see PermissionOptionsService.getPermissions()) - in the worst case the
   * multiselect is simply empty until a retry, the backend authority check in
   * `UserController::applyExplicitPermissions()` is unaffected either way.
   * @refactor-note (2026-09-05) Also stores the raw catalogue in
   * `permissionsCatalog` - needed by `rolePermissionOptionIds()` to map a role's
   * permission_key list onto option ids.
   */
  private loadPermissionOptions(): void {
    this.permissionOptionsService.getPermissions().subscribe({
      next: (permissions) => {
        this.permissionsCatalog = permissions || [];
        this.permissionOptions = this.permissionsCatalog
          .map(p => ({ value: String(p.id), label: `${p.permission_key}${p.description ? ' — ' + p.description : ''}` }));

        this.formFields = this.formFields.map(field =>
          field.column_name === 'permission_ids' ? { ...field, options: this.permissionOptions } : field
        );
        this.visibleFormFields = this.formFields;

        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Loads 2FA-relevant role metadata (role_name + forces_2fa) directly,
   * independent of the RoleOptionsService cache (see refactor-note in the header).
   * The same map is reused for "is this role never-blockable?", "which permissions
   * does this role already grant?", and "can the current actor even assign this
   * role?".
   * @refactor-note (2026-09-05) Also stores `permissions` (permission_key array,
   * already returned by `core/roles?no_pagination=true` via `CoreRoleResource` and
   * previously ignored here) as `RoleMeta.permissionKeys`.
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
              permissionKeys: Array.isArray(r.permissions) ? r.permissions : [],
            });
          }
        });
      },
      error: () => {
        // Non-blocking - worst case the frontend just won't pre-disable fields (the
        // backend has its own independent 422 check either way).
      }
    });
  }

  /** @description Whether the given role (by id) forces 2FA - hardcoded role or forces_2fa. */
  private isRoleForced(roleId: number | string | undefined | null): boolean {
    if (roleId === undefined || roleId === null || roleId === '') return false;
    const meta = this.rolesMeta.get(Number(roleId));
    if (!meta) return false;
    return HARDCODED_FORCED_ROLE_NAMES.includes(meta.role_name) || meta.forces_2fa;
  }

  /**
   * @description Whether the given role (by id) may NEVER be blocked - UX
   * prefill/disable only, the real enforcement lives on the backend
   * (UserController::update()).
   */
  private isNeverBlockableRole(roleId: number | string | undefined | null): boolean {
    if (roleId === undefined || roleId === null || roleId === '') return false;
    const meta = this.rolesMeta.get(Number(roleId));
    return !!meta && NEVER_BLOCKABLE_ROLE_NAMES.includes(meta.role_name);
  }

  /**
   * @description Maps a role's permission_key list onto `permission_ids` option
   * VALUES (stringified permission ids) - used to pre-check & disable, in the
   * `permission_ids` multiselect, exactly the permissions the target role already
   * grants automatically. Purely a UX aid: the backend
   * (`UserController::applyExplicitPermissions()`) silently filters these out
   * regardless of what the client sends, this just avoids showing them as
   * unchecked/editable when they visually already apply.
   * @refactor-note (2026-09-05) BACKLOG "role/admin UX improvement".
   */
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
   * @description Whether the currently logged-in actor is allowed to assign the
   * given role - client-side mirror of `UserController::actorCanAssignRole()`, used
   * only to avoid offering roles in the `role_id` select that the backend would
   * reject anyway (403). Purely a UX filter - the backend re-checks this
   * independently and is the actual security boundary.
   * @refactor-note (2026-09-06) BACKLOG "who can change roles".
   */
  private isRoleAssignable(roleId: number | string | undefined | null): boolean {
    if (this.isSysadmin) return true;
    if (roleId === undefined || roleId === null || roleId === '') return false;

    const meta = this.rolesMeta.get(Number(roleId));
    if (!meta) return false;

    return meta.permissionKeys.every(key => this.permissionService.hasPermission(key));
  }

  /**
   * @description Derives which fields should actually show/disable in the form for
   * the given target role - see refactor-note in the header. `roleId` is `null` for
   * a new (not yet selected) role while creating an account.
   * @refactor-note (2026-09-05) Adds `disabledOptionValues` to the `permission_ids`
   * field - see rolePermissionOptionIds()/file header.
   * @refactor-note (2026-09-06) Adds assignable-role filtering to the `role_id`
   * field's own options for non-sysadmin actors - see isRoleAssignable()/file header.
   */
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
        // Pre-check & disable exactly what the role already grants automatically -
        // see rolePermissionOptionIds(). The field itself stays editable; only the
        // individual role-covered options are locked (form-builder renders this via
        // `disabledOptionValues`, see form-builder.component.html/.ts).
        return { ...f, disabledOptionValues: rolePermissionIds } as InputDefinition;
      }
      if (f.column_name === 'role_id' && !this.isSysadmin) {
        // Only offer roles the actor is themselves allowed to assign - see
        // isRoleAssignable(). The currently-assigned role is always kept in the
        // list even if the actor couldn't newly assign it, so an existing
        // assignment is never rendered blank.
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
    // No role is selected yet on create - forced=false, the override field is
    // hidden anyway (show_in_create: false in the config), enable_2fa is editable.
    // is_blocked has show_in_create: false, so it never appears on this form at all.
    this.visibleFormFields = this.computeFieldsForTarget(null);
    this.showCreateForm = true;
  }

  /**
   * @refactor-note (2026-09-05) `permission_ids` is now seeded with the UNION of the
   * account's own explicit grants (`user_permissions`) and the role's own grants
   * (`rolePermissionOptionIds()`) - the role's share is rendered pre-checked and
   * disabled by `computeFieldsForTarget()`'s `disabledOptionValues`, so it needs to
   * be present in the value for the checkbox to actually show checked.
   * @bugfix-note (2026-09-06) CRITICAL BUG: `item.user_permissions` is a flat array
   * of `permission_key` STRINGS (see `UserResource` - changed for readable display
   * in the details view), NOT `{id, permission_key}` objects. The previous
   * `.map((p: any) => String(p.id))` therefore always produced `"undefined"` for
   * every entry, so existing explicit grants NEVER rendered as pre-checked in the
   * edit form. Because `applyExplicitPermissions()` on the backend treats
   * `permission_ids` as the actor's COMPLETE desired set within their own authority
   * (sync, not merge - see its doc-comment), submitting the form with the old
   * grants invisibly unchecked silently WIPED them, even though the admin only
   * intended to ADD new ones. Fixed by resolving each `permission_key` string back
   * to its catalogue id via `permissionsCatalog` (already loaded by
   * `loadPermissionOptions()`), the same lookup direction already used elsewhere
   * (e.g. `rolePermissionOptionIds()`).
   */
  handleEditFormOpened(item: any): void {
    const itemToEdit = { ...item };
    if (itemToEdit.roles?.length > 0) itemToEdit.role_id = itemToEdit.roles[0].id;

    // permission_ids shown in the multiselect = the account's OWN explicit grants
    // UNION whatever the role already grants automatically (the role's share renders
    // pre-checked & disabled via computeFieldsForTarget()'s disabledOptionValues -
    // see rolePermissionOptionIds()).
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

    // A protected role must never appear blocked - even if the DB somehow still had
    // `is_blocked: true` (it shouldn't, the backend won't allow it), the form won't
    // show it checked, so it can't be accidentally resubmitted.
    if (this.isNeverBlockableRole(itemToEdit.role_id)) {
      itemToEdit.is_blocked = false;
    }

    this.formFieldOverrides = null;
    this.visibleFormFields = this.computeFieldsForTarget(itemToEdit.role_id, !!itemToEdit.two_fa_forced_by_admin);
    this.selectedItemForEdit = itemToEdit;
    this.showCreateForm = true;
  }

  /**
   * @description Reacts to a field changing LIVE inside the currently open form
   * (emitted by `FormBuilderComponent`'s generic `(fieldChanged)` output). Only
   * `role_id` changes are acted on here.
   *
   * When the role changes: `visibleFormFields` is recomputed for the newly selected
   * role (assignable role list, disabled permission options, 2FA/blockability
   * locks - the exact same computation used when the form first opens), and
   * `permission_ids` is force-reset, via `formFieldOverrides`, to exactly what the
   * NEW role covers (zero explicit extras) - mirroring the backend's unconditional
   * wipe-on-role-change rule in `UserController::update()`. This keeps what's
   * visibly checked in an already-open form honest with what submitting it would
   * actually persist, without requiring the admin to close and reopen the modal.
   * @refactor-note (2026-09-06) BACKLOG "who can change roles + role change UX/security".
   */
  handleFieldChanged(event: { columnName: string; value: any }): void {
    if (event.columnName !== 'role_id') return;

    const newRoleId = event.value !== '' && event.value !== null && event.value !== undefined
      ? Number(event.value)
      : null;

    this.visibleFormFields = this.computeFieldsForTarget(newRoleId, !!this.selectedItemForEdit?.two_fa_forced_by_admin);
    this.formFieldOverrides = { permission_ids: this.rolePermissionOptionIds(newRoleId) };
    this.cd.markForCheck();
  }

  /**
   * @description Submits user data.
   * (Earlier bugfix-notes about 2FA/is_blocked field re-evaluation on role change,
   * and about removing duplicate error toasts, are unchanged - see version history.)
   * @refactor-note (2026-09-02) `permission_ids` is normalized to an array of
   * numbers (the multiselect control may emit string values) right before send.
   * @refactor-note (2026-09-06) BACKLOG "role change UX/security": if the role
   * being submitted differs from the role the form was opened with, `permission_ids`
   * is forced to an empty array and the admin is shown an info notice - mirroring
   * the hard server-side rule in `UserController::update()`, which wipes ALL of the
   * account's explicit permission grants whenever the role assignment actually
   * changes, regardless of what this client sends. (In practice, thanks to
   * `handleFieldChanged()` above, the live form already reflects this before
   * submit - this remains as a safety net for any path that reaches submit without
   * having gone through that live recompute.)
   */
  handleFormSubmitted(formData: any): void {
    const payload = { ...formData };
    if (payload.role_id) payload.role_id = parseInt(payload.role_id, 10);

    const originalRoleId = this.selectedItemForEdit?.role_id !== undefined && this.selectedItemForEdit?.role_id !== null
      ? Number(this.selectedItemForEdit.role_id)
      : null;
    const roleChanged = !!payload.id && originalRoleId !== null && payload.role_id !== originalRoleId;

    if (roleChanged) {
      // Server wipes all explicit grants on role change unconditionally (see
      // UserController::update()) - reflect that here instead of sending stale
      // checkbox state that would be silently discarded anyway.
      payload.permission_ids = [];
      this.alertDialogService.open(
        this.t('role_changed_title'),
        this.t('role_changed_message'),
        'info'
      );
    } else if (Array.isArray(payload.permission_ids)) {
      // Strip out anything the SUBMITTED role already grants automatically - these
      // were only shown checked/disabled for display, they were never real explicit
      // grants (see handleEditFormOpened()/computeFieldsForTarget()).
      const roleIds = new Set(this.rolePermissionOptionIds(payload.role_id));
      payload.permission_ids = payload.permission_ids
        .filter((id: string | number) => !roleIds.has(String(id)))
        .map((id: string | number) => Number(id));
    } else {
      // Field wasn't touched / not present on this form - don't send it, so the
      // backend's "key absent = leave unchanged" convention applies consistently.
      delete payload.permission_ids;
    }

    // Non-editable fields must never be sent - even if formData carried a prefilled
    // display value (see handleEditFormOpened), sending it would silently write it
    // back on ANY unrelated edit. If the key is missing, the backend falls back to
    // the existing value ($validated['enable_2fa'] ?? $user->enable_2fa).
    const nonEditableFields = this.visibleFormFields
      .filter(f => f.editable === false)
      .map(f => f.column_name);
    nonEditableFields.forEach(key => delete payload[key]);

    // Re-evaluate "forced" against the role actually being submitted, not the role
    // the form opened with (see version history bugfix-note).
    const forcedNow = this.isRoleForced(payload.role_id);
    if (forcedNow) {
      delete payload.enable_2fa;
      delete payload.two_fa_forced_by_admin;
    }

    // Same principle for blocking - a NEVER_BLOCKABLE target role makes is_blocked meaningless.
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

  /**
   * @description Resends the activation e-mail for an account that has never been
   * activated. The `item.activated_at` check on the client is just quick feedback
   * without an unnecessary HTTP request - the backend
   * (`UserController::resendActivation()`) performs the same check independently,
   * so it cannot be bypassed by modifying the frontend.
   */
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

  // ── Email access policy modal (BACKLOG "core-admin-email-domain-restriction") ──────

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

  /** @description Whitelist split into two separate lists for clearer template display. */
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