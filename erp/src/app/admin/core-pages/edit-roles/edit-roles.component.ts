/**
 * @file edit-roles.component.ts
 * @path src/app/admin/web-pages/edit-roles/edit-roles.component.ts
 * @project RPSW Web
 * @author RPSW
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
 *
 * @refactor-note (2026) Dědí z BaseDataComponent<CoreRole> pro standardní CRUD nad `core/roles`
 *              (loadAllData/postData/updateData/deleteData -> EntityCrudService), stejně jako
 *              ostatní admin stránky. Načtení seznamu oprávnění (`core/permissions`) a
 *              synchronizace oprávnění role (`core/roles/{id}/permissions`) jdou mimo
 *              standardní CRUD sadu jednoho endpointu, proto tam voláme `this.dataHandler`
 *              přímo (stejný vzor jako updatePassword() v EntityCrudService).
 * @refactor-note (2026-08) Přidáno hromadné zaškrtnutí/odškrtnutí celé sekce (modulu)
 *              oprávnění najednou - "select all" checkbox v hlavičce sekce
 *              (isGroupFullyChecked/isGroupPartiallyChecked/toggleGroup), ať uživatel
 *              nemusí procházet každé oprávnění zvlášť, když chce roli dát/odebrat
 *              přístup k celé sekci (např. "celý Web").
 * @refactor-note (2026-08-7) DVOUÚROVŇOVÉ GRUPOVÁNÍ + VYHLEDÁVÁNÍ V OPRÁVNĚNÍCH. Po
 *              granularizaci permission systému (viz api.php 2026-08-5/6) narostl počet
 *              jednotlivých klíčů natolik, že plochý seznam pod modulem přestal být
 *              přehledný. Přidána DRUHÁ úroveň grupování - "zdroj" (resource) - odvozená
 *              ČISTĚ parsováním `permission_key` podle konvence `{modul}-{zdroj}-{akce}`
 *              (viz `parsePermissionKey()`). Přidáno samostatné vyhledávací pole
 *              (`permissionSearch`) filtrující checklist, nezávislé na hledání v seznamu
 *              ROLÍ (`roleSearch`).
 * @refactor-note (2026-08-8) INVALIDACE `RoleOptionsService` CACHE po každé mutaci role
 *              (create/rename/delete) - viz `AdministratorsComponent`, jejíž `role_id`
 *              select by jinak až 5 minut nabízel zastaralý seznam rolí.
 * @refactor-note (2026-08-10) TTL CACHE PRO TENTO SAMOTNÝ SCREEN (backlog: "zbytečně moc
 *              dotazů na API"). Tahle komponenta nikdy nevolala `initWithAuthCheck()` ani
 *              žádnou jinou cache infrastrukturu - `initializeRolesAndPermissions()` dělala
 *              vždy přímý síťový fetch při KAŽDÉM vstupu na stránku, bez ohledu na to, jak
 *              nedávno se to samé stalo (na rozdíl od všech ostatních admin stránek). Teď
 *              jde `core/permissions` (10 min TTL - seznam oprávnění se mění jen při
 *              vývoji, ne za běhu) i `core/roles` (2 min TTL) přes `ResourceCacheService`.
 *              KAŽDÁ mutace (createRole/saveDetails/savePermissions/confirmDelete) po
 *              úspěchu invaliduje `ROLES_CACHE_KEY` (a `RoleOptionsService`, viz
 *              2026-08-8 výše) - žádná akce tak neukáže sama sobě zastaralý stav.
 *              `core/permissions` se nikdy nemutuje z téhle stránky, proto se jeho cache
 *              nikdy neinvaliduje.
 * @dependencies
 * - BaseDataComponent: Standardní CRUD (create/update/delete/loadAll) nad apiEndpoint 'core/roles'.
 * - DataHandler: Přímé volání pro core/permissions a sync oprávnění (mimo EntityCrudService).
 * - ResourceCacheService: TTL cache pro seznam rolí i oprávnění (viz refactor-note výše).
 * - RoleOptionsService: Invalidace sdílené cache seznamu rolí po mutaci (AdministratorsComponent).
 * @note Access to this page/route is restricted to the 'sysadmin' role via sysadminGuard,
 *       independent of the regular permission-key system.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { RoleOptionsService } from '../../../core/services/role-options.service';

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
  users_count: number;
  permissions: string[];
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Jedna z rozpoznaných CRUD akcí na konci klíče - viz parsePermissionKey(). */
type PermissionAction = 'view' | 'create' | 'update' | 'delete';
const ACTION_SUFFIXES: PermissionAction[] = ['view', 'create', 'update', 'delete'];
const ACTION_ORDER: Record<PermissionAction, number> = { view: 0, create: 1, update: 2, delete: 3 };

