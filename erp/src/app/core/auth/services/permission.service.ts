/**
 * @file permission.service.ts
 * @path src/app/core/auth/services/permission.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages user authorization states globally, providing methods for checking access to specific application features.
 * @dependencies
 * - BehaviorSubject: Reactive stream for maintaining and broadcasting current permission sets.
 * - Injectable: Angular decorator for service lifecycle management.
 * @refactor-note (2026-10-23) Removed the restore from `localStorage.userPermissions` (open finding
 *   #38): nothing writes that key - AuthService keeps the permissions in sessionStorage and calls
 *   setPermissions() on start / login. A stale or hand-written localStorage value could only
 *   show UI the API refuses anyway.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * @description Centralized service for role-based access control (RBAC).
 * @usage Used across the application to guard UI components, toolbar buttons, and navigation routes based on user credentials.
 * @note The state is filled by AuthService (session restore / login), never from browser storage.
 */
@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  /** Reactive store for the user's active permission keys */
  private userPermissions$ = new BehaviorSubject<string[]>([]);

  /**
   * @description Updates the current user's permission set.
   * @param permissions Array of strings representing authorized action keys.
   */
  setPermissions(permissions: string[]): void {
    this.userPermissions$.next(permissions || []);
  }

  /**
   * @description Checks if the user is authorized to perform a specific action.
   * @param permission The required permission key to validate.
   * @returns True if the user possesses the permission, otherwise false.
   */
  hasPermission(permission: string): boolean {
    const currentPermissions = this.userPermissions$.getValue();
    return currentPermissions.includes(permission);
  }

  /**
   * @description Resets user permissions, typically used during logout operations.
   */
  clearPermissions(): void {
    this.userPermissions$.next([]);
  }
}