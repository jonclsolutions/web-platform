/**
 * @file portal-files.component.ts
 * @path src/app/apps/project-portal/public/sections/files/portal-files.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Files of the project portal (/projects/:token/files): every file of the
 *   conversations, updates and approval requests with size, date and author, and a link to where
 *   it comes from (the thread opens in Communication). Loaded fresh every time the section opens
 *   and after a refresh of the header (the download links are signed and expire).
 * @dependencies PortalSessionService (provided by PortalLayoutComponent)
 */

import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PortalSessionService } from '../../portal-session.service';
import { PortalFile } from '../../portal.models';
import { formatFileSize, portalTexts } from '../../portal-ui';

@Component({
  selector: 'app-portal-files',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './portal-files.component.html',
  styleUrls: ['../portal-section.css', './portal-files.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalFilesComponent implements OnInit {
  readonly session = inject(PortalSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly t = portalTexts();
  readonly formatFileSize = formatFileSize;

  ngOnInit(): void {
    this.session.loadFiles();
    this.session.refreshed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.session.loadFiles());
  }

  /**
   * @description Text of the "where it comes from" link of a file.
   * @param file File of the project.
   * @returns E.g. "Update: Design ready" or the subject of the thread.
   */
  fileSourceLabel(file: PortalFile): string {
    if (file.source === 'update') return `${this.t('file_source_update')}: ${file.source_title ?? ''}`;
    if (file.source === 'approval') return `${this.t('file_source_approval')}: ${file.source_title ?? ''}`;
    return file.thread_subject ?? file.source_title ?? '';
  }

  /**
   * @description Opens where a file comes from: Updates, Approvals, or its conversation in
   *   Communication (also a thread no longer in the list).
   * @param file File of the project.
   */
  openFileThread(file: PortalFile): void {
    if (file.source === 'update' || file.source === 'approval') {
      this.session.openSection(file.source === 'update' ? 'updates' : 'approvals');
      return;
    }
    const thread = this.session.threads().find(t => t.id === file.thread_id)
      ?? { id: file.thread_id ?? 0, subject: file.thread_subject ?? '', priority: 'medium', status: 'active', last_message_at: null };
    this.session.openThreadInCommunication(thread);
  }
}
