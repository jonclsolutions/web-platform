/**
 * @file projects.component.ts
 * @path src/app/admin/web-pages/projects/projects.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Administrative component for managing customer Projects, including a
 * secondary independently-paginated table of cross-project customer threads.
 * @note Druhá tabulka (`threadsData`/`threadsFilters`/...) je natahována ručně přes
 * `genericTableService.getPaginatedData()`, protože `BaseDataComponent` spravuje jen
 * jeden primární `apiEndpoint` (projekty). Dva modaly ("Správa" pro konkrétní projekt,
 * "Vlákno" pro cross-project tabulku) sdílí stejný scroll-lock mechanismus a `pm-*` CSS.
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání ze VŠECH `error:`/`catch` bloků čistě HTTP volání (handleViewDetails,
 * handleFormSubmitted, regeneratePassword, addCheckpoint, deleteCheckpoint,
 * changeThreadStatus, sendReply, sendThreadModalReply) - `DataHandler.handleError()`
 * je jediné autoritativní místo pro chybový toast. `loadOrderOptions()` už žádný toast
 * neměl, beze změny.
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.*` konstanty nahrazeny `Config.create*()` factory funkcemi, stejný vzor jako
 * ostatní web-pages stránky. `checkpointStatusLabels` (dřív `readonly` field
 * initializer) přepsán na `Config.createCheckpointStatusLabels(i18n)`, přepočítávaný
 * ve stejném `translations$.subscribe()` bloku. `graphColumns` přestalo být `readonly`.
 * `threadStatusLabel()`/`threadAuthorLabel()` NOVÉ pomocné metody nahrazují inline
 * ternární operátory v šabloně (`thread.status === 'closed' ? 'Uzavřeno' : 'Aktivní'`,
 * `msg.author_type === 'admin' ? 'Administrátor' : 'Zákazník'`) - šablona teď volá
 * `t()`-backed metodu místo natvrdo psaného českého textu přímo v HTML. VŠECHNY
 * `alertDialogService.open()`/`confirmDialogService.open()` texty přepsány na `t()`.
 * `loadOrderOptions()` teď používá `Config.createNoOrderOptionLabel(i18n)` pro placeholder
 * option - SDÍLENÝ s `createProjectFormFields()`, aby oba texty ("Bez realizace...")
 * vždy odpovídaly stejnému i18n klíči.
 *
 * @refactor-note (2026-09-11v3) BACKLOG "vlákna přijímají přílohy": `ProjectAttachment`
 * interface + `attachments` pole na `ProjectThreadMessage`. `replyFiles`/
 * `threadModalReplyFiles` - vybrané soubory PŘED odesláním (max 5). `sendReply()`/
 * `sendThreadModalReply()` staví `FormData` MÍSTO plain `{ body }`, jakmile je vybraný
 * alespoň jeden soubor (`DataHandler.post()` funguje beze změny - `FormData` detekce
 * je uvnitř `getHeaders()`). `formatFileSize()` pro zobrazení existujících příloh.
 *
 * @refactor-note (2026-09-11v4) BACKLOG "otevření vlákna ukazuje nejstarší zprávu /
 * vlákno s 1000 zprávami nemá načítat všechny najednou": `openThread()`/
 * `openThreadModal()` po úspěšném načtení scrollují `.pm-message-list` na SPODEK
 * (nejnovější zprávy) přes `pmMessageListEl`/`threadModalMessageListEl` ViewChild +
 * `scrollMessagesToBottom()`. `has_more_older_messages` flag z backendu řídí
 * viditelnost tlačítka "Načíst starší zprávy" (`loadOlderMessages()`/
 * `loadOlderThreadModalMessages()`) - nová dávka se PŘEDŘADÍ před stávající lokální
 * seznam, scroll pozice se zachová (rozdíl `scrollHeight` PŘED/PO).
 *
 * @refactor-note (2026-09-11v4) BACKLOG "real-time validace příloh na frontendu":
 * `validateAndAddFiles()` - kontroluje příponu, velikost a počet HNED při výběru
 * souboru, ne až po odeslání na server. Odmítnuté soubory se do `replyFiles`/
 * `threadModalReplyFiles` vůbec nedostanou, chybová hláška se zobrazí okamžitě pod
 * file inputem (`replyFileError`/`threadModalReplyFileError`).
 */

