/**
 * @file user-request.component.ts
 * @path src/app/admin/web-pages/user-request/user-request.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Administrative component for managing user-submitted requests (raw commissions), handling data lifecycle, filtering, and detail views.
 * @dependencies
 * - BaseDataComponent: Core logic for API interactions and state management.
 * - TableBuilderComponent: UI component for rendering the request data tables and handling CSV exports and imports.
 * - ActionMenuBuilderComponent: Dropdown ("Akce") rendering `toolbarButtons` config - viz refactor-note (2026-08-24).
 * - GraphBuilderComponent: Generic date-range analytics/report popup (charts + PDF export) - viz refactor-note (2026-08-26).
 * - USER_REQUEST Config: Domain-specific definitions for form fields, table columns, and button configurations.
 *
 * (Earlier refactor-notes for the editable e-mail confirmation template modal, the
 * mousedown/textarea focus bugfix, toolbar consolidation into ActionMenuBuilderComponent,
 * the graph-builder report popup, and the duplicate error-toast bugfix are unchanged -
 * see version history, omitted here for brevity.)
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * (Earlier note about the modal/CRUD messages/toolbar translation is unchanged.)
 *
 * @bugfix-note (2026-09v3) KRITICKÝ BUG - NG0956 NEKONEČNÝ CYKLUS + "Cannot load
 * text" NATRVALO: `buttons`/`formFields`/`userRequestColumns`/atd. byly PŮVODNĚ
 * GETTERY volající `Config.create*(this.i18n)` PŘI KAŽDÉM čtení (tzn. při každém
 * change-detection průchodu). Factory funkce vrací pokaždé NOVÉ pole NOVÝCH objektů
 * - `@for (col of columnDefinitions; track col)` v TableBuilderComponent používal
 * track-by-identity, takže Angular pokaždé viděl "jinou kolekci" a zbořil/znovu
 * vytvořil celou tabulku (NG0956), což vyvolalo další CD cyklus -> nekonečná smyčka.
 * OPRAVA ČÁST 1 (jinde, mimo tento soubor): `table-builder.component.html`
 * `@for` track výrazy přepsány na `track col.key`/`track button.action` (stabilní
 * klíč, ne identita objektu).
 * OPRAVA ČÁST 2 (tento soubor): gettery nahrazeny OBYČEJNÝMI POLI, PŘIŘAZENÝMI
 * VÝHRADNĚ UVNITŘ KONSTRUKTORU (NE jako field initializer nad konstruktorem - field
 * initializery běží při vytvoření instance a NEPŘEPOČÍTAJÍ se při dalších emitech
 * `translations$`). Konstruktor navíc subscribuje `this.i18n.translations$` - jde o
 * `BehaviorSubject`, takže subscribe OKAMŽITĚ dostane aktuální (byť případně ještě
 * nenačtenou/`null`) hodnotu, a znovu se spustí při KAŽDÉM dalším emitu (úspěšné
 * načtení JSONu po HTTP requestu, i budoucí přepnutí jazyka) - pole se tak naplní
 * správnými texty, jakmile JSON skutečně dorazí, i když v okamžiku prvního
 * spuštění subscribe callbacku ještě `null` byl.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './user-request.config';

/** Jeden jazyk z `GET languages/{module}` - stejný tvar, jaký používá WebSettingsComponent. */
interface EmailTemplateLang {
  code: string;
  name: string;
  active?: boolean;
}

/** Popisky a pevné texty šablony, editovatelné per jazyk (viz raw_request_email_labels_i18n). */
interface EmailTemplateLabels {
  greeting: string;
  summary_header: string;
  label_thema: string;
  label_email: string;
  label_phone: string;
  label_description: string;
  label_attachments: string;
  label_date: string;
}

/** i18n textový obsah editovatelné šablony potvrzovacího e-mailu. */
interface EmailTemplateState {
  subject_i18n: Record<string, string>;
  title_i18n: Record<string, string>;
  intro_i18n: Record<string, string>;
  outro_i18n: Record<string, string>;
  labels_i18n: Record<string, Partial<EmailTemplateLabels>>;
}

/**
 * @description Manages the administration of user request commissions.
 * @usage Enables staff to monitor, edit, and audit incoming raw requests from the frontend.
 * @note Implements standard CRUD operations while utilizing custom configurations for display and interaction logic.
 */
