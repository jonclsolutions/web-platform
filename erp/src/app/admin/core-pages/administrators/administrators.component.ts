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
 *
 * @refactor-note (2026-08-24) BACKLOG "workflow zakládání účtů z adminu":
 * - `computeFieldsForTarget()` rozšířeno o `is_blocked` - stejný vzor jako `enable_2fa`:
 *   pole zůstává ve formuláři vidět, ale je `editable: false` (disabled), pokud cílová
 *   role je admin/sysadmin (`isNeverBlockableRole()`) - skutečné vynucení dělá backend
 *   (UserController::update(), 422 při pokusu obejít), tohle je jen UX předvyplnění.
 * - Nová metoda `handleResendActivation()` napojená na nový `(resendActivationOpened)`
 *   output z `TableBuilderComponent` - volá `POST core/users/{id}/resend-activation`.
 *   Klientská kontrola `item.activated_at` je jen rychlá zpětná vazba bez zbytečného
 *   HTTP requestu - skutečnou kontrolu ("účet už je aktivovaný") dělá i backend.
 * - `handleFormSubmitted()`: needitovatelná pole (`nonEditableFields`) se dřív mazala
 *   jen kvůli 2FA scénáři, teď stejná logika automaticky ochrání i `is_blocked`, pokud
 *   ho `computeFieldsForTarget()` označí jako `editable: false` - žádná further úprava
 *   v tomhle handleru nebyla potřeba.
 *
 * @refactor-note (2026-08-25) BACKLOG "core-admin-email-domain-restriction": nové
 * tlačítko "Domény e-mailů" v toolbaru (VÝHRADNĚ pro sysadmina - viz `toolbarButtons`
 * getter, case `openEmailAccessPolicy`), otevírající modal se dvěma sekcemi:
 * (1) hlavní e-mailová doména firmy, (2) whitelist dalších domén/konkrétních e-mailů
 * (přidání/smazání). Modal je inline v tomhle souboru (stejný vzor jako
 * `UserRequestComponent`'s email template modal) - je to malá, jednoúčelová
 * administrátorská obrazovka, ne znovupoužitelná komponenta. Backend
 * (`CoreEmailAccessPolicyController`) se chrání sám (403 pro ne-sysadmina) nezávisle
 * na tomhle UI, takže skrytí tlačítka je jen UX pohodlí, ne bezpečnostní hranice.
 *
 * @bugfix-note (2026-08-25v2) BACKLOG "alert dialogy až podle API odpovědi":
 * `FormBuilderComponent` už neukazuje žádný zelený toast sám od sebe (dřív ho ukazoval
 * HNED po emitu, ještě před HTTP requestem - viz jeho vlastní bugfix-note - takže
 * uživatel při 422 chybě viděl NEJDŘÍV zelený "úspěch" a hned poté červenou chybu).
 * `handleFormSubmitted()` teď zobrazuje zelený toast VÝHRADNĚ v `next()` callbacku
 * (tedy až po reálném úspěchu z API) - červený zůstává v `error()` beze změny. Nikdy
 * tak nemůže dojít k zobrazení obou najednou.
 */

import { Component, ViewChild, ChangeDetectionStrategy, OnInit } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { RoleOptionsService } from '../../../core/services/role-options.service';
import { InputDefinition } from '../../../shared/interfaces/input-definiton';
import * as Config from './administrators.config';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/** Role s napevno vynuceným 2FA - musí sedět s backend User::FORCED_2FA_ROLE_NAMES. */
const HARDCODED_FORCED_ROLE_NAMES = ['admin', 'sysadmin'];

/**
 * Role, jejichž účty NELZE NIKDY zablokovat - stejný seznam jako
 * HARDCODED_FORCED_ROLE_NAMES (obě ochrany se týkají stejných "trvale chráněných"
 * rolí), ale drženo jako samostatná konstanta, ať jde v budoucnu nezávisle měnit.
 * Musí sedět s backend UserController::NEVER_BLOCK_ROLE_NAMES.
 */
const NEVER_BLOCKABLE_ROLE_NAMES = ['admin', 'sysadmin'];

interface RoleMeta {
  role_name: string;
  forces_2fa: boolean;
}

/** Jedna položka whitelistu - viz CoreEmailAccessRule na backendu. */
interface EmailAccessRule {
  id: number;
  type: 'domain' | 'email';
  value: string;
}

@Component({
  selector: 'app-administrators',
  standalone: true,
  // ActionMenuBuilderComponent přidán explicitně, dokud není zařazen do
  // SHARED_UI_BUILDERS bundle.
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent,GraphBuilderComponent],
  templateUrl: './administrators.component.html',
  styleUrls: ['../default-style.css', './email-access-policy-modal.css'],
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
          updatedBtn.label = this.isFilterVisible ? 'Skrýt filtry' : 'Filtry';
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
          // VÝHRADNĚ sysadmin - viz refactor-note (2026-08-25) v hlavičce souboru.
          // Backend se chrání sám nezávisle na tomhle - jde jen o UX skrytí tlačítka.
          updatedBtn.showIf = this.isSysadmin;
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? 'Zobrazit aktivní' : 'Koš';
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
   * Stejná mapa se znovupoužívá i pro rozhodnutí "je role nikdy-neblokovatelná?".
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
   * @description Jestli daná role (podle id) NIKDY nesmí být zablokována - čistě UX
   * předvyplnění/disable, skutečné vynucení dělá backend (UserController::update()).
   */
  private isNeverBlockableRole(roleId: number | string | undefined | null): boolean {
    if (roleId === undefined || roleId === null || roleId === '') return false;
    const meta = this.rolesMeta.get(Number(roleId));
    return !!meta && NEVER_BLOCKABLE_ROLE_NAMES.includes(meta.role_name);
  }

  /**
   * @description Odvodí, jaké pole se má ve formuláři reálně zobrazit/disablovat pro
   * danou cílovou roli - viz refactor-note v hlavičce souboru. `roleId` je `null` u
   * nové (dosud nevybrané) role při vytváření účtu.
   */
  private computeFieldsForTarget(
    roleId: number | string | undefined | null,
    adminForced: boolean = false
  ): InputDefinition[] {
    const forced = this.isRoleForced(roleId) || adminForced;
    const neverBlockable = this.isNeverBlockableRole(roleId);

    let fields = this.formFields.map(f => {
      if (f.column_name === 'enable_2fa' && forced) {
        return { ...f, editable: false };
      }
      if (f.column_name === 'is_blocked' && neverBlockable) {
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
    // is_blocked má show_in_create: false, takže se v tomto formuláři nezobrazí vůbec.
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

    // Chráněná role nesmí být zablokovaná - i kdyby v DB nějak přesto `is_blocked: true`
    // bylo (nemělo by, backend to nedovolí), formulář to nezobrazí jako zaškrtnuté true,
    // aby se neomylem znovu neodeslalo.
    if (this.isNeverBlockableRole(itemToEdit.role_id)) {
      itemToEdit.is_blocked = false;
    }

    this.visibleFormFields = this.computeFieldsForTarget(itemToEdit.role_id, !!itemToEdit.two_fa_forced_by_admin);
    this.selectedItemForEdit = itemToEdit;
    this.showCreateForm = true;
  }

  /**
   * @description Submits user data. Error handler DOPLNĚN (dřív chyběl) - viz
   * refactor-note v hlavičce souboru: FormBuilderComponent ukazuje zelený toast hned po
   * emitu, ještě před odpovědí serveru, takže reálná chyba backendu (např. 422 při
   * pokusu vypnout vynucenou 2FA, nebo zablokovat chráněný účet, NEBO nově i 422 při
   * pokusu vytvořit účet s nepovolenou e-mailovou doménou) se bez tohoto handleru
   * vůbec neprojevila v UI.
   * @bugfix-note (2026-08-16v2) KRITICKÁ OPRAVA: `visibleFormFields`/`nonEditableFields`
   * odráží roli, která byla vybraná PŘI OTEVŘENÍ formuláře
   * (`handleEditFormOpened`/`handleCreateFormOpened`) - pokud sysadmin roli PŘÍMO VE
   * FORMULÁŘI přepne na admin/sysadmin (nebo jinou `forces_2fa` roli),
   * `visibleFormFields` se nepřepočítá a `enable_2fa`/`two_fa_forced_by_admin` tak
   * zůstanou v payloadu jako klíče odpovídající PŮVODNÍ roli. Backend
   * (`UserController::update()`) to pak vyhodnotí jako explicitní pokus o obejití
   * vynucení a vrátí 422, i když uživatel nic vědomě nezměnil - jen povýšil roli.
   * ŘEŠENÍ: `forcedNow` se přepočítá znovu podle role, která se REÁLNĚ odesílá
   * (`payload.role_id`), ne podle stavu formuláře při otevření - pokud je nová role
   * vynucená, `enable_2fa`/`two_fa_forced_by_admin` se z payloadu smažou úplně (backend
   * pak `enable_2fa` sám vynutí na `true` - viz `UserController::update()`,
   * `$validated['enable_2fa'] = $isForced ? true : ...`). Stejný princip teď platí i
   * pro `is_blocked` - pokud je nová role NEVER_BLOCKABLE, `is_blocked` se z payloadu
   * smaže (backend by ho stejně odmítl 422, tohle jen ušetří zbytečný request s chybou
   * u legitimní změny, kdy uživatel jen mění roli, ne blokaci).
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

    // Znovu vyhodnotit "forced" podle role, která se reálně odesílá - viz bugfix-note výše.
    const forcedNow = this.isRoleForced(payload.role_id);
    if (forcedNow) {
      delete payload.enable_2fa;
      delete payload.two_fa_forced_by_admin;
    }

    // Stejný princip pro blokaci - nová role je NEVER_BLOCKABLE, is_blocked nedává smysl.
    if (this.isNeverBlockableRole(payload.role_id)) {
      delete payload.is_blocked;
    }

    const request$ = payload.id ? this.updateData(payload.id, payload) : this.postData(payload);
    request$.pipe(Core.finalize(() => { this.showCreateForm = false; this.cd.markForCheck(); }))
      .subscribe({
        next: () => {
          this.alertDialogService.open('Úspěch', payload.id ? 'Účet byl upraven.' : 'Účet byl vytvořen.', 'success');
          this.refreshData();
        },
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

  /**
   * @description Znovu odešle aktivační e-mail účtu, který se ještě nikdy neaktivoval.
   * `item.activated_at` kontrola na klientu je jen rychlá zpětná vazba bez zbytečného
   * HTTP requestu - backend (`UserController::resendActivation()`) dělá stejnou
   * kontrolu nezávisle, takže tohle nelze obejít úpravou frontendu.
   */
  handleResendActivation(item: any): void {
    if (item.activated_at) {
      this.alertDialogService.open('Info', 'Účet je již aktivovaný.', 'info');
      return;
    }

    this.dataHandler.post(`core/users/${item.id}/resend-activation`, {}).subscribe({
      next: () => this.alertDialogService.open('Odesláno', 'Aktivační e-mail byl odeslán znovu.', 'success'),
      error: (err: any) => this.alertDialogService.open('Chyba', err?.error?.message || 'Odeslání se nezdařilo.', 'danger')
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

  /**
   * @description Otevře modal a načte aktuální hlavní doménu + celý whitelist.
   * Bez TTL cache - modal se otevírá příležitostně (sysadmin only), čerstvý fetch při
   * každém otevření je v pořádku.
   */
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
      error: (err: any) => {
        this.emailAccessPolicyLoading = false;
        this.alertDialogService.open('Chyba', err?.error?.message || 'Nepodařilo se načíst nastavení domén.', 'danger');
        this.cd.markForCheck();
      }
    });
  }

  closeEmailAccessPolicyModal(): void {
    if (this.emailAccessPolicySaving) return;
    this.showEmailAccessPolicyModal = false;
  }

  /**
   * @description Uloží hlavní e-mailovou doménu (nebo ji vynuluje na prázdno = "bez
   * omezení", pokud uživatel pole smaže). Backend normalizuje/validuje formát domény
   * nezávisle na frontendu.
   */
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
        this.alertDialogService.open('Uloženo', 'Hlavní e-mailová doména byla uložena.', 'success');
        this.cd.markForCheck();
      },
      error: (err: any) => {
        this.emailAccessPolicySaving = false;
        this.alertDialogService.open('Chyba', err?.error?.message || 'Uložení se nezdařilo.', 'danger');
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Přidá novou položku whitelistu (doménu nebo konkrétní e-mail) podle
   * aktuálně zvoleného `newRuleType`. Backend vrací plný objekt nové položky (včetně
   * `id`), který se rovnou přidá do lokálního seznamu bez nutnosti dalšího refetch.
   */
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
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err?.error?.message || 'Přidání se nezdařilo.', 'danger')
    });
  }

  removeEmailAccessRule(id: number): void {
    this.dataHandler.delete(`core/email-access-policy/rules/${id}`).subscribe({
      next: () => {
        this.emailAccessRules = this.emailAccessRules.filter(r => r.id !== id);
        this.cd.markForCheck();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err?.error?.message || 'Smazání se nezdařilo.', 'danger')
    });
  }

  /** @description Whitelist rozdělený na dvě samostatné pole pro přehlednější zobrazení v šabloně. */
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