/**
 * @file edit-roles.component.ts
 * @path src/app/admin/web-pages/edit-roles/edit-roles.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Role & permission management screen. Master-detail layout: a scrollable,
 *              searchable role list on the left, and the currently selected role's
 *              permission checklist (grouped by module, then by resource) on the right.
 *              This intentionally replaces an earlier "matrix" layout (all roles as
 *              columns) which does not scale once there are more than a handful of
 *              roles - the role list here can grow arbitrarily without affecting page
 *              width or readability.
 *              System roles (sysadmin/admin) are shown read-only - their name,
 *              description, and permissions cannot be changed here (enforced both in the UI
 *              and, as the source of truth, on the backend).
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { RoleOptionsService } from '../../../core/services/role-options.service';
import { ExportPopupBuilderComponent, ExportColumnOption, ExportSelection } from '../../components/builders/export-popup-builder/export-popup-builder.component';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

interface CorePermission {
  id: number;
  permission_key: string;
  description: string | null;
  module: string;
}

interface CoreRole {
  id?: number;
  role_name: string;
  description: string | null;
  is_protected: boolean;
  forces_2fa: boolean;
  users_count: number;
  permissions: string[];
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** One of the recognized CRUD actions at the end of the key - see parsePermissionKey(). */
type PermissionAction = 'view' | 'create' | 'update' | 'delete';
const ACTION_SUFFIXES: PermissionAction[] = ['view', 'create', 'update', 'delete'];
const ACTION_ORDER: Record<PermissionAction, number> = { view: 0, create: 1, update: 2, delete: 3 };

/** Internal (not displayed) key of the catch-all group for permissions without a recognizable pattern. */
const GENERAL_RESOURCE_KEY = '__general__';

/** Second grouping level - one resource inside a module, e.g. "News". */
interface PermissionResourceGroup {
  resourceKey: string;
  resourceLabel: string;
  items: CorePermission[];
}

/** First grouping level - one module (Web / Core / E-shop), holds its resources. */
interface PermissionModuleGroup {
  module: string;
  moduleLabel: string;
  resources: PermissionResourceGroup[];
}

/**
 * @description Map of the technical `module` key to the i18n path of its label - see
 * `moduleLabel()`. A new module value on the backend needs only an entry here + the matching
 * key in cz.json / en.json, no other logic.
 */
const MODULE_LABEL_KEYS: Record<string, string> = {
  web: 'module_web',
  shop: 'module_shop',
  'project-portal': 'module_project-portal',
  core: 'module_core',
};

@Component({
  selector: 'app-edit-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, ExportPopupBuilderComponent, PageHelpComponent],
  templateUrl: './edit-roles.component.html',
  styleUrls: ['../../shared-styles/theme.css', './edit-roles.component.css'],
})
export class EditRolesComponent extends BaseDataComponent<CoreRole> implements Core.OnInit {
  apiEndpoint = 'core/roles';
  protected override translationSection: string = 'edit-roles';

  private resourceCache = inject(ResourceCacheService);
  /** App confirmation dialog (replaces window.confirm, finding #48). */
  private confirmDialog = inject(ConfirmDialogService);
  private readonly PERMISSIONS_CACHE_KEY = 'edit-roles:permissions';
  private readonly PERMISSIONS_TTL_MS = 10 * 60 * 1000;
  private readonly ROLES_CACHE_KEY = 'edit-roles:roles';
  private readonly ROLES_TTL_MS = 2 * 60 * 1000;

  draftForcesTwoFa = false;
  newRoleForcesTwoFa = false;

  public override t(key: string): string {
    return this.i18n.getValue(`edit-roles.${key}`);
  }
  // ── Export ─────
  showExportPopup = false;
  isExporting = false;
  get exportColumnOptions(): ExportColumnOption[] { return this.getRoleExportColumns(); }

  constructor(
    dataHandler: Core.DataHandler,
    cd: Core.ChangeDetectorRef,
    genericTableService: Core.GenericTableService,
    private roleOptionsService: RoleOptionsService
  ) {
    super(dataHandler, cd, genericTableService);
  }

  isLoading = true;
  permissionGroups: PermissionModuleGroup[] = [];

