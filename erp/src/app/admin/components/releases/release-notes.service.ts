/**
 * @file release-notes.service.ts
 * @path src/app/admin/components/releases/release-notes.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Release notes for the admin - one request `core/releases` (the running version and
 *   the releases up to it with the changes of the core and of the user's applications), shared by
 *   the version in the sidebar, the notice after an update and the page Core → Releases.
 *   The notice is per module: the core shows it only for changes of the core, an application only
 *   for its own changes - an update of the core says nothing inside an untouched application.
 * @note "Seen" = the last version whose notice the user closed or opened, per module, in the
 *   localStorage of this browser (a functional preference of the signed-in administrator, no
 *   tracking). The first visit only remembers the running version (no notice for old releases).
 * @dependencies DataHandler.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { DataHandler } from '../../../core/services/data-handler.service';

/** Type of a change - security first in every list. */
export type ReleaseChangeType = 'security' | 'added' | 'changed' | 'fixed' | 'removed';

/** One change of a release. */
export interface ReleaseChange {
  type: ReleaseChangeType;
  /** `core` or the id of an application. */
  area: string;
  /** `admin` or `public` part of the area. */
  part: 'admin' | 'public';
  text: string;
  /** Ticket, e.g. `#57`. */
  ref?: string;
}

/** One release. */
export interface Release {
  version: string;
  date: string;
  changes: ReleaseChange[];
}

/** Answer of `core/releases`. */
export interface ReleaseNotes {
  current: string;
  releases: Release[];
}

/** Prefix of the localStorage keys of the seen versions (+ module). */
export const RELEASE_SEEN_KEY = 'jsw_release_seen_';

@Injectable({ providedIn: 'root' })
export class ReleaseNotesService {
  private readonly dataHandler = inject(DataHandler);

  /** The answer (null until loaded). */
  readonly notes = signal<ReleaseNotes | null>(null);
  /** The request failed. */
  readonly failed = signal(false);
  /** Running version (empty until loaded). */
  readonly current = computed(() => this.notes()?.current ?? '');

  /** Bumped when a notice is closed - re-evaluates the notice. */
  private readonly seenRevision = signal(0);
  private loading = false;

  /** @description Loads the notes once per page load (a release reloads the page anyway). */
  load(): void {
    if (this.loading || this.notes() !== null) return;
    this.loading = true;
    this.dataHandler.get<ReleaseNotes>('core/releases').subscribe({
      next: notes => {
        this.notes.set({ current: notes?.current ?? '', releases: Array.isArray(notes?.releases) ? notes.releases : [] });
        this.failed.set(false);
        this.loading = false;
      },
      error: () => {
        this.failed.set(true);
        this.loading = false;
      },
    });
  }

  /**
   * @description Releases newer than the version the user saw in a module that change that
   *   module - the content of its notice. Empty on the first visit (the running version is
   *   remembered) and when nothing of the module changed.
   * @param module `core` or an application id.
   * @returns Releases with only the changes of the module, newest first.
   */
  unseenFor(module: string): Release[] {
    this.seenRevision();
    const notes = this.notes();
    if (!notes || !notes.current) return [];
    const seen = this.readSeen(module);
    if (seen === null) {
      this.writeSeen(module, notes.current);
      return [];
    }
    if (seen === notes.current) return [];
    const result: Release[] = [];
    for (const release of notes.releases) {
      if (release.version === seen) break;
      const changes = release.changes.filter(change => change.area === module);
      if (changes.length) result.push({ ...release, changes });
    }
    return result;
  }

  /**
   * @description Marks the running version as seen in a module (the notice disappears).
   * @param module `core` or an application id.
   */
  markSeen(module: string): void {
    const current = this.current();
    if (!current) return;
    this.writeSeen(module, current);
    this.seenRevision.update(n => n + 1);
  }

  /**
   * @description Seen version of a module (null = never, or storage blocked).
   * @param module Module.
   */
  private readSeen(module: string): string | null {
    try {
      return localStorage.getItem(RELEASE_SEEN_KEY + module);
    } catch {
      return null;
    }
  }

  /**
   * @description Remembers the seen version of a module.
   * @param module Module.
   * @param version Version.
   */
  private writeSeen(module: string, version: string): void {
    try {
      localStorage.setItem(RELEASE_SEEN_KEY + module, version);
    } catch {
      // Storage blocked (private mode) - the notice is then never shown, nothing breaks.
    }
  }
}