@Component({
  selector: 'app-user-request',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, FormsModule, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './user-request.component.html',
  styleUrls: ['../default-style.css', './email-template-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserRequestComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  protected override translationSection: string = 'user-request';

  public override t(key: string): string {
    return this.i18n.getValue(`user-request.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/raw_request_commissions';

  /**
   * @bugfix-note (2026-09v3) Prázdné výchozí hodnoty - naplní se VÝHRADNĚ přes
   * `translations$` subscribe v konstruktoru, viz refactor-note v hlavičce souboru.
   * NIKDY nepřepisovat na gettery (NG0956 riziko) ani na field-initializer volání
   * `Config.create*()` přímo tady (proběhne příliš brzy, jen jednou).
   */
  buttons: Core.TableButtons[] = [];
  formFields: Core.InputDefinition[] = [];
  userRequestColumns: Core.ColumnDefinition[] = [];
  trashUserRequestColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

  filters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };

  // ── Šablona potvrzovacího e-mailu (modal) ──────────────────────────────
  showEmailTemplateModal = false;
  emailTemplateLoading = false;
  emailTemplateSaving = false;
  emailTemplateLanguages: EmailTemplateLang[] = [];
  emailTemplateCurrentLang = 'cz';
  emailTemplate: EmailTemplateState = { subject_i18n: {}, title_i18n: {}, intro_i18n: {}, outro_i18n: {}, labels_i18n: {} };

  /**
   * Výchozí texty šablony - MUSÍ přesně odpovídat konstantám v
   * `App\Support\Mail\RawRequestEmailTemplate` (backend). Použity jako (1) placeholdery
   * v prázdných polích a (2) fallback v živém náhledu, když admin pro daný jazyk (ani
   * pro 'cz') nic nevyplnil - přesně stejná logika, jakou použije skutečný odeslaný mail.
   * @note Getter je zde v pořádku (NE pole) - jednoduchý plochý objekt s primitivy,
   * ne pole objektů čtené přes `@for`/`track`, takže NG0956 riziko se ho netýká.
   */
  private get emailTemplateDefaults() {
    return {
      subject: this.t('email_tpl_default_subject'),
      title: this.t('email_tpl_default_title'),
      intro: this.t('email_tpl_default_intro'),
      outro: this.t('email_tpl_default_outro'),
      greeting: this.t('email_tpl_default_greeting'),
      summaryHeader: this.t('email_tpl_default_summary_header'),
      labelThema: this.t('email_tpl_default_label_thema'),
      labelEmail: this.t('email_tpl_default_label_email'),
      labelPhone: this.t('email_tpl_default_label_phone'),
      labelDescription: this.t('email_tpl_default_label_description'),
      labelAttachments: this.t('email_tpl_default_label_attachments'),
      labelDate: this.t('email_tpl_default_label_date'),
    };
  }

  /** Ukázková (fiktivní) data rekapitulace pro živý náhled - žádný skutečný požadavek v tomto kontextu neexistuje. */
  readonly emailTemplatePreviewSample = {
    thema: 'Webová prezentace na míru',
    email: 'zakaznik@example.com',
    phone: '+420 733 188 328',
    description: 'Poptávám redesign firemního webu včetně e-shopu a napojení na sklad.',
    attachments: ['zadani.pdf', 'logo.png'],
    date: '21.08.2026 15:32',
  };

  // ── Grafy a reporty (modal) ─────────────────────────────────────────────

  /** Řídí viditelnost `<app-graph-builder>` popupu - viz refactor-note (2026-08-26) v hlavičce souboru. */
  showGraphBuilder = false;

  /**
   * @description Chartable podmnožina `detailsColumns` namapovaná na minimální
   * tvar, který `GraphBuilderComponent` potřebuje.
   * @note Getter je v pořádku - GraphBuilderComponent si sám v `ngOnChanges()`
   * hlídá "stejná množina klíčů = stejná kolekce" (viz `sameColumnKeySet()`), takže
   * nová reference pole zde NEZPŮSOBÍ zbytečné překreslení, na rozdíl od
   * TableBuilderComponent dřív.
   */
  get graphColumns(): GraphColumnOption[] {
    return this.detailsColumns
      .filter(col => col.chartable === true)
      .map(col => ({
        key: col.key,
        label: col.displayName,
        aggregation: col.chartAggregation ?? 'count',
        possibleValues: col.chartPossibleValues
      }));
  }

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    /**
     * @bugfix-note (2026-09v3) VÝHRADNÍ místo, kde se `buttons`/`formFields`/atd.
     * plní - `translations$` je BehaviorSubject, takže tenhle subscribe:
     * 1) proběhne OKAMŽITĚ s aktuální (možná ještě `null`) hodnotou,
     * 2) proběhne ZNOVU při každém dalším emitu (úspěšné doražení JSONu po HTTP
     *    requestu, budoucí přepnutí jazyka) a přepíše pole správnými texty.
     * Díky tomu i konzumenti (TableBuilderComponent), kteří dřív viděli
     * "Cannot load text" natrvalo, dostanou správný text hned, jak JSON dorazí.
     */
    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createUserRequestButtons(this.i18n);
      this.formFields = Config.createUserRequestFormFields(this.i18n);
      this.userRequestColumns = Config.createUserRequestColumns(this.i18n);
      this.trashUserRequestColumns = Config.createUserRequestTrashColumns(this.i18n);
      this.filterColumns = Config.createUserRequestFilterColumns(this.i18n);
      this.detailsColumns = Config.createUserRequestDetailsColumns(this.i18n);
      this.cd.markForCheck();
    });
  }

  /**
   * @description Dynamically generates toolbar button definitions based on user permissions and component state (e.g., active vs. trash table view).
   * @returns Array of button objects with applied logic for visibility and state labeling.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.createUserRequestToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible
            ? this.t('toolbar_hide_filters')
            : this.t('toolbar_filters');
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
        case 'triggerImport':
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable
            ? this.t('toolbar_show_active')
            : this.t('toolbar_show_trash');
          updatedBtn.isActive = this.showTrashTable;
          break;
      }

      return updatedBtn;
    });
  }

  /**
   * @description Maps incoming action strings from the toolbar to their corresponding component methods.
   * @param action The unique action key from the button configuration.
   */
  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      exportActiveTable: () => this.exportActiveTable(),
      triggerImport: () => this.activeTable?.importData(),
      openEmailTemplateEditor: () => this.openEmailTemplateEditor(),
      openGraphBuilder: () => this.openGraphBuilder(),
      toggleTable: () => this.toggleTable()
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  /**
   * @description Merges new filter criteria with existing ones and resets the table view to the first page.
   * @param newFilters The filter object containing sorting and filtering criteria.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets the filter state to default parameters and triggers a data refresh.
   */
  clearFilters(): void {
    this.filters = { sort_by: 'id', sort_direction: 'desc' };
    this.currentPage = 1;
    this.refreshData();
  }

  handlePageChange(page: number): void {
    this.onHandlePageChange(page, this.filters);
  }

  handleItemsPerPageChange(value: number): void {
    this.onHandleItemsPerPageChange(value, this.filters);
  }

  /**
   * @description Initiates the CSV file generation for the currently displayed table.
   */
  exportActiveTable(): void {
    if (this.activeTable) {
      this.activeTable.exportToCSV();
    }
  }

  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = true;
  }

  /**
   * @description Prepares an existing item for modification by copying it into the editing buffer.
   * @param item The record data to be edited.
   */
  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = { ...item };
    this.showCreateForm = true;
  }

  /**
   * @description Processes form submission, routing to either create or update API endpoints based on entity ID presence.
   * @param formData The data object derived from the form interaction.
   */
  /**
   * @bugfix-note (2026-08-25) BACKLOG "alert dialogy až podle API odpovědi":
   * `FormBuilderComponent` už neukazuje žádný zelený toast sám od sebe (dřív ho
   * ukazoval hned po emitu, ještě před HTTP requestem, takže při 422 chybě uživatel
   * viděl NEJDŘÍV zelený "úspěch" a hned poté červenou chybu). Zelený toast se teď
   * zobrazuje VÝHRADNĚ tady, v `next()` callbacku - tedy až po reálném úspěchu z API.
   * @bugfix-note (2026-08-31) Odstraněn duplicitní `alertDialogService.open('Chyba', ...)`
   * z `error:` callbacku - viz bugfix-note v hlavičce souboru.
   */
  handleFormSubmitted(formData: any): void {
    const request$ = formData.id
      ? this.updateData(formData.id, formData)
      : this.postData(formData);

    request$.pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.alertDialogService.open(this.t('crud_success_title'), formData.id ? this.t('crud_updated_message') : this.t('crud_created_message'), 'success');
        this.refreshData();
      }
    });
  }

  /**
   * @description Retrieves detailed information for a specific request record.
   * @param item The request item to be inspected.
   * @bugfix-note (2026-08-31) Odstraněn duplicitní `alertDialogService.open('Chyba', ...)`
   * z `error:` callbacku - viz bugfix-note v hlavičce souboru.
   */
  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      }
    });
  }

  handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
  }

  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }

  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }

  // ── Šablona potvrzovacího e-mailu (modal) ──────────────────────────────

  /**
   * @description Otevře modal pro editaci šablony potvrzovacího e-mailu. Nezávisle
   * načte (1) seznam dostupných jazyků (`languages/web`, stejný modul jako
   * WebSettingsComponent) a (2) aktuálně uložené texty
   * (`GET web/settings/raw-request-email-template`). Bez TTL cache - modal se otevírá
   * příležitostně, čerstvý fetch při každém otevření je v pořádku.
   * @bugfix-note (2026-08-31) Odstraněn duplicitní `alertDialogService.open('Chyba', ...)`
   * z `error:` callbacku šablony (jazykový fallback beze změny, žádný toast tam nikdy
   * nebyl) - viz bugfix-note v hlavičce souboru.
   */
  openEmailTemplateEditor(): void {
    this.showEmailTemplateModal = true;
    this.emailTemplateLoading = true;
    this.cd.markForCheck();

    this.dataHandler.get<{ languages: EmailTemplateLang[] }>('languages/web').subscribe({
      next: (res) => {
        this.emailTemplateLanguages = (res?.languages ?? []).filter(l => l.active !== false);
        if (
          this.emailTemplateLanguages.length > 0 &&
          !this.emailTemplateLanguages.find(l => l.code === this.emailTemplateCurrentLang)
        ) {
          this.emailTemplateCurrentLang = this.emailTemplateLanguages[0].code;
        }
        this.emailTemplateLanguages.forEach(l => this.ensureLabelsForLang(l.code));
        this.ensureLabelsForLang(this.emailTemplateCurrentLang);
        this.cd.markForCheck();
      },
      error: () => {
        // Neblokující - bez seznamu jazyků zůstane aspoň výchozí 'cz' tab funkční.
        // Název jazyka samotného ('Čeština') ZŮSTÁVÁ nepřeložen - viz refactor-note
        // (2026-09) v hlavičce souboru.
        this.emailTemplateLanguages = [{ code: 'cz', name: 'Čeština' }];
        this.ensureLabelsForLang('cz');
        this.cd.markForCheck();
      }
    });

    this.dataHandler.get<any>('web/settings/raw-request-email-template').subscribe({
      next: (template) => {
        this.emailTemplate = {
          subject_i18n: template?.raw_request_email_subject_i18n ?? {},
          title_i18n: template?.raw_request_email_title_i18n ?? {},
          intro_i18n: template?.raw_request_email_intro_i18n ?? {},
          outro_i18n: template?.raw_request_email_outro_i18n ?? {},
          labels_i18n: template?.raw_request_email_labels_i18n ?? {},
        };
        this.ensureLabelsForLang(this.emailTemplateCurrentLang);
        this.emailTemplateLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.emailTemplateLoading = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Zajistí, že `emailTemplate.labels_i18n[lang]` je vždy reálný objekt
   * (ne `undefined`) PŘED tím, než na něj šablona naváže `[(ngModel)]` na vnořenou
   * vlastnost (`labels_i18n[lang].greeting` apod.) - bez toho by čtení/zápis vlastnosti
   * na `undefined` shodilo běhovou chybu. Volá se při načtení jazyků, při načtení
   * šablony i při přepnutí tabu - nezávisle na pořadí, ve kterém dorazí dva paralelní
   * HTTP požadavky výše.
   */
  private ensureLabelsForLang(lang: string): void {
    if (!this.emailTemplate.labels_i18n[lang]) {
      this.emailTemplate.labels_i18n[lang] = {};
    }
  }

  /** @description Přepne jazykový tab v modalu šablony - beze změny vybraného textu, jen zobrazený jazyk. */
  switchEmailTemplateLang(code: string): void {
    this.ensureLabelsForLang(code);
    this.emailTemplateCurrentLang = code;
    this.cd.markForCheck();
  }

  closeEmailTemplateEditor(): void {
    if (this.emailTemplateSaving) return;
    this.showEmailTemplateModal = false;
  }

  /**
   * @description Uloží šablonu potvrzovacího e-mailu. Endpoint je záměrně BEZ
   * `confirm_password` (na rozdíl od maintenance toggle) - editace textu e-mailu není
   * bezpečnostně citlivá akce, jen `web-user-requests-update` permission na route úrovni.
   * @bugfix-note (2026-08-31) Odstraněn duplicitní `alertDialogService.open('Chyba', ...)`
   * z `error:` callbacku - reset `emailTemplateSaving` ZŮSTÁVÁ, jen se odstranilo
   * volání toastu. Viz bugfix-note v hlavičce souboru.
   */
  saveEmailTemplate(): void {
    if (this.emailTemplateSaving) return;
    this.emailTemplateSaving = true;
    this.cd.markForCheck();

    const payload = {
      raw_request_email_subject_i18n: this.emailTemplate.subject_i18n,
      raw_request_email_title_i18n: this.emailTemplate.title_i18n,
      raw_request_email_intro_i18n: this.emailTemplate.intro_i18n,
      raw_request_email_outro_i18n: this.emailTemplate.outro_i18n,
      raw_request_email_labels_i18n: this.emailTemplate.labels_i18n,
    };

    this.dataHandler.put<any>('web/settings/raw-request-email-template', payload).subscribe({
      next: () => {
        this.emailTemplateSaving = false;
        this.showEmailTemplateModal = false;
        this.alertDialogService.open(this.t('email_tpl_saved_title'), this.t('email_tpl_saved_message'), 'success');
        this.cd.markForCheck();
      },
      error: () => {
        this.emailTemplateSaving = false;
        this.cd.markForCheck();
      }
    });
  }

  // ── Živý náhled e-mailu ─────────────────────────────────────────────────
  // Gettery čtené přímo v šabloně modalu - Angular je znovu vyhodnotí při každé
  // change detection (OnPush komponenta se překontroluje i na vlastní DOM eventy,
  // tzn. i na (ngModelChange) z inputů výše), takže náhled reaguje na každý úhoz bez
  // jakéhokoliv dalšího zásahu (žádný debounce, žádný HTTP request). Fallback logika
  // 1:1 kopíruje `RawRequestEmailTemplate::resolve()`/`resolveLabel()` na backendu -
  // náhled tak přesně odpovídá tomu, co reálně dostane zákazník.

  private get currentEmailLabels(): Partial<EmailTemplateLabels> {
    return this.emailTemplate.labels_i18n[this.emailTemplateCurrentLang] || {};
  }

  get previewSubject(): string {
    return this.emailTemplate.subject_i18n[this.emailTemplateCurrentLang] || this.emailTemplateDefaults.subject;
  }
  get previewTitle(): string {
    return this.emailTemplate.title_i18n[this.emailTemplateCurrentLang] || this.emailTemplateDefaults.title;
  }
  get previewIntro(): string {
    return this.emailTemplate.intro_i18n[this.emailTemplateCurrentLang] || this.emailTemplateDefaults.intro;
  }
  get previewOutro(): string {
    return this.emailTemplate.outro_i18n[this.emailTemplateCurrentLang] || this.emailTemplateDefaults.outro;
  }
  get previewGreeting(): string {
    return this.currentEmailLabels.greeting || this.emailTemplateDefaults.greeting;
  }
  get previewSummaryHeader(): string {
    return this.currentEmailLabels.summary_header || this.emailTemplateDefaults.summaryHeader;
  }
  get previewLabelThema(): string {
    return this.currentEmailLabels.label_thema || this.emailTemplateDefaults.labelThema;
  }
  get previewLabelEmail(): string {
    return this.currentEmailLabels.label_email || this.emailTemplateDefaults.labelEmail;
  }
  get previewLabelPhone(): string {
    return this.currentEmailLabels.label_phone || this.emailTemplateDefaults.labelPhone;
  }
  get previewLabelDescription(): string {
    return this.currentEmailLabels.label_description || this.emailTemplateDefaults.labelDescription;
  }
  get previewLabelAttachments(): string {
    return this.currentEmailLabels.label_attachments || this.emailTemplateDefaults.labelAttachments;
  }
  get previewLabelDate(): string {
    return this.currentEmailLabels.label_date || this.emailTemplateDefaults.labelDate;
  }

  // ── Grafy a reporty (modal) ─────────────────────────────────────────────

  /**
   * @description Otevře popup s grafy/reporty (`GraphBuilderComponent`) - narozdíl
   * od šablony e-mailu výše nemá co dopředu natahovat (popup si data i granularitu
   * bucketů řeší sám, viz graph-builder.component.ts), stačí jen zobrazit.
   */
  openGraphBuilder(): void {
    this.showGraphBuilder = true;
    this.cd.markForCheck();
  }

  closeGraphBuilder(): void {
    this.showGraphBuilder = false;
    this.cd.markForCheck();
  }
}