/**
 * @file edit-roles.component.ts
 * @path src/app/admin/web-pages/edit-roles/edit-roles.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Role & permission management screen. Master-detail layout: a scrollable,
 *              searchable role list on the left, and the currently selected role's
 *              permission checklist (grouped by module) on the right. This intentionally
 *              replaces an earlier "matrix" layout (all roles as columns) which does not
 *              scale once there are more than a handful of roles - the role list here can
 *              grow arbitrarily without affecting page width or readability.
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
 * @dependencies
 * - BaseDataComponent: Standardní CRUD (create/update/delete/loadAll) nad apiEndpoint 'core/roles'.
 * - DataHandler: Přímé volání pro core/permissions a sync oprávnění (mimo EntityCrudService).
 * @note Access to this page/route is restricted to the 'sysadmin' role via sysadminGuard,
 *       independent of the regular permission-key system.
 */

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';

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

interface PermissionGroup {
  module: string;
  items: CorePermission[];
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

  constructor(
    dataHandler: Core.DataHandler,
    cd: Core.ChangeDetectorRef,
    genericTableService: Core.GenericTableService
  ) {
    super(dataHandler, cd, genericTableService);
  }

  isLoading = true;
  permissionGroups: PermissionGroup[] = [];

  /** Čitelnější alias nad zděděným `this.data` (pole rolí) - beze změny sémantiky. */
  get roles(): CoreRole[] { return this.data; }
  set roles(value: CoreRole[]) { this.data = value; }

  // ── Seznam rolí (levý panel) ──────────────────────────────────────────
  roleSearch = '';

  get filteredRoles(): CoreRole[] {
    // Defenzivní filtr: i kdyby se do pole nějak dostala null/undefined položka
    // (např. kvůli dočasně nekonzistentnímu stavu během async operací), *ngFor
    // ji nikdy neuvidí - šablona pak nemůže spadnout na "role is undefined".
    const source = (this.roles ?? []).filter((r): r is CoreRole => !!r);

    const term = this.roleSearch.trim().toLowerCase();
    if (!term) return source;

    return source.filter(r =>
      r.role_name.toLowerCase().includes(term) ||
      (r.description ?? '').toLowerCase().includes(term)
    );
  }

  /** trackBy pro *ngFor - páruje řádky podle id, ne podle pozice v poli. */
  trackByRoleId(_index: number, role: CoreRole): number | undefined {
    return role?.id;
  }

  // ── Detail vybrané role (pravý panel) ─────────────────────────────────
  selectedRole: CoreRole | null = null;

  /** Rozpracovaná (dosud neuložená) sada oprávnění pro AKTUÁLNĚ vybranou roli. */
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

  override ngOnInit(): void {
    this.initializeRolesAndPermissions();
  }

  private initializeRolesAndPermissions(): void {
    this.isLoading = true;

    // Seznam oprávnění je mimo standardní CRUD jednoho apiEndpointu, voláno přímo.
    this.dataHandler.get<CorePermission[]>('core/permissions').subscribe({
      next: (permissions) => {
        this.permissionGroups = this.groupPermissionsByModule(permissions || []);
        this.loadRoles();
      },
      error: () => {
        this.isLoading = false;
        this.alertDialogService.open('Chyba', 'Nepodařilo se načíst seznam oprávnění.', 'danger');
        this.cd.markForCheck();
      }
    });
  }

