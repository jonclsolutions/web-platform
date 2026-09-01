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
 * @refactor-note (2026-08-19) BACKLOG "editovatelný obsah potvrzovacího e-mailu":
 * přidán modal "Potvrzovací e-mail" (`openEmailTemplateEditor()`) - jazykové taby
 * (stejný vzor jako `WebSettingsComponent` - `emailTemplateLanguages`/
 * `emailTemplateCurrentLang`), 3 editovatelná pole (nadpis/úvod/závěr, každé i18n
 * objekt keyed jazykovým kódem) proti novým endpointům
 * `GET/PUT web/settings/raw-request-email-template` (`WebSiteSettingController`).
 * "Souhrn" (rekapitulace požadavku v e-mailu) záměrně NENÍ editovatelný - je to
 * generovaný obsah, viz poznámka v šabloně modalu. Gatováno stejným oprávněním jako
 * editace požadavku (`web-user-requests-update`) - žádný nový permission klíč.
 * @bugfix-note (2026-08-19v3) SKUTEČNÁ PŘÍČINA "nejde psát do inputů/nejde
 * resizovat textarea": overlay má `(mousedown)="$event.target === $event.currentTarget
 * && closeEmailTemplateEditor()"`. `mousedown` VŽDY bubbla až k overlayi bez ohledu na
 * to, kde uvnitř karty vznikl - když se klikne na textarea, výraz se vyhodnotí jako
 * `false` (target ≠ currentTarget, `&&` se zkrátí, `closeEmailTemplateEditor()` se
 * nezavolá). Angular ale na `(event)="výraz"`, který vrátí `false`, reaguje jako na
 * klasické `onclick="return false"` a zavolá `event.preventDefault()` na PŮVODNÍ
 * nativní event - to zruší výchozí prohlížečovou akci mousedown, což je jak nastavení
 * focusu (nejde psát), tak zahájení resize dragu (nejde roztáhnout textarea). Předchozí
 * `(click)="$event.stopPropagation()"` na kartě tohle neřešilo, protože zastavovalo
 * ŠPATNÝ typ eventu (`click`, ne `mousedown`) - opraveno na
 * `(mousedown)="$event.stopPropagation()"`, takže `mousedown` z karty už k overlayi
 * vůbec nedobublá a `preventDefault()` se nikdy nezavolá. GraphBuilderComponent
 * (2026-08-26) používá STEJNÝ vzor od začátku - viz onOverlayMouseDown() tam.
 *
 * @refactor-note (2026-08-24) KONSOLIDACE TOOLBAR TLAČÍTEK (viz action-menu-builder
 * a user-request.config.ts stejné datum): `<app-button-builder>` v šabloně nahrazeno
 * `<app-action-menu-builder>` - stejný `toolbarButtons` config, jen se teď vykresluje
 * jako jedno tlačítko "Akce" s vysouvacím seznamem místo řady pilulek vedle sebe.
 * `handleToolbarAction()` dostal novou větev `triggerImport` -> deleguje na
 * `this.activeTable.importData()` (stejný princip jako `exportActiveTable` ->
 * `this.activeTable.exportToCSV()`). Tlačítko "Aktualizovat" zmizelo z hlavního
 * toolbaru úplně - žije teď jen jako malá ikona uvnitř `TableBuilderComponent`
 * (`table-refresh-icon-btn`), tahle stránka ho nijak neřídí.
 *
 * @refactor-note (2026-08-26) BACKLOG "graph-builder: grafy a reporty nad tabulkami":
 * přidán modal "Grafy a reporty" (`openGraphBuilder` toolbar akce, `showGraphBuilder`
 * flag) - generický `<app-graph-builder>` popup (viz graph-builder.component.ts),
 * řízený `graphColumns` getterem, který z `USER_REQUEST_DETAILS_COLUMNS` vybírá jen
 * sloupce s `chartable: true` (viz user-request.config.ts a item-details-columns.ts
 * stejné datum). Gatováno `web-user-requests-view` (čtecí, read-only report), ne
 * `-update`/`-create` jako ostatní nová tlačítka výše - report nic nemění, jen čte
 * a agreguje existující data. `GraphBuilderComponent` je zde importován JEDNOTLIVĚ,
 * stejně jako `ActionMenuBuilderComponent` (viz poznámka u @Component níže) - dokud
 * nejsou obě součástí `SHARED_UI_BUILDERS` bundle.
 *
 * @bugfix-note (2026-08-31) KRITICKÝ BUG - DVOJITÉ ZOBRAZENÍ CHYBOVÉ HLÁŠKY: Odstraněna
 * VŠECHNA vlastní `alertDialogService.open('Chyba', ...)` volání z `error:` callbacků
 * (handleFormSubmitted, handleViewDetails, openEmailTemplateEditor, saveEmailTemplate) -
 * `DataHandler.handleError()` je od tohoto data JEDINÉ a AUTORITATIVNÍ místo, které smí
 * chybový toast zobrazit (viz data-handler.service.ts bugfix-note stejné datum).
 * Dřívější duplicitní volání způsobovala DVĚ červené hlášky na jednu chybu. Reset
 * stavových flagů (emailTemplateLoading/emailTemplateSaving) ZŮSTÁVÁ - odstraněno je
 * výhradně volání `alertDialogService.open(...)`.
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

  tableCaption: string = 'Webový formulář';

  override apiEndpoint: string = 'web/raw_request_commissions';

  buttons = Config.USER_REQUEST_BUTTONS;
  formFields = Config.USER_REQUEST_FORM_FIELDS;
  userRequestColumns = Config.USER_REQUEST_COLUMNS;
  trashUserRequestColumns = Config.USER_REQUEST_TRASH_COLUMNS;
  filterColumns = Config.USER_REQUEST_FILTER_COLUMNS;
  detailsColumns = Config.USER_REQUEST_DETAILS_COLUMNS;

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
   */
  private readonly emailTemplateDefaults = {
    subject: 'Vaše poptávka byla přijata',
    title: 'Vaše poptávka byla přijata',
    intro: 'děkujeme za Vaši poptávku. Byla úspěšně přijata a náš tým se jí bude v nejbližší době věnovat.',
    outro: 'V případě dotazů nás neváhejte kontaktovat.',
    greeting: 'Dobrý den,',
    summaryHeader: 'Rekapitulace poptávky',
    labelThema: 'Téma',
    labelEmail: 'Kontaktní e-mail',
    labelPhone: 'Telefon',
    labelDescription: 'Popis požadavku',
    labelAttachments: 'Přiložené soubory',
    labelDate: 'Datum přijetí',
  };

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
   * @description Chartable podmnožina `USER_REQUEST_DETAILS_COLUMNS` namapovaná na
   * minimální tvar, který `GraphBuilderComponent` potřebuje. Sloupce s osobními údaji
   * (email, telefon, volný text) v `USER_REQUEST_DETAILS_COLUMNS` záměrně NEMAJÍ
   * `chartable: true` - report tak z podstaty configu nikdy neobsahuje PII, viz
   * item-details-columns.ts (2026-08-26).
   */
     readonly graphColumns: GraphColumnOption[] = Config.USER_REQUEST_DETAILS_COLUMNS
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
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

  /**
   * @description Dynamically generates toolbar button definitions based on user permissions and component state (e.g., active vs. trash table view).
   * @returns Array of button objects with applied logic for visibility and state labeling.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.USER_REQUEST_TOOLBAR_BUTTONS.map(btn => {
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
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? 'Zobrazit aktivní' : 'Koš';
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
        this.alertDialogService.open('Úspěch', formData.id ? 'Požadavek byl upraven.' : 'Požadavek byl vytvořen.', 'success');
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
        this.alertDialogService.open('Uloženo', 'Šablona potvrzovacího e-mailu byla uložena.', 'success');
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