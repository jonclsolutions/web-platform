/**
 * @file projects.component.ts
 * @path src/app/admin/web-pages/projects/projects.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Administrative component for managing customer Projects.
 *
 * @refactor-note (2026-08-29b) BACKLOG "sjednotit web/projects a web/project-threads
 * do jedné feature": bývalý samostatný `ProjectThreadsComponent` (cross-project
 * tabulka VŠECH vláken) je teď DRUHÁ tabulka na téže stránce, POD tabulkou
 * projektů - vlastní nezávislé stránkování/filtrování (jiný `apiEndpoint':
 * 'web/project-threads', jiné `threadsFilters`/`threadsCurrentPage` atd., protože
 * BaseDataComponent spravuje pouze JEDEN primární `apiEndpoint` - projekty - takže
 * druhá tabulka je natahována ručně přes `genericTableService.getPaginatedData()`,
 * stejný nízkoúrovňový mechanismus, jaký BaseDataComponent používá interně pro tu
 * primární). Otevření řádku ("💬") ukáže LEHKÝ modal (`showThreadModal`/
 * `activeThread`) s odpovědí - nezávislý na "Správa" modalu (`showManageModal`/
 * `selectedThread`), který řeší vlákna SCOPOVANÁ na jeden konkrétní spravovaný
 * projekt. Obě modální okna sdílí stejné `pm-*` CSS třídy (project-manage-modal.css)
 * - proto "project-threads nemělo vlastní CSS", bylo to vždy sdílené odsud.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
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

interface ProjectThreadMessage {
  id: number;
  author_type: 'customer' | 'admin';
  author_label: string | null;
  body: string;
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
  imports: [SHARED_UI_BUILDERS, FormsModule,GraphBuilderComponent],
  templateUrl: './projects.component.html',
  styleUrls: ['../default-style.css', './project-manage-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  @ViewChild('threadsTable') threadsTable!: TableBuilderComponent;
  tableCaption: string = 'Projekty';

  override apiEndpoint: string = 'web/projects';

  buttons = Config.PROJECT_BUTTONS;
  formFields: Core.InputDefinition[] = Config.PROJECT_FORM_FIELDS.map(f => ({ ...f }));
  projectColumns = Config.PROJECT_COLUMNS;
  trashProjectColumns = Config.PROJECT_TRASH_COLUMNS;
  filterColumns = Config.PROJECT_FILTER_COLUMNS;
  detailsColumns = Config.PROJECT_DETAILS_COLUMNS;

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
  replyBody = '';
  replySending = false;

  passwordRegenerating = false;

  revealedPassword: RevealedPassword | null = null;
  passwordVisible = false;

  readonly checkpointStatusLabels = Config.CHECKPOINT_STATUS_LABELS;

  private readonly PASSWORD_STORAGE_PREFIX = 'rpsw_project_pw_';

  /** Scroll pozice ULOŽENÁ při otevření libovolného modalu ("Správa" i "Vlákno") - viz lockBackgroundScroll()/unlockBackgroundScroll(). */
  private savedScrollY = 0;

  // ── Cross-project tabulka požadavků (dřív ProjectThreadsComponent) ─────────
  readonly threadsApiEndpoint = 'web/project-threads';
  threadColumns = Config.PROJECT_THREAD_COLUMNS;
  threadButtons = Config.PROJECT_THREAD_BUTTONS;
  threadFilterColumns = Config.PROJECT_THREAD_FILTER_COLUMNS;
  threadDetailsColumns = Config.PROJECT_THREAD_DETAILS_COLUMNS;
  threadFormFields: Core.InputDefinition[] = [];

  threadsData: any[] = [];
  threadsFilters: Core.FilterParams = { sort_by: 'last_message_at', sort_direction: 'desc' };
  threadsCurrentPage = 1;
  threadsItemsPerPage = 15;
  threadsTotalPages = 1;
  threadsTotalItems = 0;
  isThreadsFilterVisible = false;

  showThreadModal = false;
  activeThread: any | null = null;
  threadModalLoading = false;
  threadModalReplyBody = '';
  threadModalReplySending = false;

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
showGraphBuilder = false;
  readonly graphColumns: GraphColumnOption[] = Config.PROJECT_DETAILS_COLUMNS
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
    private router: Core.Router,
    private activatedRoute: ActivatedRoute,
    private confirmDialogService: ConfirmDialogService
  ) {
    super(dataHandler, cd, genericTableService);
  }

  get toolbarButtons(): Core.Button[] {
    return Config.PROJECT_TOOLBAR_BUTTONS.map(btn => {
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
          if (updatedBtn.showIf !== false) updatedBtn.showIf = !this.showTrashTable;
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? 'Zobrazit aktivní' : 'Koš';
          updatedBtn.isActive = this.showTrashTable;
          break;
      }
      return updatedBtn;
    });
  }

  get threadsToolbarButtons(): Core.Button[] {
    return Config.PROJECT_THREAD_TOOLBAR_BUTTONS.map(btn => {
      const updated = { ...btn };
      if (btn.action === 'toggleThreadsFilters') {
        updated.label = this.isThreadsFilterVisible ? 'Skrýt filtry' : 'Filtry';
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

  private loadOrderOptions(onLoaded: () => void): void {
    this.dataHandler.getCollection<any>('web/sales_orders', { no_pagination: 'true', sort_by: 'id', sort_direction: 'desc' })
      .subscribe({
        next: (orders) => {
          const orderField = this.formFields.find(f => f.column_name === 'order_id');
          if (orderField) {
            orderField.options = [
              { value: '', label: '— Bez realizace (samostatný projekt) —' },
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
          this.alertDialogService.open('Úspěch', 'Projekt byl úspěšně vytvořen. Přístupové heslo a odkaz najdeš v panelu Správa.', 'success');
          this.refreshData();
          this.openManageModal(result);
        } else {
          this.alertDialogService.open('Úspěch', 'Projekt byl upraven.', 'success');
          this.refreshData();
        }
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Akce selhala.', 'danger')
    });
  }

  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Nepodařilo se načíst detail.', 'danger')
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
        this.alertDialogService.open('Chyba', 'Nepodařilo se načíst detail projektu.', 'danger');
        this.cd.markForCheck();
      }
    });
  }

  private loadManagingThreads(projectId: number): void {
    this.projectThreadsCrud.getCollection({ project_id: projectId, no_pagination: 'true' })
      .subscribe({
        next: (threads) => { this.managingThreads = threads; this.cd.markForCheck(); },
        error: () => {}
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
    this.alertDialogService.open('Zkopírováno', 'Heslo bylo zkopírováno do schránky.', 'success');
  }

  copyPublicUrl(): void {
    const url = this.revealedPassword?.url ?? this.managingProject?.public_url;
    if (!url) return;
    navigator.clipboard?.writeText(url);
    this.alertDialogService.open('Zkopírováno', 'Veřejný odkaz byl zkopírován do schránky.', 'success');
  }

  async regeneratePassword(): Promise<void> {
    if (!this.managingProject || this.passwordRegenerating) return;
    const confirmed = await this.confirmDialogService.open(
      'Vygenerovat nové heslo',
      'Staré heslo přestane platit a všechny aktuálně přihlášené relace zákazníka budou odhlášeny. Pokračovat?'
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
          this.alertDialogService.open('Nové heslo vygenerováno', 'Nové heslo je zobrazené v panelu Přístup.', 'success');
          this.cd.markForCheck();
        },
        error: (err: any) => {
          this.passwordRegenerating = false;
          this.alertDialogService.open('Chyba', err?.error?.message || 'Vygenerování hesla selhalo.', 'danger');
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
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err?.error?.message || 'Přidání checkpointu selhalo.', 'danger')
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
    const confirmed = await this.confirmDialogService.open('Smazat checkpoint', `Opravdu smazat "${checkpoint.label}"?`);
    if (!confirmed) return;

    this.checkpointsCrud.remove(checkpoint.id).subscribe({
      next: () => {
        this.managingCheckpoints = this.managingCheckpoints.filter(c => c.id !== checkpoint.id);
        this.cd.markForCheck();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err?.error?.message || 'Smazání checkpointu selhalo.', 'danger')
    });
  }

  openThread(thread: ProjectThread): void {
    this.selectedThread = thread;
    this.threadDetailLoading = true;
    this.replyBody = '';
    this.cd.markForCheck();

    this.projectThreadsCrud.getOne(thread.id).subscribe({
      next: (full) => {
        this.selectedThread = full;
        this.threadDetailLoading = false;
        this.cd.markForCheck();
      },
      error: () => { this.threadDetailLoading = false; this.cd.markForCheck(); }
    });
  }

  closeThread(): void {
    this.selectedThread = null;
    this.replyBody = '';
  }

  changeThreadStatus(status: string): void {
    if (!this.selectedThread) return;
    this.dataHandler.put<ProjectThread>(`web/project-threads/${this.selectedThread.id}/status`, { status })
      .subscribe({
        next: (updated) => {
          this.selectedThread!.status = updated.status;
          const inList = this.managingThreads.find(t => t.id === this.selectedThread!.id);
          if (inList) inList.status = updated.status;
          this.cd.markForCheck();
        },
        error: (err: any) => this.alertDialogService.open('Chyba', err?.error?.message || 'Změna stavu vlákna selhala.', 'danger')
      });
  }

  async sendReply(): Promise<void> {
    const body = this.replyBody.trim();
    if (!body || !this.selectedThread || this.replySending) return;

    this.replySending = true;
    this.cd.markForCheck();

    try {
      await firstValueFrom(this.dataHandler.post(`web/project-threads/${this.selectedThread.id}/reply`, { body }));
      this.replyBody = '';
      this.openThread(this.selectedThread);
      if (this.managingProject) this.loadManagingThreads(this.managingProject.id);
      this.loadThreadsTable();
    } catch (err: any) {
      this.alertDialogService.open('Chyba', err?.error?.message || 'Odeslání odpovědi selhalo.', 'danger');
    } finally {
      this.replySending = false;
      this.cd.markForCheck();
    }
  }

  // ── Cross-project tabulka požadavků (dřív ProjectThreadsComponent) ─────────

  private loadThreadsTable(): void {
    this.genericTableService.getPaginatedData<any>(this.threadsApiEndpoint, this.threadsCurrentPage, this.threadsItemsPerPage, this.threadsFilters)
      .subscribe({
        next: (res) => {
          this.threadsData = res.data;
          this.threadsTotalItems = res.total;
          this.threadsTotalPages = res.last_page;
          this.cd.markForCheck();
        },
        error: () => {}
      });
  }

  applyThreadsFilters(newFilters: Core.FilterParams): void {
    this.threadsFilters = { ...this.threadsFilters, ...newFilters };
    this.threadsCurrentPage = 1;
    this.loadThreadsTable();
  }

  clearThreadsFilters(): void {
    this.threadsFilters = { sort_by: 'last_message_at', sort_direction: 'desc' };
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

  openThreadModal(item: any): void {
    this.showThreadModal = true;
    this.threadModalLoading = true;
    this.threadModalReplyBody = '';
    this.activeThread = item;
    this.lockBackgroundScroll();
    this.cd.markForCheck();

    this.dataHandler.get<any>(`web/project-threads/${item.id}`).subscribe({
      next: (full) => { this.activeThread = full; this.threadModalLoading = false; this.cd.markForCheck(); },
      error: () => { this.threadModalLoading = false; this.cd.markForCheck(); }
    });
  }

  closeThreadModal(): void {
    this.showThreadModal = false;
    this.activeThread = null;
    this.unlockBackgroundScroll();
  }

  async sendThreadModalReply(): Promise<void> {
    const body = this.threadModalReplyBody.trim();
    if (!body || !this.activeThread || this.threadModalReplySending) return;

    this.threadModalReplySending = true;
    this.cd.markForCheck();

    try {
      await firstValueFrom(this.dataHandler.post(`web/project-threads/${this.activeThread.id}/reply`, { body }));
      this.threadModalReplyBody = '';
      this.openThreadModal(this.activeThread);
      this.loadThreadsTable();
    } catch (err: any) {
      this.alertDialogService.open('Chyba', err?.error?.message || 'Odeslání odpovědi selhalo.', 'danger');
    } finally {
      this.threadModalReplySending = false;
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
}