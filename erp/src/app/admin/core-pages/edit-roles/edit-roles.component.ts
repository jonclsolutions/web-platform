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
 *              přehledný (např. sekce "Web" dnes obsahuje desítky řádků - news-view/
 *              -create/-update/-delete, sales-leads-*, support-tickets-* atd. za sebou).
 *              Přidána DRUHÁ úroveň grupování - "zdroj" (resource) - odvozená ČISTĚ
 *              parsováním `permission_key` podle konvence zavedené při granularizaci:
 *              `{modul}-{zdroj}-{akce}`, kde akce ∈ view|create|update|delete (viz
 *              `parsePermissionKey()`). Modul se bere z `permission.module` sloupce v DB
 *              (beze změny, dynamické jako dřív) - z klíče se odstraní jen prefix modulu
 *              a případný akční suffix, zbytek je "zdroj" (např. 'web-news-update' ->
 *              modul 'web' + zdroj 'news' + akce 'update'). ŽÁDNÉ hardcodování názvů
 *              zdrojů - nová permission, která dodrží konvenci, se automaticky zařadí
 *              do správné sekce bez jakéhokoliv zásahu do téhle stránky. Klíče, které
 *              vzor nedodržují (flagy jako `view-core`, `view-deleted`,
 *              `web-set-maintenance-mode`, nebo dosud negranularizovaný `shop-manage-*`),
 *              spadnou do záchytné skupiny "Obecné" na konci modulu - nic se neztratí,
 *              jen se to nedá smysluplně podřadit pod konkrétní zdroj.
 *              Zdrojová skupina má vlastní "select all" checkbox (stejný mechanismus
 *              jako modulová úroveň, jen na užší množině), a přibylo samostatné
 *              vyhledávací pole (`permissionSearch`) filtrující checklist podle
 *              permission_key/description/resourceLabel, nezávislé na existujícím
 *              hledání v seznamu ROLÍ (`roleSearch`, levý panel - beze změny).
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

  constructor(
    dataHandler: Core.DataHandler,
    cd: Core.ChangeDetectorRef,
    genericTableService: Core.GenericTableService
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

  // ── Vyhledávání v checklistu oprávnění (pravý panel, nezávislé na roleSearch) ─
  permissionSearch = '';

  /**
   * @description Modulové skupiny oprávnění po aplikaci `permissionSearch` filtru -
   * hledá se podle `permission_key`, `description` i `resourceLabel`. Prázdné zdrojové
   * skupiny (po filtraci nic nezbylo) i prázdné moduly se z výsledku odstraní, ať se
   * nezobrazují nadpisy bez obsahu. Používá se v šabloně MÍSTO `permissionGroups` -
   * "select all" checkboxy (modulové i zdrojové) tak přirozeně operují jen nad aktuálně
   * viditelnou (vyfiltrovanou) sadou, což je u hledání očekávané chování ("vyber vše, co
   * teď vidím"), ne skryté položky mimo obrazovku.
   */
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

  private initializeRolesAndPermissions(): void {
    this.isLoading = true;

    // Seznam oprávnění je mimo standardní CRUD jednoho apiEndpointu, voláno přímo.
    this.dataHandler.get<CorePermission[]>('core/permissions').subscribe({
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
   * @description Načte seznam rolí. Pokud je zadaný `preferred` (id a/nebo role_name),
   * po načtení se pokusí vybrat PRÁVĚ TU roli místo automatického výběru první v poli -
   * používá se ve fallback větvích po uložení (savePermissions/saveDetails/createRole),
   * kdy odpověď serveru nepřišla v očekávaném tvaru a musíme si být jistí čerstvými daty
   * ze serveru, ale nechceme přitom uživateli "uteklo" z rozeditované role na sysadmina
   * (roles[0], typicky nejnižší id) jen proto, že se seznam znovu natáhl.
   * @param preferred Volitelně id a/nebo role_name role, která má zůstat vybraná. Pokud
   * se v čerstvě načteném seznamu nenajde (např. role byla mezitím smazána), spadne se
   * zpátky na výběr první role - stejné chování jako dřív.
   */
  private loadRoles(preferred?: { id?: number; name?: string }): void {
    // loadAllData() -> EntityCrudService.loadAll() -> GET core/roles?no_pagination=true
    this.loadAllData().subscribe({
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
          // Fallback beze změny: žádná preferovaná role nenalezena (nebo nebyla zadaná
          // vůbec - první načtení stránky) -> pohodlný default, vybrat první v pořadí.
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

  /**
   * @description Odvodí "zdroj" (resource) a "akci" z permission klíče podle konvence
   * `{modul}-{zdroj}-{akce}`, kterou zavedla granularizace permission systému
   * (viz api.php 2026-08-5). Nejdřív se z klíče odstraní prefix modulu (např. 'web-'
   * u klíče s modulem 'web'), pak se zkusí najít akční suffix (-view/-create/-update/
   * -delete). Pokud se povede najít oboje, zbytek mezi nimi je "zdroj" (např.
   * 'web-news-update' -> modul 'web' odstraněn -> 'news-update' -> suffix '-update'
   * odstraněn -> zdroj 'news'). Klíče, které vzor nedodrží (flagy, negranularizované
   * shop-manage-* klíče, historické nesrovnalosti typu 'core-view-welcome-page' s
   * module='web'), spadnou do záchytné skupiny "Obecné" - žádná chyba, jen to nejde
   * smysluplně podřadit pod konkrétní zdroj.
   * @param perm Permission záznam z API (core/permissions).
   */
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

  /**
   * @description Převede syrový segment zdroje ('sales-leads') na čitelný popisek
   * ('Sales Leads') - rozdělí podle pomlčky a každé slovo napíše s velkým počátečním
   * písmenem. Čistě kosmetické, žádná byznys logika.
   */
  private humanizeResourceKey(rawResource: string): string {
    return rawResource
      .split('-')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * @description Sestaví dvouúrovňovou strukturu modul -> zdroje -> položky ze
   * syrového seznamu permissions vráceného z `core/permissions`. Volá se jednou při
   * načtení stránky; `visiblePermissionGroups` pak nad tímhle výsledkem jen filtruje
   * podle `permissionSearch`, žádné přepočítávání parsování při každém keystroke.
   */
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

    // Sjednocené pořadí položek uvnitř každého zdroje (view/create/update/delete),
    // "Obecné" položky abecedně podle klíče.
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

  /** "Obecné" skupina vždy naposled, ostatní zdroje abecedně podle popisku. */
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

  // ── trackBy helpery pro vnořené *ngFor smyčky checklistu ───────────────

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
    // Hledání v checklistu je per-role interakce, ne persistentní napříč rolemi -
    // reset při přepnutí, ať nová role nezůstane nesmyslně přefiltrovaná.
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

  // ── Hromadné zaškrtnutí celého MODULU (obou úrovní najednou) ───────────

  private moduleItems(group: PermissionModuleGroup): CorePermission[] {
    return group.resources.flatMap(r => r.items);
  }

  /**
   * @description Zda jsou VŠECHNA oprávnění dané modulové skupiny (napříč všemi jejími
   * zdroji) aktuálně zaškrtnutá - řídí stav "select all" checkboxu v hlavičce modulu.
   * Pracuje nad `group`, jak byla předaná z šablony - u aktivního vyhledávání to je
   * `visiblePermissionGroups` (tedy jen viditelná/vyfiltrovaná podmnožina), viz getter
   * výše.
   */
  isModuleFullyChecked(group: PermissionModuleGroup): boolean {
    const items = this.moduleItems(group);
    return items.length > 0 && items.every(p => this.currentPermissions.has(p.permission_key));
  }

  /**
   * @description Zda je zaškrtnutá jen ČÁST oprávnění dané modulové skupiny -
   * indeterminate stav "select all" checkboxu.
   */
  isModulePartiallyChecked(group: PermissionModuleGroup): boolean {
    const items = this.moduleItems(group);
    const checkedCount = items.filter(p => this.currentPermissions.has(p.permission_key)).length;
    return checkedCount > 0 && checkedCount < items.length;
  }

  /**
   * @description Zaškrtne, nebo odškrtne, všechna oprávnění dané modulové skupiny
   * (napříč všemi jejími zdroji) najednou.
   */
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

  // ── Hromadné zaškrtnutí jednoho ZDROJE uvnitř modulu ───────────────────

  /**
   * @description Zda jsou VŠECHNA oprávnění daného zdroje (např. "News" v modulu Web)
   * aktuálně zaškrtnutá - řídí stav "select all" checkboxu v hlavičce zdroje.
   */
  isResourceFullyChecked(resource: PermissionResourceGroup): boolean {
    return resource.items.length > 0 && resource.items.every(p => this.currentPermissions.has(p.permission_key));
  }

  /**
   * @description Zda je zaškrtnutá jen ČÁST oprávnění daného zdroje - indeterminate
   * stav "select all" checkboxu zdroje.
   */
  isResourcePartiallyChecked(resource: PermissionResourceGroup): boolean {
    const checkedCount = resource.items.filter(p => this.currentPermissions.has(p.permission_key)).length;
    return checkedCount > 0 && checkedCount < resource.items.length;
  }

  /**
   * @description Zaškrtne, nebo odškrtne, všechna oprávnění jednoho zdroje najednou
   * (např. celé "News" - view/create/update/delete čtyřmi klepnutími ušetřenými).
   */
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
          this.loadRoles({ id: role.id, name: role.role_name });
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

    // Zachyceno PŘED voláním API - `this.selectedRole` se nesmí měnit pod rukama,
    // ale hlavně: ve fallback větvi níže potřebujeme vědět, KTEROU roli po reloadu
    // znovu vybrat (id se navíc nemění, name je nová hodnota, kterou právě ukládáme).
    const roleId = this.selectedRole.id;

    this.isSavingDetails = true;

    // updateData() -> EntityCrudService.update() -> PUT core/roles/{id}
    this.updateData(this.selectedRole.id, payload).subscribe({
      next: (updated) => {
        this.isSavingDetails = false;

        if (!updated || updated.id === undefined) {
          console.warn('[EditRolesComponent] PUT core/roles/{id} vrátil neočekávanou odpověď:', updated);
          this.isEditingDetails = false;
          this.alertDialogService.open('Uloženo', 'Údaje byly pravděpodobně uloženy, ale odpověď serveru nebyla v očekávaném formátu. Obnovuji seznam ze serveru.', 'success');
          this.loadRoles({ id: roleId, name });
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
          // Id nově vytvořené role neznáme (server neodpověděl v očekávaném tvaru) -
          // hledáme podle jména, které jsme právě odeslali.
          this.loadRoles({ name });
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