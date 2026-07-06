/**
 * @file permission.service.ts
 * @path src/app/core/services/permission.service.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages user authorization states globally, providing methods for checking access to specific application features.
 * @dependencies
 * - BehaviorSubject: Reactive stream for maintaining and broadcasting current permission sets.
 * - Injectable: Angular decorator for service lifecycle management.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * @description Centralized service for role-based access control (RBAC).
 * @usage Used across the application to guard UI components, toolbar buttons, and navigation routes based on user credentials.
 * @note Initializes state from localStorage to persist authorization during browser refreshes.
 */
@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  /** Reactive store for the user's active permission keys */
  private userPermissions$ = new BehaviorSubject<string[]>([]);

  constructor() {
    const savedPermissions = localStorage.getItem('userPermissions');
    if (savedPermissions) {
      try {
        this.userPermissions$.next(JSON.parse(savedPermissions));
      } catch (e) {
        console.error('Chyba při parsování userPermissions', e);
      }
    }
  }

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