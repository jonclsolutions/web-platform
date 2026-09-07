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
 * (Earlier refactor-notes for role hierarchy, group-select-all, two-level grouping +
 * search, TTL caching, and export mechanism are unchanged - see version history,
 * omitted here for brevity.)
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * Komponenta DĚDÍ BaseDataComponent, proto jen `translationSection = 'edit-roles'` a
 * zděděné `strings`/`t()`, žádná ruční injection. Nahrazeny VŠECHNY uživatelsky
 * viditelné texty vč. `window.confirm(...)` textu (nativní dialog nejde stylovat, ale
 * text uvnitř přeložit jde). Pluralizace "uživatel/uživatelé/uživatelů" (čeština má 3
 * tvary, angličtina 2) řešena `usersCountLabel()` metodou - JSON má VŽDY 4 klíče
 * (`users_zero/one/few/many`), jazyky se 2 tvary prostě nechají `few`/`many` stejné.
 * `MODULE_LABELS`/`GENERAL_RESOURCE_LABEL` byly PŮVODNĚ statické konstanty vyhodnocené
 * při načtení modulu - nahrazeny `moduleLabel()` metodou čtoucí `i18n.getValue()` přímo
 * (ne factory funkce jako u *.config.ts souborů, protože tahle komponenta nemá vlastní
 * `.config.ts` - konfigurace exportu/modulů žije přímo v komponentě).
 * `humanizeResourceKey()` NEPŘEKLÁDÁN ZÁMĚRNĚ - algoritmicky odvozuje fallback popisek
 * přímo z technického `permission_key` (např. "edit-website" -> "Edit Website"), použije
 * se JEN když daný resource nemá jinde explicitní překlad; jde o technický název, ne
 * redakčně psaný text, a jeho "překlad" by ve skutečnosti jen kapitalizoval anglická
 * slova bez ohledu na zvolený jazyk.
 * `ROLE_EXPORT_COLUMNS` (statická konstanta) nahrazena `getRoleExportColumns()` metodou
 * - export labely i "Ano"/"Ne" hodnoty v `getExportValue()` i XLSX sheet název jsou teď
 * přeložené, protože jde o viditelný obsah stahovaného souboru, ne jen UI.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { RoleOptionsService } from '../../../core/services/role-options.service';
import { ExportPopupBuilderComponent, ExportColumnOption, ExportSelection } from '../../components/builders/export-popup-builder/export-popup-builder.component';

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

/** Jedna z rozpoznaných CRUD akcí na konci klíče - viz parsePermissionKey(). */
type PermissionAction = 'view' | 'create' | 'update' | 'delete';
const ACTION_SUFFIXES: PermissionAction[] = ['view', 'create', 'update', 'delete'];
const ACTION_ORDER: Record<PermissionAction, number> = { view: 0, create: 1, update: 2, delete: 3 };

/** Interní klíč (ne zobrazovaný) záchytné skupiny pro permissions bez rozpoznatelného vzoru. */
const GENERAL_RESOURCE_KEY = '__general__';

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

/**
 * @description Mapa technického `module` klíče na i18n cestu jeho popisku - viz
 * `moduleLabel()`. Nová hodnota modulu na backendu vyžaduje jen přidání sem +
 * odpovídající klíč do cz.json/en.json, žádnou další logiku.
 */
const MODULE_LABEL_KEYS: Record<string, string> = {
  web: 'module_web',
  shop: 'module_shop',
  core: 'module_core',
};

@Component({
  selector: 'app-edit-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, ExportPopupBuilderComponent],
  templateUrl: './edit-roles.component.html',
  styleUrl: './edit-roles.component.css',
})
export class EditRolesComponent extends BaseDataComponent<CoreRole> implements Core.OnInit {
  apiEndpoint = 'core/roles';
  protected override translationSection: string = 'edit-roles';

  private resourceCache = inject(ResourceCacheService);
  private readonly PERMISSIONS_CACHE_KEY = 'edit-roles:permissions';
  private readonly PERMISSIONS_TTL_MS = 10 * 60 * 1000;
  private readonly ROLES_CACHE_KEY = 'edit-roles:roles';
  private readonly ROLES_TTL_MS = 2 * 60 * 1000;

  draftForcesTwoFa = false;
  newRoleForcesTwoFa = false;