  private loadRoles(): void {
    // loadAllData() -> EntityCrudService.loadAll() -> GET core/roles?no_pagination=true
    this.loadAllData().subscribe({
      next: (roles) => {
        this.roles = (roles || []).filter((r): r is CoreRole => !!r);
        this.isLoading = false;
        // Pohodlný default: rovnou vybereme první roli, ať uživatel hned něco vidí v detailu.
        if (this.roles.length > 0) {
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

  private groupPermissionsByModule(permissions: CorePermission[]): PermissionGroup[] {
    const groups = new Map<string, CorePermission[]>();
    for (const p of permissions) {
      const key = p.module || 'core';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return Array.from(groups.entries()).map(([module, items]) => ({ module, items }));
  }

  moduleLabel(module: string): string {
    return MODULE_LABELS[module] ?? module;
  }

  // ── Výběr role v levém seznamu ─────────────────────────────────────────

  selectRole(role: CoreRole): void {
    if (this.isPermissionsDirty || this.isEditingDetails) {
      // Ochrana proti tichému zahození rozpracovaných změn při přepnutí role.
      const confirmed = window.confirm('Máte neuložené změny u aktuální role. Přepnutím o ně přijdete. Pokračovat?');
      if (!confirmed) return;
    }

    this.selectedRole = role;
    this.currentPermissions = new Set(role.permissions);
    this.isPermissionsDirty = false;
    this.isEditingDetails = false;
    this.draftName = role.role_name;
    this.draftDescription = role.description ?? '';
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

  savePermissions(): void {
    if (!this.selectedRole || this.selectedRole.is_protected || this.isSavingPermissions) return;

    const role = this.selectedRole;
    const keys = Array.from(this.currentPermissions);
    this.isSavingPermissions = true;

    // Sub-akce mimo EntityCrudService (viz @refactor-note) - přímé volání dataHandleru.
    this.dataHandler.put<CoreRole>(`core/roles/${role.id}/permissions`, { permission_keys: keys }).subscribe({
      next: (updated) => {
        this.isSavingPermissions = false;

        if (!updated || updated.id === undefined) {
          console.warn('[EditRolesComponent] PUT core/roles/{id}/permissions vrátil neočekávanou odpověď:', updated);
          this.isPermissionsDirty = false;
          this.alertDialogService.open('Uloženo', 'Oprávnění byla pravděpodobně uložena, ale odpověď serveru nebyla v očekávaném formátu. Obnovuji seznam ze serveru.', 'success');
          this.loadRoles();
          this.cd.markForCheck();
          return;
        }

        this.applyUpdatedRole(updated);
        this.isPermissionsDirty = false;
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

    this.isSavingDetails = true;

    // updateData() -> EntityCrudService.update() -> PUT core/roles/{id}
    this.updateData(this.selectedRole.id, payload).subscribe({
      next: (updated) => {
        this.isSavingDetails = false;

        if (!updated || updated.id === undefined) {
          console.warn('[EditRolesComponent] PUT core/roles/{id} vrátil neočekávanou odpověď:', updated);
          this.isEditingDetails = false;
          this.alertDialogService.open('Uloženo', 'Údaje byly pravděpodobně uloženy, ale odpověď serveru nebyla v očekávaném formátu. Obnovuji seznam ze serveru.', 'success');
          this.loadRoles();
          this.cd.markForCheck();
          return;
        }

        this.applyUpdatedRole(updated);
        this.isEditingDetails = false;
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

    // postData() -> EntityCrudService.create() -> POST core/roles
    this.postData(payload).subscribe({
      next: (created) => {
        this.isCreatingRole = false;

        if (!created || created.id === undefined) {
          // Backend odpověděl bez těla/neplatným tělem - nespoléháme na obsah `created`,
          // radši roli dohledáme čerstvě ze serveru, ať UI zůstane konzistentní.
          console.warn('[EditRolesComponent] POST core/roles vrátil neočekávanou odpověď:', created);
          this.showNewRoleForm = false;
          this.alertDialogService.open(
            'Vytvořeno',
            `Role "${name}" byla pravděpodobně vytvořena, ale odpověď serveru nebyla v očekávaném formátu. Obnovuji seznam ze serveru.`,
            'success'
          );
          this.loadRoles();
          this.cd.markForCheck();
          return;
        }

        this.roles = [...this.roles, created];
        this.showNewRoleForm = false;
        this.alertDialogService.open('Vytvořeno', `Role "${created.role_name}" byla vytvořena.`, 'success');
        // Rovnou přepneme na nově vytvořenou roli, ať jde ihned konfigurovat oprávnění.
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

  confirmDelete(): void {
    const role = this.pendingDeleteRole;
    if (!role || this.isDeletingRole) return;

    this.isDeletingRole = true;
    this.deleteError = '';

    // deleteData() -> EntityCrudService.remove() -> DELETE core/roles/{id}
    this.deleteData(role.id).subscribe({
      next: () => {
        this.isDeletingRole = false;
        this.roles = this.roles.filter(r => !!r && r.id !== role.id);
        if (this.selectedRole?.id === role.id) {
          this.selectedRole = null;
          this.currentPermissions = new Set();
          this.isPermissionsDirty = false;
          // Po smazání vybrané role rovnou nabídneme první zbývající, ať panel není prázdný zbytečně.
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