import { Component, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { EntityCrudService } from '../../../core/services/entitiy-crud.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import * as Config from './projects.config';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';


interface ProjectCheckpoint {
  id: number;
  label: string;
  status: 'new' | 'active' | 'done';
  sort_order: number;
}

interface ProjectAttachment {
  id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number;
  download_url: string;
  view_url: string;
}

interface ProjectThreadMessage {
  id: number;
  author_type: 'customer' | 'admin';
  author_label: string | null;
  body: string;
  attachments?: ProjectAttachment[];
  created_at: string;
}

interface ProjectThread {
  id: number;
  project_id?: number;
  project_name?: string;
  subject: string;
  priority: string;
  status: string;
  last_message_at: string | null;
  has_more_older_messages?: boolean;
  messages?: ProjectThreadMessage[];
}

interface RevealedPassword {
  password: string;
  url: string;
  generatedAt: string;
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, FormsModule, GraphBuilderComponent],
  templateUrl: './projects.component.html',
  styleUrls: ['../default-style.css', './project-manage-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  @ViewChild('threadsTable') threadsTable!: TableBuilderComponent;
  @ViewChild('pmMessageListEl') pmMessageListEl?: ElementRef<HTMLDivElement>;
  @ViewChild('threadModalMessageListEl') threadModalMessageListEl?: ElementRef<HTMLDivElement>;

  protected override translationSection: string = 'projects';

  public override t(key: string): string {
    return this.i18n.getValue(`projects.${key}`);
  }

  tableCaption: string = '';
  threadsTableCaption: string = '';

  override apiEndpoint: string = 'web/projects';

  buttons: Core.TableButtons[] = [];
  formFields: Core.InputDefinition[] = [];
  projectColumns: Core.ColumnDefinition[] = [];
  trashProjectColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

  filters: Core.FilterParams = { sort_by: 'id', sort_direction: 'desc' };

  private prefillOrderId: string | null = null;

  // ── "Správa" modal (jeden konkrétní projekt: Přístup / Checkpointy / Konverzace) ──
  showManageModal = false;
  manageLoading = false;
  managingProject: any | null = null;
  managingCheckpoints: ProjectCheckpoint[] = [];
  managingThreads: ProjectThread[] = [];
  newCheckpointLabel = '';
  checkpointBusyIds = new Set<number>();

  selectedThread: ProjectThread | null = null;
  threadDetailLoading = false;
  olderMessagesLoading = false;
  replyBody = '';
  replySending = false;
  /** @refactor-note (2026-09-11v3) Vybrané soubory pro odpověď ve "Správa" modalu. */
  replyFiles: File[] = [];
  replyFileError: string | null = null;

  passwordRegenerating = false;

  revealedPassword: RevealedPassword | null = null;
  passwordVisible = false;

  /** @refactor-note (2026-09-08) Přestalo být `readonly` field initializer - viz hlavička souboru. */
  checkpointStatusLabels: Record<string, string> = {};

  private readonly PASSWORD_STORAGE_PREFIX = 'rpsw_project_pw_';
  private readonly MAX_THREAD_ATTACHMENTS = 5;
  private readonly ALLOWED_ATTACHMENT_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv',
    'ppt', 'pptx', 'odp', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'zip', 'rar', '7z',
  ];
  private readonly MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;

  private savedScrollY = 0;

  // ── Cross-project tabulka požadavků ─────────────────────────────────────
  readonly threadsApiEndpoint = 'web/project-threads';
  threadColumns: Core.ColumnDefinition[] = [];
  threadButtons: Core.TableButtons[] = [];
  threadFilterColumns: Core.FilterColumns[] = [];
  threadDetailsColumns: Core.ItemDetailsColumns[] = [];
  threadFormFields: Core.InputDefinition[] = [];

  threadsData: any[] = [];
  threadsFilters: Core.FilterParams = { sort_by: 'last_message_at', sort_direction: 'desc', status: 'active' };
  threadsCurrentPage = 1;
  threadsItemsPerPage = 15;
  threadsTotalPages = 1;
  threadsTotalItems = 0;
  isThreadsFilterVisible = false;

  showThreadModal = false;
  activeThread: any | null = null;
  threadModalLoading = false;
  threadModalOlderMessagesLoading = false;
  threadModalReplyBody = '';
  threadModalReplySending = false;
  /** @refactor-note (2026-09-11v3) Vybrané soubory pro odpověď v cross-project thread modalu. */
  threadModalReplyFiles: File[] = [];
  threadModalReplyFileError: string | null = null;

  private _checkpointsCrud?: EntityCrudService<ProjectCheckpoint>;
  private get checkpointsCrud(): EntityCrudService<ProjectCheckpoint> {
    if (!this._checkpointsCrud) {
      this._checkpointsCrud = new EntityCrudService<ProjectCheckpoint>(
        this.dataHandler,
        () => `web/projects/${this.managingProject?.id}/checkpoints`,
        this.destroy$,
        () => this.cd.markForCheck()
      );
    }
    return this._checkpointsCrud;
  }

  private _projectThreadsCrud?: EntityCrudService<ProjectThread>;
  private get projectThreadsCrud(): EntityCrudService<ProjectThread> {
    if (!this._projectThreadsCrud) {
      this._projectThreadsCrud = new EntityCrudService<ProjectThread>(
        this.dataHandler,
        () => 'web/project-threads',
        this.destroy$,
        () => this.cd.markForCheck()
      );
    }
    return this._projectThreadsCrud;
  }

  /** @refactor-note (2026-09-08) Přestalo být `readonly` - viz hlavička souboru. */
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router,
    private activatedRoute: ActivatedRoute,
    private confirmDialogService: ConfirmDialogService
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.threadsTableCaption = this.t('thread_table_header');
      this.buttons = Config.createProjectButtons(this.i18n);
      this.formFields = Config.createProjectFormFields(this.i18n);
      this.projectColumns = Config.createProjectColumns(this.i18n);
      this.trashProjectColumns = Config.createProjectTrashColumns(this.i18n);
      this.filterColumns = Config.createProjectFilterColumns(this.i18n);
      this.detailsColumns = Config.createProjectDetailsColumns(this.i18n);
      this.checkpointStatusLabels = Config.createCheckpointStatusLabels(this.i18n);
      this.threadColumns = Config.createProjectThreadColumns(this.i18n);
      this.threadButtons = Config.createProjectThreadButtons(this.i18n);
      this.threadFilterColumns = Config.createProjectThreadFilterColumns(this.i18n);
      this.threadDetailsColumns = Config.createProjectThreadDetailsColumns(this.i18n);
      this.graphColumns = this.detailsColumns
        .filter(col => col.chartable === true)
        .map(col => ({
          key: col.key,
          label: col.displayName,
          aggregation: col.chartAggregation ?? 'count',
          possibleValues: col.chartPossibleValues,
        }));
      this.cd.markForCheck();
    });
  }

  get toolbarButtons(): Core.Button[] {
    return Config.createProjectToolbarButtons(this.i18n).map(btn => {
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
          if (updatedBtn.showIf !== false) updatedBtn.showIf = !this.showTrashTable;
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? this.t('toolbar_show_active') : this.t('toolbar_show_trash');
          updatedBtn.isActive = this.showTrashTable;
          break;
      }
      return updatedBtn;
    });
  }

  get threadsToolbarButtons(): Core.Button[] {
    return Config.createProjectThreadToolbarButtons(this.i18n).map(btn => {
      const updated = { ...btn };
      if (btn.action === 'toggleThreadsFilters') {
        updated.label = this.isThreadsFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
        updated.isActive = this.isThreadsFilterVisible;
      }
      return updated;
    });
  }

  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      exportActiveTable: () => this.exportActiveTable(),
      toggleTable: () => this.toggleTable(),
      openGraphBuilder: () => this.openGraphBuilder(),
    };
    if (actions[action]) actions[action]();
  }

  handleThreadsToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleThreadsFilters: () => { this.isThreadsFilterVisible = !this.isThreadsFilterVisible; this.cd.markForCheck(); },
      exportThreadsTable: () => this.threadsTable?.exportToCSV(),
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
    this.checkQueryParamsForPrefill();
    this.loadThreadsTable();
  }

  private checkQueryParamsForPrefill(): void {
    const openProjectId = this.activatedRoute.snapshot.queryParamMap.get('open_project');
    if (openProjectId) {
      this.openManageModal({ id: openProjectId });
      return;
    }

    const orderId = this.activatedRoute.snapshot.queryParamMap.get('order_id');
    if (!orderId) return;

    this.prefillOrderId = orderId;
    this.loadOrderOptions(() => {
      this.selectedItemForEdit = { order_id: orderId };
      this.showCreateForm = true;
      this.cd.markForCheck();
    });
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  clearFilters(): void {
    this.filters = { sort_by: 'id', sort_direction: 'desc' };
    this.currentPage = 1;
    this.refreshData();
  }

  handlePageChange(page: number): void { this.onHandlePageChange(page, this.filters); }
  handleItemsPerPageChange(value: number): void { this.onHandleItemsPerPageChange(value, this.filters); }

  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  /**
   * @refactor-note (2026-09-08) `— Bez realizace...` placeholder teď přes
   * `Config.createNoOrderOptionLabel(i18n)` - SDÍLENÝ text s `createProjectFormFields()`.
   */
  private loadOrderOptions(onLoaded: () => void): void {
    this.dataHandler.getCollection<any>('web/sales_orders', { no_pagination: 'true', sort_by: 'id', sort_direction: 'desc' })
      .subscribe({
        next: (orders) => {
          const orderField = this.formFields.find(f => f.column_name === 'order_id');
          if (orderField) {
            orderField.options = [
              { value: '', label: Config.createNoOrderOptionLabel(this.i18n) },
              ...orders.map((o: any) => ({ value: String(o.id), label: `#${o.id} — ${o.client_name}` })),
            ];
          }
          onLoaded();
        },
        error: () => onLoaded()
      });
  }

  handleCreateFormOpened(): void {
    this.loadOrderOptions(() => {
      this.selectedItemForEdit = this.prefillOrderId ? { order_id: this.prefillOrderId } : null;
      this.showCreateForm = true;
      this.cd.markForCheck();
    });
  }

  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = { ...item };
    this.showCreateForm = true;
  }

  handleFormSubmitted(formData: any): void {
    const request$ = formData.id ? this.updateData(formData.id, formData) : this.postData(formData);

    request$.pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.prefillOrderId = null;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: (result: any) => {
        if (!formData.id && result?.generated_password) {
          this.storeRevealedPassword(result.id, result.generated_password, result.public_url);
          this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('project_created_message'), 'success');
          this.refreshData();
          this.openManageModal(result);
        } else {
          this.alertDialogService.open(this.i18n.getValue('shared.success'), this.t('project_updated_message'), 'success');
          this.refreshData();
        }
      }
    });
  }

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
    this.prefillOrderId = null;
    this.cd.markForCheck();
  }

  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }

  // ── "Správa" modal ────────────────────────────────────────────────────

  openManageModal(item: any): void {
    this.showManageModal = true;
    this.manageLoading = true;
    this.selectedThread = null;
    this.replyBody = '';
    this.replyFiles = [];
    this.replyFileError = null;
    this.passwordVisible = false;
    this.lockBackgroundScroll();
    this.cd.markForCheck();

    this.getItemDetails(item.id).subscribe({
      next: (project: any) => {
        this.managingProject = project;
        this.managingCheckpoints = project.checkpoints ?? [];
        this.revealedPassword = this.loadRevealedPassword(project.id);
        this.manageLoading = false;
        this.loadManagingThreads(project.id);
        this.cd.markForCheck();
      },
      error: () => {
        this.manageLoading = false;
        this.showManageModal = false;
        this.unlockBackgroundScroll();
        this.cd.markForCheck();
      }
    });
  }

  private loadManagingThreads(projectId: number): void {
    this.projectThreadsCrud.getCollection({ project_id: projectId, no_pagination: 'true' })
      .subscribe({
        next: (threads) => { this.managingThreads = threads; this.cd.markForCheck(); }
      });
  }

  closeManageModal(): void {
    this.showManageModal = false;
    this.managingProject = null;
    this.managingCheckpoints = [];
    this.managingThreads = [];
    this.selectedThread = null;
    this.revealedPassword = null;
    this.unlockBackgroundScroll();
  }

  private storeRevealedPassword(projectId: number, password: string, url: string): void {
    const entry: RevealedPassword = { password, url, generatedAt: new Date().toISOString() };
    try {
      sessionStorage.setItem(`${this.PASSWORD_STORAGE_PREFIX}${projectId}`, JSON.stringify(entry));
    } catch { /* ignore */ }
    this.revealedPassword = entry;
  }

  private loadRevealedPassword(projectId: number): RevealedPassword | null {
    try {
      const raw = sessionStorage.getItem(`${this.PASSWORD_STORAGE_PREFIX}${projectId}`);
      return raw ? JSON.parse(raw) as RevealedPassword : null;
    } catch {
      return null;
    }
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  copyPassword(): void {
    if (!this.revealedPassword) return;
    navigator.clipboard?.writeText(this.revealedPassword.password);
    this.alertDialogService.open(this.t('copied_title'), this.t('password_copied_message'), 'success');
  }

  copyPublicUrl(): void {
    const url = this.revealedPassword?.url ?? this.managingProject?.public_url;
    if (!url) return;
    navigator.clipboard?.writeText(url);
    this.alertDialogService.open(this.t('copied_title'), this.t('url_copied_message'), 'success');
  }

  async regeneratePassword(): Promise<void> {
    if (!this.managingProject || this.passwordRegenerating) return;
    const confirmed = await this.confirmDialogService.open(
      this.t('regenerate_password_confirm_title'),
      this.t('regenerate_password_confirm_message')
    );
    if (!confirmed) return;

    this.passwordRegenerating = true;
    this.cd.markForCheck();

    this.dataHandler.post<{ generated_password: string }>(`web/projects/${this.managingProject.id}/regenerate-password`, {})
      .subscribe({
        next: (res) => {
          this.passwordRegenerating = false;
          this.storeRevealedPassword(this.managingProject.id, res.generated_password, this.managingProject.public_url);
          this.passwordVisible = true;
          this.alertDialogService.open(this.t('password_regenerated_title'), this.t('password_regenerated_message'), 'success');
          this.cd.markForCheck();
        },
        error: () => {
          this.passwordRegenerating = false;
          this.cd.markForCheck();
        }
      });
  }

  addCheckpoint(): void {
    const label = this.newCheckpointLabel.trim();
    if (!label || !this.managingProject) return;

    this.checkpointsCrud.create({ label } as any).subscribe({
      next: (checkpoint) => {
        this.managingCheckpoints = [...this.managingCheckpoints, checkpoint];
        this.newCheckpointLabel = '';
        this.cd.markForCheck();
      }
    });
  }

  cycleCheckpointStatus(checkpoint: ProjectCheckpoint): void {
    if (this.checkpointBusyIds.has(checkpoint.id) || !this.managingProject) return;
    const nextStatus = Config.CHECKPOINT_STATUS_CYCLE[checkpoint.status] as ProjectCheckpoint['status'];

    this.checkpointBusyIds.add(checkpoint.id);
    this.checkpointsCrud.update(checkpoint.id, { status: nextStatus } as any).subscribe({
      next: (updated) => {
        checkpoint.status = updated.status;
        this.checkpointBusyIds.delete(checkpoint.id);
        this.cd.markForCheck();
      },
      error: () => { this.checkpointBusyIds.delete(checkpoint.id); this.cd.markForCheck(); }
    });
  }

  async deleteCheckpoint(checkpoint: ProjectCheckpoint): Promise<void> {
    if (!this.managingProject) return;
    const confirmed = await this.confirmDialogService.open(
      this.t('delete_checkpoint_confirm_title'),
      this.t('delete_checkpoint_confirm_message').replace('{label}', checkpoint.label)
    );
    if (!confirmed) return;

    this.checkpointsCrud.remove(checkpoint.id).subscribe({
      next: () => {
        this.managingCheckpoints = this.managingCheckpoints.filter(c => c.id !== checkpoint.id);
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @refactor-note (2026-09-11v4) Po úspěšném načtení scrolluje `.pm-message-list`
   * na spodek (nejnovější zprávy) - viz `scrollMessagesToBottom()`.
   */
  openThread(thread: ProjectThread): void {
    this.selectedThread = thread;
    this.threadDetailLoading = true;
    this.replyBody = '';
    this.replyFiles = [];
    this.replyFileError = null;
    this.cd.markForCheck();

    this.projectThreadsCrud.getOne(thread.id).subscribe({
      next: (full) => {
        this.selectedThread = full;
        this.threadDetailLoading = false;
        this.cd.markForCheck();
        this.scrollMessagesToBottom(this.pmMessageListEl);
      },
      error: () => { this.threadDetailLoading = false; this.cd.markForCheck(); }
    });
  }

  closeThread(): void {
    this.selectedThread = null;
    this.replyBody = '';
    this.replyFiles = [];
    this.replyFileError = null;
  }

changeThreadStatus(status: string): void {
  if (!this.selectedThread) return;
  this.dataHandler.put<ProjectThread>(`web/project-threads/${this.selectedThread.id}/status`, { status })
    .subscribe({
      next: (updated) => {
        this.selectedThread!.status = updated.status;

        const inManaging = this.managingThreads.find(t => t.id === this.selectedThread!.id);
        if (inManaging) inManaging.status = updated.status;

        // ← přidáno: okamžitá lokální aktualizace spodní cross-project tabulky
        const inThreadsData = this.threadsData.find(t => t.id === this.selectedThread!.id);
        if (inThreadsData) inThreadsData.status = updated.status;

        this.cd.markForCheck();
      }
    });
}

  /**
   * @refactor-note (2026-09-11v3) `FormData` MÍSTO plain `{ body }`, jakmile je vybraný
   * alespoň jeden soubor - `DataHandler.post()` funguje beze změny.
   */
  async sendReply(): Promise<void> {
    const body = this.replyBody.trim();
    if (!body || !this.selectedThread || this.replySending) return;

    this.replySending = true;
    this.cd.markForCheck();

    const payload: FormData | { body: string } = this.replyFiles.length > 0
      ? this.buildReplyFormData(body, this.replyFiles)
      : { body };

    try {
      await firstValueFrom(this.dataHandler.post(`web/project-threads/${this.selectedThread.id}/reply`, payload));
      this.patchThreadsDataLastMessageAt(this.selectedThread.id);   
      this.replyBody = '';
      this.replyFiles = [];
      this.openThread(this.selectedThread);
      if (this.managingProject) this.loadManagingThreads(this.managingProject.id);
      this.loadThreadsTable();
    } catch {
      // DataHandler.handleError() už zobrazil toast pro tuto HTTP chybu.
    } finally {
      this.replySending = false;
      this.cd.markForCheck();
    }
  }

  /**
   * @refactor-note (2026-09-08) NOVÉ - nahrazuje inline ternár v šabloně
   * (`thread.status === 'closed' ? 'Uzavřeno' : 'Aktivní'`). Přeložený text pro
   * DVĚ hodnoty thread `status`, ne generický `mapLabeledOptions()` lookup, protože se
   * volá přímo se syrovým `status` stringem mimo `options` pole (šablona nemá
   * `FilterColumns`/`InputDefinition` po ruce v tomhle konkrétním místě).
   */
  threadStatusLabel(status: string): string {
    return status === 'closed' ? this.t('thread_status_closed') : this.t('thread_status_active');
  }

  /** @refactor-note (2026-09-08) NOVÉ - nahrazuje inline ternár `msg.author_type === 'admin' ? 'Administrátor' : 'Zákazník'`. */
  threadAuthorLabel(authorType: 'customer' | 'admin'): string {
    return authorType === 'admin' ? this.t('thread_author_admin') : this.t('thread_author_customer');
  }

  // ── Přílohy - výběr souborů + REAL-TIME VALIDACE před odesláním ─────────

  formatFileSize(bytes: number): string {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /**
   * @refactor-note (2026-09-11v4) Validuje typ/velikost/počet HNED při výběru -
   * stejná pravidla jako backend `Store*Request` (`mimes:...`, `max:15360`).
   */
  private validateAndAddFiles(existing: File[], incoming: FileList, onError: (msg: string) => void): File[] {
    let result = [...existing];
    let errorSet = false;

    for (const file of Array.from(incoming)) {
      if (result.length >= this.MAX_THREAD_ATTACHMENTS) {
        if (!errorSet) { onError(this.t('attachment_error_too_many').replace('{max}', String(this.MAX_THREAD_ATTACHMENTS))); errorSet = true; }
        break;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!this.ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
        if (!errorSet) { onError(this.t('attachment_error_type').replace('{name}', file.name)); errorSet = true; }
        continue;
      }
      if (file.size > this.MAX_ATTACHMENT_SIZE_BYTES) {
        if (!errorSet) { onError(this.t('attachment_error_size').replace('{name}', file.name)); errorSet = true; }
        continue;
      }
      result.push(file);
    }

    return result;
  }

  onReplyFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.replyFileError = null;
    this.replyFiles = this.validateAndAddFiles(this.replyFiles, input.files, (msg) => { this.replyFileError = msg; });
    input.value = '';
    this.cd.markForCheck();
  }

  removeReplyFile(index: number): void {
    this.replyFiles.splice(index, 1);
    this.replyFileError = null;
    this.cd.markForCheck();
  }

  onThreadModalReplyFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.threadModalReplyFileError = null;
    this.threadModalReplyFiles = this.validateAndAddFiles(this.threadModalReplyFiles, input.files, (msg) => { this.threadModalReplyFileError = msg; });
    input.value = '';
    this.cd.markForCheck();
  }

  removeThreadModalReplyFile(index: number): void {
    this.threadModalReplyFiles.splice(index, 1);
    this.threadModalReplyFileError = null;
    this.cd.markForCheck();
  }

  private buildReplyFormData(body: string, files: File[]): FormData {
    const fd = new FormData();
    fd.append('body', body);
    files.forEach(file => fd.append('attachments[]', file, file.name));
    return fd;
  }

  // ── Scroll + stránkování zpráv ("Načíst starší") ────────────────────────

  private scrollMessagesToBottom(el?: ElementRef<HTMLDivElement>): void {
    setTimeout(() => {
      if (el?.nativeElement) el.nativeElement.scrollTop = el.nativeElement.scrollHeight;
    });
  }

  /** @refactor-note (2026-09-11v4) "Načíst starší zprávy" - "Správa" modal vlákno. */
  loadOlderMessages(): void {
    if (!this.selectedThread || this.olderMessagesLoading || !this.selectedThread.has_more_older_messages) return;
    const oldestId = this.selectedThread.messages?.[0]?.id;
    if (!oldestId) return;

    const container = this.pmMessageListEl?.nativeElement;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    this.olderMessagesLoading = true;
    this.cd.markForCheck();

    this.dataHandler.get<{ data: ProjectThreadMessage[]; has_more_older_messages: boolean }>(
      `web/project-threads/${this.selectedThread.id}/messages?before_message_id=${oldestId}`
    ).subscribe({
      next: (res) => {
        this.selectedThread!.messages = [...res.data, ...(this.selectedThread!.messages || [])];
        this.selectedThread!.has_more_older_messages = res.has_more_older_messages;
        this.olderMessagesLoading = false;
        this.cd.markForCheck();
        setTimeout(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      },
      error: () => { this.olderMessagesLoading = false; this.cd.markForCheck(); }
    });
  }

  /** @refactor-note (2026-09-11v4) "Načíst starší zprávy" - cross-project thread modal. */
  loadOlderThreadModalMessages(): void {
    if (!this.activeThread || this.threadModalOlderMessagesLoading || !this.activeThread.has_more_older_messages) return;
    const oldestId = this.activeThread.messages?.[0]?.id;
    if (!oldestId) return;

    const container = this.threadModalMessageListEl?.nativeElement;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    this.threadModalOlderMessagesLoading = true;
    this.cd.markForCheck();

    this.dataHandler.get<{ data: ProjectThreadMessage[]; has_more_older_messages: boolean }>(
      `web/project-threads/${this.activeThread.id}/messages?before_message_id=${oldestId}`
    ).subscribe({
      next: (res) => {
        this.activeThread.messages = [...res.data, ...(this.activeThread.messages || [])];
        this.activeThread.has_more_older_messages = res.has_more_older_messages;
        this.threadModalOlderMessagesLoading = false;
        this.cd.markForCheck();
        setTimeout(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      },
      error: () => { this.threadModalOlderMessagesLoading = false; this.cd.markForCheck(); }
    });
  }

  // ── Cross-project tabulka požadavků ─────────────────────────────────────

  public loadThreadsTable(): void {
    this.genericTableService.getPaginatedData<any>(this.threadsApiEndpoint, this.threadsCurrentPage, this.threadsItemsPerPage, this.threadsFilters)
      .subscribe({
        next: (res) => {
          this.threadsData = res.data;
          this.threadsTotalItems = res.total;
          this.threadsTotalPages = res.last_page;
          this.cd.markForCheck();
        }
      });
  }

  applyThreadsFilters(newFilters: Core.FilterParams): void {
    this.threadsFilters = { ...this.threadsFilters, ...newFilters };
    this.threadsCurrentPage = 1;
    this.loadThreadsTable();
  }

  clearThreadsFilters(): void {
  this.threadsFilters = { sort_by: 'last_message_at', sort_direction: 'desc', status: 'active' };
  this.threadsCurrentPage = 1;
  this.loadThreadsTable();
}

  handleThreadsPageChange(page: number): void {
    this.threadsCurrentPage = page;
    this.loadThreadsTable();
  }

  handleThreadsItemsPerPageChange(value: number): void {
    this.threadsItemsPerPage = value;
    this.threadsCurrentPage = 1;
    this.loadThreadsTable();
  }

  /**
   * @refactor-note (2026-09-11v4) Po úspěšném načtení scrolluje `.pm-message-list`
   * na spodek (nejnovější zprávy).
   */
  openThreadModal(item: any): void {
    this.showThreadModal = true;
    this.threadModalLoading = true;
    this.threadModalReplyBody = '';
    this.threadModalReplyFiles = [];
    this.threadModalReplyFileError = null;
    this.activeThread = item;
    this.lockBackgroundScroll();
    this.cd.markForCheck();

    this.dataHandler.get<any>(`web/project-threads/${item.id}`).subscribe({
      next: (full) => {
        this.activeThread = full;
        this.threadModalLoading = false;
        this.cd.markForCheck();
        this.scrollMessagesToBottom(this.threadModalMessageListEl);
      },
      error: () => { this.threadModalLoading = false; this.cd.markForCheck(); }
    });
  }

  closeThreadModal(): void {
    this.showThreadModal = false;
    this.activeThread = null;
    this.unlockBackgroundScroll();
  }

  /**
   * @refactor-note (2026-09-11v3) `FormData` MÍSTO plain `{ body }`, jakmile je vybraný
   * alespoň jeden soubor - viz `sendReply()` výše pro stejné odůvodnění.
   */
  async sendThreadModalReply(): Promise<void> {
    const body = this.threadModalReplyBody.trim();
    if (!body || !this.activeThread || this.threadModalReplySending) return;

    this.threadModalReplySending = true;
    this.cd.markForCheck();

    const payload: FormData | { body: string } = this.threadModalReplyFiles.length > 0
      ? this.buildReplyFormData(body, this.threadModalReplyFiles)
      : { body };

    try {
      await firstValueFrom(this.dataHandler.post(`web/project-threads/${this.activeThread.id}/reply`, payload));
      this.patchThreadsDataLastMessageAt(this.activeThread.id);
      this.threadModalReplyBody = '';
      this.threadModalReplyFiles = [];
      this.openThreadModal(this.activeThread);
      this.loadThreadsTable();
    } catch {
      // DataHandler.handleError() už zobrazil toast pro tuto HTTP chybu.
    } finally {
      this.threadModalReplySending = false;
      this.cd.markForCheck();
    }
  }

  /** @bugfix-note (2026-09-11v5) Formát shodný s backend `format('Y-m-d H:i:s')`. */
private nowFormattedForDisplay(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * @bugfix-note (2026-09-11v5) BACKLOG "čas poslední zprávy se v cross-project
 * tabulce po odeslání nezaktualizoval": okamžitá lokální aktualizace záznamu v
 * `threadsData`, NEZÁVISLE na `loadThreadsTable()` (ten pořád běží jako plný
 * refetch v pozadí a časem zajistí i správné přeřazení podle sort_by). Řeší
 * problém i kdyby síťový round-trip trval déle, než uživatel čeká.
 */
private patchThreadsDataLastMessageAt(threadId: number): void {
  const row = this.threadsData.find(t => t.id === threadId);
  if (row) {
    row.last_message_at = this.nowFormattedForDisplay();
    this.cd.markForCheck();
  }
}
  // ── Scroll lock (sdíleno mezi oběma modaly - jen jeden je vždy otevřený) ──

  private lockBackgroundScroll(): void {
    this.savedScrollY = window.scrollY;
    const body = document.body.style;
    body.position = 'fixed';
    body.top = `-${this.savedScrollY}px`;
    body.left = '0';
    body.right = '0';
    body.width = '100%';
  }

  private unlockBackgroundScroll(): void {
    const body = document.body.style;
    body.position = '';
    body.top = '';
    body.left = '';
    body.right = '';
    body.width = '';
    window.scrollTo(0, this.savedScrollY);
  }

  openGraphBuilder(): void {
    this.showGraphBuilder = true;
    this.cd.markForCheck();
  }

  closeGraphBuilder(): void {
    this.showGraphBuilder = false;
    this.cd.markForCheck();
  }

  showGraphBuilder = false;
}