  /** More readable alias of the inherited `this.data` (array of roles) - same semantics. */
  get roles(): CoreRole[] { return this.data; }
  set roles(value: CoreRole[]) { this.data = value; }

  // ── Role list (left panel) ──────────────────────────────────────────
  roleSearch = '';

  get filteredRoles(): CoreRole[] {
    const source = (this.roles ?? []).filter((r): r is CoreRole => !!r);
    const term = this.roleSearch.trim().toLowerCase();
    if (!term) return source;
    return source.filter(r =>
      r.role_name.toLowerCase().includes(term) ||
      (r.description ?? '').toLowerCase().includes(term)
    );
  }

  trackByRoleId(_index: number, role: CoreRole): number | undefined {
    return role?.id;
  }

  /**
   * @description Description of a permission in the admin language - the translation of the
   *   `permission-descriptions` section, else the stored (English) description.
   * @param perm Permission row.
   * @returns The description, '' when there is none.
   */
  permissionDescription(perm: CorePermission): string {
    const translated = this.i18n.getMergedSection('permission-descriptions')[perm.permission_key];
    return typeof translated === 'string' ? translated : (perm.description ?? '');
  }

  /**
   * @description Inflects "N user / users" (or the Czech equivalent) by the count - the JSON
   * ALWAYS carries 4 forms (`users_zero/one/few/many`); languages without the Czech 3-form
   * pluralization (e.g. English) simply have identical `few` / `many`.
   * Czech rule: 0 -> many, 1 -> one, 2-4 -> few, 5+ -> many.
   */
  usersCountLabel(count: number): string {
    let key: string;
    if (count === 0) key = 'users_zero';
    else if (count === 1) key = 'users_one';
    else if (count >= 2 && count <= 4) key = 'users_few';
    else key = 'users_many';
    return `${count} ${this.t(key)}`;
  }

  // ── Detail of the selected role (right panel) ─────────────────────────────────
  selectedRole: CoreRole | null = null;
  currentPermissions = new Set<string>();
  isPermissionsDirty = false;
  isSavingPermissions = false;

  isEditingDetails = false;
  draftName = '';
  draftDescription = '';
  isSavingDetails = false;

  // ── New role form ─────────────────────────────────────────
  showNewRoleForm = false;
  newRoleName = '';
  newRoleDescription = '';
  isCreatingRole = false;
  newRoleError = '';

  // ── Role deletion (standard confirm dialog) ──────────────
  isDeletingRole = false;

  // ── Search in the permission checklist ─────────────────────────────
  permissionSearch = '';

  get visiblePermissionGroups(): PermissionModuleGroup[] {
    const term = this.permissionSearch.trim().toLowerCase();
    if (!term) return this.permissionGroups;

    return this.permissionGroups
      .map(group => ({
        ...group,
        resources: group.resources
          .map(resource => ({
            ...resource,
            items: resource.items.filter(p =>
              p.permission_key.toLowerCase().includes(term) ||
              this.permissionDescription(p).toLowerCase().includes(term) ||
              resource.resourceLabel.toLowerCase().includes(term)
            ),
          }))
          .filter(resource => resource.items.length > 0),
      }))
      .filter(group => group.resources.length > 0);
  }

  override ngOnInit(): void {
    this.initializeRolesAndPermissions();
  }

