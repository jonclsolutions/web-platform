/**
 * @file project-threads.component.ts
 * @path src/app/admin/web-pages/project-threads/project-threads.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Cross-project "všechny požadavky v jedné tabulce" pohled - viz
 * konzultační poznámka 2 (badge s názvem projektu na každém řádku, reply váže
 * VÝHRADNĚ na thread_id z detailu, nikdy na nic odvozeného).
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './project-threads.config';

@Component({
  selector: 'app-project-threads',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, FormsModule],
  templateUrl: './project-threads.component.html',
  styleUrls: ['../default-style.css', '../projects/project-manage-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectThreadsComponent extends BaseDataComponent<any> implements Core.OnInit {
  override apiEndpoint: string = 'web/project-threads';

  buttons = Config.PROJECT_THREAD_BUTTONS;
  threadColumns = Config.PROJECT_THREAD_COLUMNS;
  filterColumns = Config.PROJECT_THREAD_FILTER_COLUMNS;
  detailsColumns = Config.PROJECT_THREAD_DETAILS_COLUMNS;
  formFields: Core.InputDefinition[] = [];

  filters: Core.FilterParams = { sort_by: 'last_message_at', sort_direction: 'desc' };

  showThreadModal = false;
  activeThread: any | null = null;
  threadLoading = false;
  replyBody = '';
  replySending = false;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

  get toolbarButtons(): Core.Button[] {
    return Config.PROJECT_THREAD_TOOLBAR_BUTTONS.map(btn => {
      const updated = { ...btn };
      if (btn.action === 'toggleFilters') {
        updated.label = this.isFilterVisible ? 'Skrýt filtry' : 'Filtry';
        updated.isActive = this.isFilterVisible;
      }
      return updated;
    });
  }

  handleToolbarAction(action: string): void {
    if (action === 'toggleFilters') this.toggleFilters();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
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
    this.filters = { sort_by: 'last_message_at', sort_direction: 'desc' };
    this.currentPage = 1;
    this.refreshData();
  }

  handlePageChange(page: number): void { this.onHandlePageChange(page, this.filters); }
  handleItemsPerPageChange(value: number): void { this.onHandleItemsPerPageChange(value, this.filters); }

  handleViewDetails(item: any): void {
    this.showThreadModal = true;
    this.threadLoading = true;
    this.replyBody = '';
    this.activeThread = item;
    this.cd.markForCheck();

    this.dataHandler.get<any>(`web/project-threads/${item.id}`).subscribe({
      next: (full) => { this.activeThread = full; this.threadLoading = false; this.cd.markForCheck(); },
      error: () => { this.threadLoading = false; this.cd.markForCheck(); }
    });
  }

  closeThreadModal(): void {
    this.showThreadModal = false;
    this.activeThread = null;
  }

  async sendReply(): Promise<void> {
    const body = this.replyBody.trim();
    if (!body || !this.activeThread || this.replySending) return;

    this.replySending = true;
    this.cd.markForCheck();

    try {
      await firstValueFrom(this.dataHandler.post(`web/project-threads/${this.activeThread.id}/reply`, { body }));
      this.replyBody = '';
      this.handleViewDetails(this.activeThread);
      this.refreshData();
    } catch (err: any) {
      this.alertDialogService.open('Chyba', err?.error?.message || 'Odeslání odpovědi selhalo.', 'danger');
    } finally {
      this.replySending = false;
      this.cd.markForCheck();
    }
  }
}