/** Interní klíč (ne zobrazovaný) záchytné skupiny pro permissions bez rozpoznatelného vzoru. */
const GENERAL_RESOURCE_KEY = '__general__';
const GENERAL_RESOURCE_LABEL = 'Obecné';

/** Druhá úroveň grupování - jeden "zdroj" (resource) uvnitř modulu, např. "News". */
interface PermissionResourceGroup {
  resourceKey: string;
  resourceLabel: string;
  items: CorePermission[];
}

/** První úroveň grupování - jeden modul (Web/Core/E-shop), obsahuje své zdroje. */
interface PermissionModuleGroup {
  module: string;
  moduleLabel: string;
  resources: PermissionResourceGroup[];
}

/** Lidsky čitelné názvy modulů pro nadpisy sekcí v seznamu oprávnění. */
const MODULE_LABELS: Record<string, string> = {
  web: 'Web',
  shop: 'E-shop',
  core: 'Systém (Core)',
};

@Component({
  selector: 'app-edit-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-roles.component.html',
  styleUrl: './edit-roles.component.css',
})
export class EditRolesComponent extends BaseDataComponent<CoreRole> implements Core.OnInit {
  apiEndpoint = 'core/roles';

  private resourceCache = inject(ResourceCacheService);
  private readonly PERMISSIONS_CACHE_KEY = 'edit-roles:permissions';
  private readonly PERMISSIONS_TTL_MS = 10 * 60 * 1000;
  private readonly ROLES_CACHE_KEY = 'edit-roles:roles';
  private readonly ROLES_TTL_MS = 2 * 60 * 1000;

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

  /** Čitelnější alias nad zděděným `this.data` (pole rolí) - beze změny sémantiky. */
  get roles(): CoreRole[] { return this.data; }
  set roles(value: CoreRole[]) { this.data = value; }

  // ── Seznam rolí (levý panel) ──────────────────────────────────────────
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

  // ── Detail vybrané role (pravý panel) ─────────────────────────────────
  selectedRole: CoreRole | null = null;
  currentPermissions = new Set<string>();
  isPermissionsDirty = false;
  isSavingPermissions = false;

  isEditingDetails = false;
  draftName = '';
  draftDescription = '';
  isSavingDetails = false;

  // ── Formulář pro novou roli ─────────────────────────────────────────
  showNewRoleForm = false;
  newRoleName = '';
  newRoleDescription = '';
  isCreatingRole = false;
  newRoleError = '';

  // ── Potvrzovací modál pro smazání ───────────────────────────────────
  pendingDeleteRole: CoreRole | null = null;
  isDeletingRole = false;
  deleteError = '';