  /**
   * @description Loads the permission list through the TTL cache - static data that changes only
   * during development, not at runtime, hence the long TTL and no invalidation from here.
   */
  private initializeRolesAndPermissions(): void {
    this.isLoading = true;

    this.resourceCache.get(
      this.PERMISSIONS_CACHE_KEY,
      () => this.dataHandler.get<CorePermission[]>('core/permissions'),
      this.PERMISSIONS_TTL_MS
    ).subscribe({
      next: (permissions) => {
        this.permissionGroups = this.buildPermissionGroups(permissions || []);
        this.loadRoles();
      },
      error: () => {
        this.isLoading = false;
        this.alertDialogService.open(this.t('error_title'), this.t('load_permissions_error'), 'danger');
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Loads the role list through the TTL cache. When `preferred` (id and / or
   * role_name) is given, tries to select EXACTLY that role after the load instead of the first
   * one of the array - used in the fallback branches after saving, when the server response did
   * not have the expected shape.
   * @param preferred Optional id and / or role_name of the role that should stay selected.
   * @param force Bypass cache - called after every successful mutation (create / update / delete role).
   */
  private loadRoles(preferred?: { id?: number; name?: string }, force: boolean = false): void {
    if (force) {
      this.resourceCache.invalidate(this.ROLES_CACHE_KEY);
    }

    this.resourceCache.get(
      this.ROLES_CACHE_KEY,
      () => this.loadAllData(),
      this.ROLES_TTL_MS
    ).subscribe({
      next: (roles) => {
        this.roles = (roles || []).filter((r): r is CoreRole => !!r);
        this.isLoading = false;

        const preferredRole = this.roles.find(r =>
          (preferred?.id !== undefined && r.id === preferred.id) ||
          (preferred?.name !== undefined && r.role_name === preferred.name)
        );

        if (preferredRole) {
          this.selectRole(preferredRole);
        } else if (this.roles.length > 0) {
          this.selectRole(this.roles[0]);
        }
        this.cd.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.alertDialogService.open(this.t('error_title'), this.t('load_roles_error'), 'danger');
        this.cd.markForCheck();
      }
    });
  }

  // ── Parsing and grouping of permission keys (module -> resource) ───────────

  private parsePermissionKey(perm: CorePermission): { resourceKey: string; resourceLabel: string; action: PermissionAction | null } {
    const key = perm.permission_key;
    const modulePrefix = `${perm.module}-`;
    const residual = key.startsWith(modulePrefix) ? key.slice(modulePrefix.length) : key;

    for (const action of ACTION_SUFFIXES) {
      const suffix = `-${action}`;
      if (residual.endsWith(suffix) && residual.length > suffix.length) {
        const rawResource = residual.slice(0, -suffix.length);
        return {
          resourceKey: `${perm.module}:${rawResource}`,
          resourceLabel: this.humanizeResourceKey(rawResource),
          action,
        };
      }
    }

    return {
      resourceKey: `${perm.module}:${GENERAL_RESOURCE_KEY}`,
      resourceLabel: this.t('general_resource_label'),
      action: null,
    };
  }

  /**
   * @description Derives a fallback label from the technical permission_key algorithmically
   * (e.g. "edit-website" -> "Edit Website"). NOT translated on purpose.
   */
  private humanizeResourceKey(rawResource: string): string {
    return rawResource
      .split('-')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private buildPermissionGroups(permissions: CorePermission[]): PermissionModuleGroup[] {
    const moduleMap = new Map<string, Map<string, PermissionResourceGroup>>();

    for (const perm of permissions) {
      const moduleKey = perm.module || 'core';
      const { resourceKey, resourceLabel } = this.parsePermissionKey(perm);

      if (!moduleMap.has(moduleKey)) moduleMap.set(moduleKey, new Map());
      const resourceMap = moduleMap.get(moduleKey)!;

      if (!resourceMap.has(resourceKey)) {
        resourceMap.set(resourceKey, { resourceKey, resourceLabel, items: [] });
      }
      resourceMap.get(resourceKey)!.items.push(perm);
    }

    const groups: PermissionModuleGroup[] = Array.from(moduleMap.entries()).map(([module, resourceMap]) => ({
      module,
      moduleLabel: this.moduleLabel(module),
      resources: this.sortResourceGroups(Array.from(resourceMap.values())),
    }));

    groups.forEach(group => {
      group.resources.forEach(resource => {
        resource.items.sort((a, b) => {
          const parsedA = this.parsePermissionKey(a).action;
          const parsedB = this.parsePermissionKey(b).action;
          if (parsedA && parsedB) return ACTION_ORDER[parsedA] - ACTION_ORDER[parsedB];
          return a.permission_key.localeCompare(b.permission_key, 'cs');
        });
      });
    });

    return groups;
  }

  private sortResourceGroups(resources: PermissionResourceGroup[]): PermissionResourceGroup[] {
    const generalLabel = this.t('general_resource_label');
    return resources.sort((a, b) => {
      if (a.resourceLabel === generalLabel) return 1;
      if (b.resourceLabel === generalLabel) return -1;
      return a.resourceLabel.localeCompare(b.resourceLabel, 'cs');
    });
  }

  moduleLabel(module: string): string {
    const key = MODULE_LABEL_KEYS[module];
    return key ? this.t(key) : module;
  }

  trackByModule(_index: number, group: PermissionModuleGroup): string {
    return group.module;
  }

  trackByResourceKey(_index: number, resource: PermissionResourceGroup): string {
    return resource.resourceKey;
  }

  trackByPermKey(_index: number, perm: CorePermission): number {
    return perm.id;
  }

  // ── Role selection in the left list ─────────────────────────────────────────

  /**
   * @description Shows a role in the editor; with unsaved changes the user is asked first.
   * @param role Role from the list.
   * @returns Promise settled after the (optional) confirmation.
   */
  async selectRole(role: CoreRole): Promise<void> {
    if (this.isPermissionsDirty || this.isEditingDetails) {
      const confirmed = await this.confirmDialog.open(this.t('confirm_unsaved_switch_title'), this.t('confirm_unsaved_switch'));
      if (!confirmed) return;
    }

    this.selectedRole = role;
    this.currentPermissions = new Set(role.permissions);
    this.isPermissionsDirty = false;
    this.isEditingDetails = false;
    this.draftName = role.role_name;
    this.draftDescription = role.description ?? '';
    this.draftForcesTwoFa = !!role.forces_2fa;
    this.permissionSearch = '';
  }

  // ── Permission checklist of the selected role ───────────────────────────────────

  isChecked(permissionKey: string): boolean {
    return this.currentPermissions.has(permissionKey);
  }

  togglePermission(permissionKey: string): void {
    if (!this.selectedRole || this.selectedRole.is_protected) return;

    if (this.currentPermissions.has(permissionKey)) {
      this.currentPermissions.delete(permissionKey);
    } else {
      this.currentPermissions.add(permissionKey);
    }
    this.isPermissionsDirty = true;
  }

  discardPermissionChanges(): void {
    if (!this.selectedRole) return;
    this.currentPermissions = new Set(this.selectedRole.permissions);
    this.isPermissionsDirty = false;
  }

  private moduleItems(group: PermissionModuleGroup): CorePermission[] {
    return group.resources.flatMap(r => r.items);
  }

  isModuleFullyChecked(group: PermissionModuleGroup): boolean {
    const items = this.moduleItems(group);
    return items.length > 0 && items.every(p => this.currentPermissions.has(p.permission_key));
  }

  isModulePartiallyChecked(group: PermissionModuleGroup): boolean {
    const items = this.moduleItems(group);
    const checkedCount = items.filter(p => this.currentPermissions.has(p.permission_key)).length;
    return checkedCount > 0 && checkedCount < items.length;
  }

  toggleModuleGroup(group: PermissionModuleGroup): void {
    if (!this.selectedRole || this.selectedRole.is_protected) return;

    const items = this.moduleItems(group);
    const shouldCheckAll = !this.isModuleFullyChecked(group);

    items.forEach(perm => {
      if (shouldCheckAll) {
        this.currentPermissions.add(perm.permission_key);
      } else {
        this.currentPermissions.delete(perm.permission_key);
      }
    });

    this.isPermissionsDirty = true;
  }

  isResourceFullyChecked(resource: PermissionResourceGroup): boolean {
    return resource.items.length > 0 && resource.items.every(p => this.currentPermissions.has(p.permission_key));
  }

  isResourcePartiallyChecked(resource: PermissionResourceGroup): boolean {
    const checkedCount = resource.items.filter(p => this.currentPermissions.has(p.permission_key)).length;
    return checkedCount > 0 && checkedCount < resource.items.length;
  }

  toggleResourceGroup(resource: PermissionResourceGroup): void {
    if (!this.selectedRole || this.selectedRole.is_protected) return;

    const shouldCheckAll = !this.isResourceFullyChecked(resource);

    resource.items.forEach(perm => {
      if (shouldCheckAll) {
        this.currentPermissions.add(perm.permission_key);
      } else {
        this.currentPermissions.delete(perm.permission_key);
      }
    });

    this.isPermissionsDirty = true;
  }

  /**
   * @description Saves the permissions of the role. Invalidates the role list cache on success.
   */
  savePermissions(): void {
    if (!this.selectedRole || this.selectedRole.is_protected || this.isSavingPermissions) return;

    const role = this.selectedRole;
    const keys = Array.from(this.currentPermissions);
    this.isSavingPermissions = true;

    this.dataHandler.put<CoreRole>(`core/roles/${role.id}/permissions`, { permission_keys: keys }).subscribe({
      next: () => {
        this.isSavingPermissions = false;
        const updated: CoreRole = { ...role, permissions: keys };
        this.applyUpdatedRole(updated);
        this.isPermissionsDirty = false;
        this.resourceCache.invalidate(this.ROLES_CACHE_KEY);
        this.alertDialogService.open(this.t('success_title'), this.t('save_permissions_success').replace('{name}', role.role_name), 'success');
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isSavingPermissions = false;
        const message = err?.error?.message || this.t('save_permissions_error');
        this.alertDialogService.open(this.t('error_title'), message, 'danger');
        this.cd.markForCheck();
      }
    });
  }

  // ── Editing the name / description of the selected role ────────────────────────────────

  startEditingDetails(): void {
    if (!this.selectedRole || this.selectedRole.is_protected) return;
    this.draftName = this.selectedRole.role_name;
    this.draftDescription = this.selectedRole.description ?? '';
    this.draftForcesTwoFa = !!this.selectedRole.forces_2fa;
    this.isEditingDetails = true;
  }

  cancelEditingDetails(): void {
    if (!this.selectedRole) return;
    this.draftName = this.selectedRole.role_name;
    this.draftDescription = this.selectedRole.description ?? '';
    this.draftForcesTwoFa = !!this.selectedRole.forces_2fa;
    this.isEditingDetails = false;
  }

  /**
   * @description Saves the name / description of the role. Invalidates the role list cache and
   * the shared `RoleOptionsService` cache on success.
   */
  saveDetails(): void {
    if (!this.selectedRole || this.selectedRole.is_protected || this.isSavingDetails) return;

    const name = this.draftName.trim();
    if (!name) {
      this.alertDialogService.open(this.t('validation_title'), this.t('role_name_required'), 'danger');
      return;
    }

    const payload: CoreRole = {
      role_name: name,
      description: this.draftDescription.trim() || null,
      is_protected: this.selectedRole.is_protected,
      forces_2fa: this.draftForcesTwoFa,
      users_count: this.selectedRole.users_count,
      permissions: this.selectedRole.permissions,
    };

    const roleId = this.selectedRole.id;
    this.isSavingDetails = true;

    this.updateData(this.selectedRole.id, payload).subscribe({
      next: () => {
        this.isSavingDetails = false;
        const updated: CoreRole = { id: roleId, ...payload };
        this.applyUpdatedRole(updated);
        this.isEditingDetails = false;
        this.resourceCache.invalidate(this.ROLES_CACHE_KEY);
        this.roleOptionsService.invalidate();
        this.alertDialogService.open(this.t('success_title'), this.t('save_details_success'), 'success');
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isSavingDetails = false;
        const message = err?.error?.message || this.t('save_details_error');
        this.alertDialogService.open(this.t('error_title'), message, 'danger');
        this.cd.markForCheck();
      }
    });
  }

  private applyUpdatedRole(updated: CoreRole): void {
    const index = this.roles.findIndex(r => r.id === updated.id);
    if (index !== -1) {
      this.roles[index] = updated;
    }
    if (this.selectedRole?.id === updated.id) {
      this.selectedRole = updated;
    }
  }

  // ── Creating a new role ───────────────────────────────────────────────

  openNewRoleForm(): void {
    this.newRoleName = '';
    this.newRoleDescription = '';
    this.newRoleForcesTwoFa = false;
    this.newRoleError = '';
    this.showNewRoleForm = true;
  }

  closeNewRoleForm(): void {
    this.showNewRoleForm = false;
  }

  /**
   * @description Creates a new role. Invalidates the role list cache and the shared
   * `RoleOptionsService` cache on success.
   */
  createRole(): void {
    const name = this.newRoleName.trim();
    if (!name) {
      this.newRoleError = this.t('new_role_name_required');
      return;
    }

    this.isCreatingRole = true;
    this.newRoleError = '';

    const payload: CoreRole = {
      role_name: name,
      description: this.newRoleDescription.trim() || null,
      is_protected: false,
      forces_2fa: this.newRoleForcesTwoFa,
      users_count: 0,
      permissions: [],
    };
    this.postData(payload).subscribe({
      next: () => {
        this.isCreatingRole = false;
        this.showNewRoleForm = false;
        this.roleOptionsService.invalidate();
        this.alertDialogService.open(this.t('created_title'), this.t('role_created_success').replace('{name}', name), 'success');
        this.loadRoles({ name }, true);
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isCreatingRole = false;
        this.newRoleError = err?.error?.message
          || err?.error?.errors?.role_name?.[0]
          || this.t('role_create_error');
        this.cd.markForCheck();
      }
    });
  }

  // ── Role deletion ──────────────────────────────────────────────────────

  canDeleteRole(role: CoreRole): boolean {
    return !role.is_protected && role.users_count === 0;
  }

  deleteBlockedReason(role: CoreRole): string {
    if (role.is_protected) return this.t('delete_blocked_system');
    if (role.users_count > 0) return this.t('delete_blocked_users').replace('{count}', String(role.users_count));
    return '';
  }

  /**
   * @description Asks with the standard admin confirm dialog and deletes the role. After success
   *   the role-list cache and the shared `RoleOptionsService` cache are invalidated.
   * @param role Role to delete (a role that cannot be deleted is ignored).
   * @returns Promise settled after the dialog (the delete request runs on).
   */
  async openDeleteConfirm(role: CoreRole): Promise<void> {
    if (!this.canDeleteRole(role) || this.isDeletingRole) return;

    const message = `${this.t('delete_modal_confirm_text').replace('{name}', role.role_name)} ${this.t('delete_modal_warning')}`;
    const confirmed = await this.confirmDialog.open(this.t('delete_modal_title'), message, {
      confirm: this.t('btn_confirm_delete'),
      cancel: this.t('btn_cancel'),
    });
    if (!confirmed) return;

    this.isDeletingRole = true;
    this.cd.markForCheck();
    this.deleteData(role.id).subscribe({
      next: () => {
        this.isDeletingRole = false;
        this.roles = this.roles.filter(r => !!r && r.id !== role.id);
        this.resourceCache.invalidate(this.ROLES_CACHE_KEY);
        this.roleOptionsService.invalidate();
        if (this.selectedRole?.id === role.id) {
          this.selectedRole = null;
          this.currentPermissions = new Set();
          this.isPermissionsDirty = false;
          if (this.roles.length > 0) this.selectRole(this.roles[0]);
        }
        this.alertDialogService.open(this.t('deleted_title'), this.t('role_deleted_success').replace('{name}', role.role_name), 'success');
        this.cd.markForCheck();
      },
      error: () => {
        this.isDeletingRole = false;
        this.cd.markForCheck();
      }
    });
  }

  // ── Export do CSV/XLSX/JSON/TXT ───────────────────────────────────────

  /**
   * @description Columns offered in the export popup - EditRolesComponent is NOT a
   * `TableBuilderComponent`, so it builds the file itself (see `buildExportRows()` /
   * `downloadExportFile()` below), but reuses the same `ExportPopupBuilderComponent` (format
   * picker) as the rest of the admin. `permissions` is the only field that is not a plain string
   * on `CoreRole` - see `getExportValue()`.
   */
  private getRoleExportColumns(): ExportColumnOption[] {
    return [
      { key: 'role_name', label: this.t('export_col_role_name') },
      { key: 'description', label: this.t('export_col_description') },
      { key: 'is_protected', label: this.t('export_col_is_protected') },
      { key: 'forces_2fa', label: this.t('export_col_forces_2fa') },
      { key: 'users_count', label: this.t('export_col_users_count') },
      { key: 'permissions', label: this.t('export_col_permissions') },
    ];
  }

  /** @description `this.roles` is ALWAYS complete (see `loadAllData()` / `loadRoles()` above - no pagination) - the export always covers all roles, not only the shown page. */
  openExportPopup(): void {
    if (this.roles.length === 0) {
      this.alertDialogService.open(this.t('btn_export'), this.t('export_empty_error'), 'danger');
      return;
    }
    this.showExportPopup = true;
    this.cd.markForCheck();
  }

  closeExportPopup(): void {
    if (this.isExporting) return;
    this.showExportPopup = false;
    this.cd.markForCheck();
  }

  /**
   * @description `columnKeys` is `null` when the caller (`ExportPopupBuilderComponent`) got no
   * `[columns]` - cannot happen here (the export columns are never empty), handled defensively
   * like in `TableBuilderComponent`.
   */
  handleExportFormatSelected(selection: ExportSelection): void {
    const columns = this.getRoleExportColumns();
    const keys = selection.columnKeys ?? columns.map(c => c.key);
    this.isExporting = true;
    this.cd.markForCheck();

    try {
      const rows = this.buildExportRows(keys);
      const labels = keys.map(k => columns.find(c => c.key === k)?.label ?? k);
      const filename = `${this.t('export_filename_prefix')}-${new Date().toISOString().slice(0, 10)}`;

      switch (selection.format) {
        case 'csv': this.downloadCsv(rows, labels, filename); break;
        case 'txt': this.downloadTxt(rows, labels, filename); break;
        case 'json': this.downloadJson(keys, labels, rows, filename); break;
        case 'xlsx': this.downloadXlsx(rows, labels, filename); break;
      }

      this.logExport(selection.format);
      this.showExportPopup = false;
    } catch {
      this.alertDialogService.open(this.t('error_title'), this.t('export_generic_error'), 'danger');
    } finally {
      this.isExporting = false;
      this.cd.markForCheck();
    }
  }

  /**
   * @description Lets the server audit the export (finding #49 - exporting the roles left no
   *   trace): the role list is requested with `export=<format>`, the server logs what it served
   *   (api LogDataExport) - the browser writes no log. A failed request only goes to the console.
   * @param format Export format.
   */
  private logExport(format: string): void {
    this.dataHandler.getCollection<CoreRole>(this.apiEndpoint, { no_pagination: 'true', export: format })
      .subscribe({ error: (err) => console.error('Failed to log export:', err) });
  }

  /** @description Returns an array of rows (arrays of strings in the order of `keys`) - one item = one role. */
  private buildExportRows(keys: string[]): string[][] {
    return this.roles.map(role => keys.map(key => this.getExportValue(role, key)));
  }

  /**
   * @description Formats one value for the export - `permissions` (array of keys) are joined with
   * a semicolon (typically dozens, they make no sense as separate columns), booleans become
   * Yes / No in the current admin language (more readable in Excel than 1/0/true/false).
   */
  private getExportValue(role: CoreRole, key: string): string {
    if (key === 'permissions') return (role.permissions ?? []).join('; ');
    if (key === 'is_protected' || key === 'forces_2fa') {
      return (role as any)[key] ? this.t('export_bool_yes') : this.t('export_bool_no');
    }
    const value = (role as any)[key];
    return value === null || value === undefined ? '' : String(value);
  }

  private escapeCsvValue(value: string): string {
    if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }

  private downloadCsv(rows: string[][], labels: string[], filename: string): void {
    const lines = [labels, ...rows].map(line => line.map(v => this.escapeCsvValue(v)).join(','));
    this.triggerDownload(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
  }

  private downloadTxt(rows: string[][], labels: string[], filename: string): void {
    const lines = [labels, ...rows].map(line => line.join('\t'));
    this.triggerDownload(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' }), `${filename}.txt`);
  }

  private downloadJson(keys: string[], labels: string[], rows: string[][], filename: string): void {
    const objects = rows.map(row => {
      const obj: Record<string, string> = {};
      keys.forEach((key, i) => { obj[key] = row[i]; });
      return obj;
    });
    this.triggerDownload(new Blob([JSON.stringify(objects, null, 2)], { type: 'application/json;charset=utf-8;' }), `${filename}.json`);
  }

  private downloadXlsx(rows: string[][], labels: string[], filename: string): void {
    const worksheet = XLSX.utils.aoa_to_sheet([labels, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, this.t('export_sheet_name'));
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}