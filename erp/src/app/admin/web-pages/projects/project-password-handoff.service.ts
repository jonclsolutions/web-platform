/**
 * @file project-password-handoff.service.ts
 * @path src/app/admin/web-pages/projects/project-password-handoff.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Hands the one-time password of a just created project from the projects list to
 *   its project page (web/projects/:id). Kept in memory only and taken once - never in any browser
 *   storage or the navigation history (VT-08: a stored password could be read by any script of the
 *   page). Reloading the page forgets it; a lost password can only be regenerated.
 * @usage `handoff.put(id, password, url)` before navigating, `handoff.take(id)` on the page.
 * @dependencies none
 */

import { Injectable } from '@angular/core';

/** @description One-time password of a project as shown on its page. */
export interface RevealedProjectPassword {
  password: string;
  url: string;
  generatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectPasswordHandoffService {
  private pending: { projectId: number; value: RevealedProjectPassword } | null = null;

  /**
   * @description Keeps the password for the page of the project (replaces any previous one).
   * @param projectId Project id.
   * @param password Generated password.
   * @param url Public URL of the client portal.
   */
  put(projectId: number, password: string, url: string): void {
    this.pending = { projectId, value: { password, url, generatedAt: new Date().toISOString() } };
  }

  /**
   * @description Returns the password of the project once (null for another project / none).
   * @param projectId Project id of the opened page.
   */
  take(projectId: number): RevealedProjectPassword | null {
    if (!this.pending || this.pending.projectId !== projectId) return null;
    const value = this.pending.value;
    this.pending = null;
    return value;
  }
}