  // ── Vyhledávání v checklistu oprávnění ─────────────────────────────
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
              (p.description ?? '').toLowerCase().includes(term) ||
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
   * @description Načte seznam oprávnění přes TTL cache (viz refactor-note v hlavičce
   * souboru) - jde o statická data, která se mění jen při vývoji, ne za běhu, proto
   * dlouhá TTL a žádná invalidace odsud.
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
        this.alertDialogService.open('Chyba', 'Nepodařilo se načíst seznam oprávnění.', 'danger');
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Načte seznam rolí přes TTL cache (viz refactor-note v hlavičce
   * souboru). Pokud je zadaný `preferred` (id a/nebo role_name), po načtení se pokusí
   * vybrat PRÁVĚ TU roli místo automatického výběru první v poli - používá se ve
   * fallback větvích po uložení, kdy odpověď serveru nepřišla v očekávaném tvaru.
   * @param preferred Volitelně id a/nebo role_name role, která má zůstat vybraná.
   * @param force Bypass cache - voláno po každé úspěšné mutaci (create/update/delete role).
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
        this.alertDialogService.open('Chyba', 'Nepodařilo se načíst seznam rolí.', 'danger');
        this.cd.markForCheck();
      }
    });
  }

  // ── Parsování a grupování permission klíčů (modul -> zdroj) ───────────

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
      resourceLabel: GENERAL_RESOURCE_LABEL,
      action: null,
    };
  }

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
    return resources.sort((a, b) => {
      if (a.resourceLabel === GENERAL_RESOURCE_LABEL) return 1;
      if (b.resourceLabel === GENERAL_RESOURCE_LABEL) return -1;
      return a.resourceLabel.localeCompare(b.resourceLabel, 'cs');
    });
  }

  moduleLabel(module: string): string {
    return MODULE_LABELS[module] ?? module;
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

  // ── Výběr role v levém seznamu ─────────────────────────────────────────

  selectRole(role: CoreRole): void {
    if (this.isPermissionsDirty || this.isEditingDetails) {
      const confirmed = window.confirm('Máte neuložené změny u aktuální role. Přepnutím o ně přijdete. Pokračovat?');
      if (!confirmed) return;
    }

    this.selectedRole = role;
    this.currentPermissions = new Set(role.permissions);
    this.isPermissionsDirty = false;
    this.isEditingDetails = false;
    this.draftName = role.role_name;
    this.draftDescription = role.description ?? '';
    this.permissionSearch = '';
  }

  // ── Checklist oprávnění vybrané role ───────────────────────────────────

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
   * @description Uloží oprávnění role. Po úspěchu invaliduje cache seznamu rolí (obě
   * větve - `permissions[]` se mění, `RoleOptionsService` se netýká, protože ten cachuje
   * jen `id`/`role_name`, ne oprávnění).
   */
  savePermissions(): void {
    if (!this.selectedRole || this.selectedRole.is_protected || this.isSavingPermissions) return;

    const role = this.selectedRole;
    const keys = Array.from(this.currentPermissions);
    this.isSavingPermissions = true;

    this.dataHandler.put<CoreRole>(`core/roles/${role.id}/permissions`, { permission_keys: keys }).subscribe({
      next: (updated) => {
        this.isSavingPermissions = false;

        if (!updated || updated.id === undefined) {
          console.warn('[EditRolesComponent] PUT core/roles/{id}/permissions vrátil neočekávanou odpověď:', updated);
          this.isPermissionsDirty = false;
          this.alertDialogService.open('Uloženo', 'Oprávnění byla pravděpodobně uložena, ale odpověď serveru nebyla v očekávaném formátu. Obnovuji seznam ze serveru.', 'success');
          this.loadRoles({ id: role.id, name: role.role_name }, true);
          this.cd.markForCheck();
          return;
        }

        this.applyUpdatedRole(updated);
        this.isPermissionsDirty = false;
        this.resourceCache.invalidate(this.ROLES_CACHE_KEY);
        this.alertDialogService.open('Uloženo', `Oprávnění role "${updated.role_name}" byla aktualizována.`, 'success');
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isSavingPermissions = false;
        const message = err?.error?.message || 'Uložení oprávnění se nezdařilo.';
        this.alertDialogService.open('Chyba', message, 'danger');
        this.cd.markForCheck();
      }
    });
  }

  // ── Editace názvu / popisu vybrané role ────────────────────────────────

  startEditingDetails(): void {
    if (!this.selectedRole || this.selectedRole.is_protected) return;
    this.draftName = this.selectedRole.role_name;
    this.draftDescription = this.selectedRole.description ?? '';
    this.isEditingDetails = true;
  }

  cancelEditingDetails(): void {
    if (!this.selectedRole) return;
    this.draftName = this.selectedRole.role_name;
    this.draftDescription = this.selectedRole.description ?? '';
    this.isEditingDetails = false;
  }

  /**
   * @description Uloží název/popis role. Po úspěchu invaliduje cache seznamu rolí
   * i sdílenou `RoleOptionsService` cache (viz refactor-note 2026-08-8/10 v hlavičce
   * souboru) - `role_name` se mohl změnit.
   */
  saveDetails(): void {
    if (!this.selectedRole || this.selectedRole.is_protected || this.isSavingDetails) return;

    const name = this.draftName.trim();
    if (!name) {
      this.alertDialogService.open('Validace', 'Název role je povinný.', 'danger');
      return;
    }

    const payload: CoreRole = {
      role_name: name,
      description: this.draftDescription.trim() || null,
      is_protected: this.selectedRole.is_protected,
      users_count: this.selectedRole.users_count,
      permissions: this.selectedRole.permissions,
    };

    const roleId = this.selectedRole.id;
    this.isSavingDetails = true;

    this.updateData(this.selectedRole.id, payload).subscribe({
      next: (updated) => {
        this.isSavingDetails = false;

        if (!updated || updated.id === undefined) {
          console.warn('[EditRolesComponent] PUT core/roles/{id} vrátil neočekávanou odpověď:', updated);
          this.isEditingDetails = false;
          this.roleOptionsService.invalidate();
          this.alertDialogService.open('Uloženo', 'Údaje byly pravděpodobně uloženy, ale odpověď serveru nebyla v očekávaném formátu. Obnovuji seznam ze serveru.', 'success');
          this.loadRoles({ id: roleId, name }, true);
          this.cd.markForCheck();
          return;
        }

        this.applyUpdatedRole(updated);
        this.isEditingDetails = false;
        this.resourceCache.invalidate(this.ROLES_CACHE_KEY);
        this.roleOptionsService.invalidate();
        this.alertDialogService.open('Uloženo', 'Údaje role byly aktualizovány.', 'success');
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isSavingDetails = false;
        const message = err?.error?.message || 'Uložení údajů role se nezdařilo.';
        this.alertDialogService.open('Chyba', message, 'danger');
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

  // ── Vytvoření nové role ───────────────────────────────────────────────

  openNewRoleForm(): void {
    this.newRoleName = '';
    this.newRoleDescription = '';
    this.newRoleError = '';
    this.showNewRoleForm = true;
  }

  closeNewRoleForm(): void {
    this.showNewRoleForm = false;
  }

  /**
   * @description Vytvoří novou roli. Po úspěchu invaliduje cache seznamu rolí i sdílenou
   * `RoleOptionsService` cache (viz refactor-note 2026-08-8/10 v hlavičce souboru).
   */
  createRole(): void {
    const name = this.newRoleName.trim();
    if (!name) {
      this.newRoleError = 'Název role je povinný.';
      return;
    }

    this.isCreatingRole = true;
    this.newRoleError = '';

    const payload: CoreRole = {
      role_name: name,
      description: this.newRoleDescription.trim() || null,
      is_protected: false,
      users_count: 0,
      permissions: [],
    };

    this.postData(payload).subscribe({
      next: (created) => {
        this.isCreatingRole = false;

        if (!created || created.id === undefined) {
          console.warn('[EditRolesComponent] POST core/roles vrátil neočekávanou odpověď:', created);
          this.showNewRoleForm = false;
          this.roleOptionsService.invalidate();
          this.alertDialogService.open(
            'Vytvořeno',
            `Role "${name}" byla pravděpodobně vytvořena, ale odpověď serveru nebyla v očekávaném formátu. Obnovuji seznam ze serveru.`,
            'success'
          );
          this.loadRoles({ name }, true);
          this.cd.markForCheck();
          return;
        }

        this.roles = [...this.roles, created];
        this.showNewRoleForm = false;
        this.resourceCache.invalidate(this.ROLES_CACHE_KEY);
        this.roleOptionsService.invalidate();
        this.alertDialogService.open('Vytvořeno', `Role "${created.role_name}" byla vytvořena.`, 'success');
        this.selectRole(created);
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isCreatingRole = false;
        this.newRoleError = err?.error?.message
          || err?.error?.errors?.role_name?.[0]
          || 'Vytvoření role se nezdařilo.';
        this.cd.markForCheck();
      }
    });
  }

  // ── Smazání role ──────────────────────────────────────────────────────

  canDeleteRole(role: CoreRole): boolean {
    return !role.is_protected && role.users_count === 0;
  }

  deleteBlockedReason(role: CoreRole): string {
    if (role.is_protected) return 'Systémovou roli nelze smazat.';
    if (role.users_count > 0) return `Nelze smazat - role je přiřazena k ${role.users_count} uživatelskému účtu(ům).`;
    return '';
  }

  openDeleteConfirm(role: CoreRole): void {
    if (!this.canDeleteRole(role)) return;
    this.deleteError = '';
    this.pendingDeleteRole = role;
  }

  cancelDelete(): void {
    this.pendingDeleteRole = null;
    this.deleteError = '';
  }

  /**
   * @description Smaže roli. Po úspěchu invaliduje cache seznamu rolí i sdílenou
   * `RoleOptionsService` cache (viz refactor-note 2026-08-8/10 v hlavičce souboru).
   */
  confirmDelete(): void {
    const role = this.pendingDeleteRole;
    if (!role || this.isDeletingRole) return;

    this.isDeletingRole = true;
    this.deleteError = '';

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
        this.pendingDeleteRole = null;
        this.alertDialogService.open('Smazáno', `Role "${role.role_name}" byla smazána.`, 'success');
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isDeletingRole = false;
        this.deleteError = err?.error?.message || 'Smazání role se nezdařilo.';
        this.cd.markForCheck();
      }
    });
  }
}