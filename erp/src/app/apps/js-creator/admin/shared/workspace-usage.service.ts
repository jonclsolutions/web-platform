/**
 * @file workspace-usage.service.ts
 * @path src/app/apps/js-creator/admin/shared/workspace-usage.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Usage of the own workspace shared by the pages of JS Creator (usage bar) - loaded
 *   on demand and refreshed after every upload and deletion. `fits()` lets a page refuse a file
 *   that would not fit before sending it (with its own translated text); the API checks again.
 * @dependencies JsCreatorApiService.
 */

import { Injectable, inject, signal } from '@angular/core';
import { JsCreatorApiService } from './js-creator-api.service';
import { WorkspaceUsage } from './js-creator.models';

@Injectable({ providedIn: 'root' })
export class WorkspaceUsageService {
  private readonly api = inject(JsCreatorApiService);

  /** Last known usage (null until loaded). */
  readonly usage = signal<WorkspaceUsage | null>(null);

  /** @description Loads the usage again. */
  refresh(): void {
    this.api.usage().subscribe({ next: usage => this.usage.set(usage), error: () => undefined });
  }

  /**
   * @description Whether files of the given size still fit into the quota (true while unknown -
   *   the API decides then).
   * @param bytes Size of the new files.
   */
  fits(bytes: number): boolean {
    const usage = this.usage();
    return !usage || usage.used_bytes + bytes <= usage.quota_bytes;
  }
}
