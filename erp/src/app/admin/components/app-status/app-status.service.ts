/**
 * @file app-status.service.ts
 * @path src/app/admin/components/app-status/app-status.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description State of the applications for the admin (online / maintenance, health and a light
 *   diagnosis) - one request `core/apps/status` for every application the user may open, shared
 *   by the status in the dashboard headers and the page Applications, so a switch made in one
 *   place shows everywhere. Switching goes to the endpoint of the application from its manifest
 *   (`AppManifest.maintenance`) with the password of the signed-in user.
 * @dependencies DataHandler, apps.registry (manifests), PermissionService.
 */

import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { DataHandler } from '../../../core/services/data-handler.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { AppManifest, appById } from '../../../apps/apps.registry';

/** Health of an application: online and fine, online with problems, in maintenance, unreadable. */
export type AppHealth = 'ok' | 'warning' | 'offline' | 'error';

/** Light diagnosis of an application (from its audit log and the timing of its reads). */
export interface AppDiagnostics {
  response_ms: number;
  activity_24h: number;
  errors_24h: number;
  last_activity_at: string | null;
  last_error_at: string | null;
}

/** State of one application (`core/apps/status`). */
export interface AppStatus {
  id: string;
  health: AppHealth;
  /** Public part online (null = the application has no switch). */
  active: boolean | null;
  maintenance_message: string | null;
  diagnostics: AppDiagnostics | null;
  checked_at: string;
}

@Injectable({ providedIn: 'root' })
export class AppStatusService {
  private readonly dataHandler = inject(DataHandler);
  private readonly permissions = inject(PermissionService);

  /** States of the applications (null until the first answer). */
  readonly statuses = signal<AppStatus[] | null>(null);
  /** A request is running. */
  readonly loading = signal(false);
  /** The last request failed. */
  readonly failed = signal(false);

  /** Time of the last answer (ms) - a load within MAX_AGE_MS reuses it. */
  private loadedAt = 0;
  private static readonly MAX_AGE_MS = 30 * 1000;

  /**
   * @description Loads the states (reuses an answer younger than 30 s unless forced).
   * @param force Ask the API even with a fresh answer (manual refresh, after a switch).
   */
  load(force = false): void {
    if (this.loading() || (!force && this.statuses() !== null && Date.now() - this.loadedAt < AppStatusService.MAX_AGE_MS)) {
      return;
    }
    this.loading.set(true);
    this.dataHandler.get<AppStatus[]>('core/apps/status')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: list => {
          this.statuses.set(list ?? []);
          this.failed.set(false);
          this.loadedAt = Date.now();
        },
        error: () => this.failed.set(true),
      });
  }

  /**
   * @description State of one application (undefined while unknown or not visible to the user).
   * @param id Application id.
   */
  statusOf(id: string): AppStatus | undefined {
    return this.statuses()?.find(s => s.id === id);
  }

  /**
   * @description The user may switch the application (it has a switch and he has its permission).
   * @param id Application id.
   */
  canSwitch(id: string): boolean {
    const maintenance = appById(id)?.maintenance;
    return !!maintenance && this.permissions.hasPermission(maintenance.permission);
  }

  /**
   * @description Switches the public part of an application on / off; on success the states are
   *   reloaded. The maintenance text stays the one saved, or the given default when none is.
   * @param app Manifest of the application (with `maintenance`).
   * @param active Target state.
   * @param password Password of the signed-in user (checked by the API).
   * @param defaultMessage Maintenance text when the application has none saved.
   * @returns The answer of the application endpoint (errors keep the API message).
   */
  setActive(app: AppManifest, active: boolean, password: string, defaultMessage: string): Observable<unknown> {
    const maintenance = app.maintenance!;
    const saved = this.statusOf(app.id)?.maintenance_message;
    return this.dataHandler.put<unknown>(maintenance.endpoint, {
      [maintenance.activeField]: active,
      [maintenance.messageField]: saved || defaultMessage,
      confirm_password: password,
    }).pipe(tap(() => {
      // Shown at once; the reload brings the fresh diagnosis.
      this.statuses.update(list => (list ?? []).map(s => s.id !== app.id ? s : {
        ...s, active, health: !active ? 'offline' : s.health === 'offline' ? 'ok' : s.health,
      }));
      this.loadedAt = 0;
      this.load(true);
    }));
  }
}