  /**
   * @refactor-note (2026-09) BUGFIX "Cannot load text" u users count/module/resource
   * labelů: `this.t(key)` volání v tomto souboru VŠUDE předávají KRÁTKÝ klíč
   * (např. 'module_core', 'users_one'), ale zděděná `BaseDataComponent.t(path)`
   * očekává PLNOU tečkovanou cestu VČETNĚ sekce (např. 'edit-roles.module_core') -
   * bez prefixu `getValue()` hledá klíč `module_core` na NEJVYŠŠÍ úrovni JSONu, kde
   * neexistuje, a vrací fallback 'Cannot load text'. Přidán lokální override, který
   * prefix 'edit-roles.' doplní automaticky, takže všechna dosavadní krátká volání
   * `this.t('xxx')` v této třídě fungují beze změny.
   */
  public override t(key: string): string {
    return this.i18n.getValue(`edit-roles.${key}`);
  }
  // ── Export (BACKLOG "export mechanismus i na negenerické stránky") ─────
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

  /**
   * @description Skloňuje "N uživatel/uživatelé/uživatelů" (nebo anglický ekvivalent)
   * podle počtu - JSON nese VŽDY 4 tvary (`users_zero/one/few/many`); jazyky bez
   * české 3-tvarové pluralizace (např. angličtina) mají `few`/`many` prostě identické.
   * České pravidlo: 0 -> many, 1 -> one, 2-4 -> few, 5+ -> many.
   */
  usersCountLabel(count: number): string {
    let key: string;
    if (count === 0) key = 'users_zero';
    else if (count === 1) key = 'users_one';
    else if (count >= 2 && count <= 4) key = 'users_few';
    else key = 'users_many';
    return `${count} ${this.t(key)}`;
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
        this.alertDialogService.open(this.t('error_title'), this.t('load_permissions_error'), 'danger');
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
        this.alertDialogService.open(this.t('error_title'), this.t('load_roles_error'), 'danger');
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
      resourceLabel: this.t('general_resource_label'),
      action: null,
    };
  }

  /**
   * @description Algoritmicky odvozuje fallback popisek z technického permission_key
   * (např. "edit-website" -> "Edit Website"). ZÁMĚRNĚ nepřekládáno - viz refactor-note
   * (2026-09) v hlavičce souboru.
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

  /**
   * @refactor-note (2026-09) Nahrazeno voláním `i18n.getValue()` přes `MODULE_LABEL_KEYS`
   * mapu - PŮVODNĚ statická `MODULE_LABELS` konstanta. Neznámý modul (mimo mapu) vrátí
   * surový klíč beze změny, stejně jako předtím.
   */
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

  // ── Výběr role v levém seznamu ─────────────────────────────────────────

  selectRole(role: CoreRole): void {
    if (this.isPermissionsDirty || this.isEditingDetails) {
      const confirmed = window.confirm(this.t('confirm_unsaved_switch'));
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
   * @description Uloží oprávnění role. Po úspěchu invaliduje cache seznamu rolí.
   * @bugfix-note (2026-09-05) KRITICKÝ BUG - MATOUCÍ "NEOČEKÁVANÝ FORMÁT" HLÁŠKA PŘI
   * KAŽDÉM ÚSPĚŠNÉM ULOŽENÍ: `CoreRoleController::syncPermissions()` vrací
   * `response()->json(new CoreRoleResource(...))` BEZ obálky `{ data: ... }`, kterou
   * `DataHandler.put()` bezpodmínečně očekává a rozbaluje přes `response.data` (viz
   * data-handler.service.ts). `response.data` je proto u tohoto endpointu VŽDY
   * `undefined` - nejde o občasnou vadnou odpověď, jak předpokládala stará
   * `if (!updated || updated.id === undefined)` větev, která se tak spouštěla při
   * KAŽDÉM úspěšném uložení a mátla uživatele hláškou "pravděpodobně uloženo, ale...".
   * Řešení SCOPOVANÉ jen na tuhle komponentu (bez zásahu do sdílené DataHandler vrstvy,
   * na kterou spoléhá zbytek adminu): aktualizovaný stav role sestavíme lokálně - přesně
   * víme, co jsme odeslali (`keys`), server na úspěšný request odpovídá jen 2xx/chybou,
   * nikdy částečně, takže žádné dohadování z odpovědi není potřeba.
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

  // ── Editace názvu / popisu vybrané role ────────────────────────────────

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
   * @description Uloží název/popis role. Po úspěchu invaliduje cache seznamu rolí
   * i sdílenou `RoleOptionsService` cache.
   * @bugfix-note (2026-09-05) Stejný kořenový problém jako u `savePermissions()` výše -
   * `CoreRoleController::update()` vrací roli bez `{ data: ... }` obálky, takže
   * `EntityCrudService.update()` -> `DataHandler.put()` vždy vrátí `undefined`. Řešeno
   * stejně: `payload`, který jsme sami odeslali, JE novým stavem role - sestavíme
   * `updated` z něj, žádný dohad z odpovědi serveru.
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

  // ── Vytvoření nové role ───────────────────────────────────────────────

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
   * @description Vytvoří novou roli. Po úspěchu invaliduje cache seznamu rolí i sdílenou
   * `RoleOptionsService` cache.
   * @bugfix-note (2026-09-05) Stejný kořenový problém jako u save*() výše, ALE tady ho
   * nejde obejít sestavením lokálně - nové `id` přiděluje výhradně server, takže reload
   * přes `loadRoles({name}, true)` musí zůstat. Rozdíl je jen v tom, že tahle cesta je
   * TEĎ prezentovaná jako normální/očekávaný průběh (viz zpráva), ne jako fallback pro
   * vzácně "poškozenou" odpověď - protože poškozená není, jen záměrně nezabalená.
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

  // ── Smazání role ──────────────────────────────────────────────────────

  canDeleteRole(role: CoreRole): boolean {
    return !role.is_protected && role.users_count === 0;
  }

  deleteBlockedReason(role: CoreRole): string {
    if (role.is_protected) return this.t('delete_blocked_system');
    if (role.users_count > 0) return this.t('delete_blocked_users').replace('{count}', String(role.users_count));
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
        this.alertDialogService.open(this.t('deleted_title'), this.t('role_deleted_success').replace('{name}', role.role_name), 'success');
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isDeletingRole = false;
        this.deleteError = err?.error?.message || this.t('role_delete_error');
        this.cd.markForCheck();
      }
    });
  }

  // ── Export do CSV/XLSX/JSON/TXT ───────────────────────────────────────

  /**
   * @description Sloupce nabízené v exportním popupu - EditRolesComponent NENÍ
   * `TableBuilderComponent`, takže si generování souboru řeší sama (viz
   * `buildExportRows()`/`downloadExportFile()` níže), ale znovupoužívá stejnou
   * `ExportPopupBuilderComponent` (formátový picker) jako zbytek admin sekce.
   * `permissions` je jediné pole, které není přímo na `CoreRole` jako string - viz
   * `getExportValue()`.
   * @refactor-note (2026-09) PŮVODNĚ statická `ROLE_EXPORT_COLUMNS` konstanta -
   * nahrazeno metodou, ať labely reagují na aktuální admin jazyk.
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

  /** @description `this.roles` je VŽDY kompletní (viz `loadAllData()`/`loadRoles()` výše - žádná paginace) - export tak vždy pokrývá úplně všechny role, ne jen aktuálně zobrazenou stránku. */
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
   * @description `columnKeys` je `null`, pokud caller (`ExportPopupBuilderComponent`)
   * nedostal žádné `[columns]` - u nás se to nestane (export sloupce vždy neprázdné),
   * ale ošetřeno defenzivně stejně jako `TableBuilderComponent` to dělá.
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

      this.showExportPopup = false;
    } catch {
      this.alertDialogService.open(this.t('error_title'), this.t('export_generic_error'), 'danger');
    } finally {
      this.isExporting = false;
      this.cd.markForCheck();
    }
  }

  /** @description Vrátí pole řádků (pole stringů, ve stejném pořadí jako `keys`) - jedna položka pole = jedna role. */
  private buildExportRows(keys: string[]): string[][] {
    return this.roles.map(role => keys.map(key => this.getExportValue(role, key)));
  }

  /**
   * @description Formátuje jednu hodnotu pro export - `permissions` (pole klíčů) se
   * spojí středníkem (je jich typicky desítky, nedávají smysl jako samostatné
   * sloupce), boolean pole se přeloží na Ano/Ne resp. Yes/No (čitelnější v Excelu než
   * 1/0/true/false) - hodnota reaguje na aktuální admin jazyk, viz refactor-note
   * (2026-09) v hlavičce souboru.
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