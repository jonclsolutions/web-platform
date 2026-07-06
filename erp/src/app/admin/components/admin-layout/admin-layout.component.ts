/**
 * @file admin-layout.component.ts
 * @path src/app/admin/pages/admin-layout/admin-layout.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2025
 * @description Main shell component for the administrative panel, managing sidebar navigation, module switching, and global UI state.
 * @dependencies
 * - AuthService: Manages user authentication and session status.
 * - PermissionService: Validates access to specific administrative modules.
 * - DataHandler: Facilitates communication with the administration API.
 * - LoadingService: Observes global loading states for the UI.
 * - AlertDialogService: Provides feedback for critical administrative operations.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, LOCALE_ID, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription, interval, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { LoadingService } from '../../../core/services/loading.service';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';

/**
 * @description The layout shell for the administration area, handling sidebar controls and system-wide settings like shop maintenance mode.
 * @usage Used as the root component for all '/admin' routes.
 * @note Implements persistent storage for layout preferences (sidebar width, menu state) and handles sensitive status toggles via confirmation dialogs.
 */
@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe, HasPermissionDirective],
  providers: [
    { provide: LOCALE_ID, useValue: 'cs-CZ' }
  ]
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  userEmail: string | null = null;
  userRole: string | null = null;
  isLoggedIn: boolean = false;
  
  currentModule: 'web' | 'shop' = 'web';

  isShopActive: boolean = true;
  maintenanceMessage: string = '';

  showConfirmModal: boolean = false;
  confirmPasswordValue: string = '';
  pendingTargetState: boolean = true;

  isLoadingGlobal$: Observable<boolean>;
  
  currentDate$: Observable<Date> = interval(1000).pipe(
    startWith(0),
    map(() => new Date())
  );
  
  isMenuOpen: boolean = true;
  sidebarWidth: number = 200; 
  isResizing: boolean = false;

  private minWidth: number = 150;
  private maxWidth: number = 500;
  private authSubscription: Subscription | undefined;
  private userEmailSubscription: Subscription | undefined;

  private dataHandler = inject(DataHandler);
  private alertDialogService = inject(AlertDialogService);

  constructor(
    private router: Router, 
    private authService: AuthService,
    private permissionService: PermissionService,
    private cdr: ChangeDetectorRef,
    private loadingService: LoadingService
  ) { 
    this.isLoadingGlobal$ = this.loadingService.isLoading$;
  }

  /**
   * @description Initializes layout state from LocalStorage and sets up authentication observation.
   * @note Automatically adjusts sidebar visibility based on viewport width.
   */
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem('admin_sidebar_width');
      if (savedWidth) this.sidebarWidth = parseInt(savedWidth, 10);
      
      const savedState = localStorage.getItem('admin_menu_open');
      const savedModule = localStorage.getItem('admin_current_module') as 'web' | 'shop';
      if (savedModule) this.currentModule = savedModule;

      if (window.innerWidth <= 768) {
        this.isMenuOpen = false; 
      } else {
        this.isMenuOpen = savedState !== null ? savedState === 'true' : true;
      }
    }

    this.authSubscription = this.authService.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.userRole = loggedIn ? this.authService.getUserRole() : null;
      
      if (loggedIn) {
        this.loadShopSettings();
      }
      this.cdr.markForCheck(); 
    });

    this.userEmailSubscription = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      this.cdr.markForCheck();
    });
  }

  /**
   * @description Fetches system settings from the backend to determine shop status.
   */
  private loadShopSettings(): void {
    this.dataHandler.get<any>('core/settings').subscribe({
      next: (res) => {
        if (res) {
          this.isShopActive = !!res.is_shop_active;
          this.maintenanceMessage = res.maintenance_message || '';
          this.cdr.markForCheck();
        }
      }
    });
  }

  /**
   * @description Opens the confirmation modal to initiate a status change for the shop.
   */
  toggleShopStatus(): void {
    this.pendingTargetState = !this.isShopActive;
    this.confirmPasswordValue = ''; 
    this.showConfirmModal = true;   
    this.cdr.markForCheck();
  }

  /**
   * @description Executes the PUT request to change the shop status, requiring a password for authorization.
   * @note Uses AlertDialogService to provide immediate feedback on success or failure.
   */
  submitShopStatusChange(): void {
    if (!this.confirmPasswordValue.trim()) {
      this.alertDialogService.open('Validation Error', 'Authorization password is required.', 'danger');
      return;
    }

    this.dataHandler.put<any>('core/settings', {
      is_shop_active: this.pendingTargetState,
      maintenance_message: this.maintenanceMessage || 'System under maintenance.',
      confirm_password: this.confirmPasswordValue
    }).subscribe({
      next: () => {
        this.isShopActive = this.pendingTargetState;
        this.showConfirmModal = false; 
        this.alertDialogService.open(
          'Success', 
          this.pendingTargetState ? 'Shop is now active.' : 'Maintenance mode activated.',
          'success'
        );
        this.cdr.markForCheck();
      },
      error: (err) => {
        const errorMessage = err?.error?.message || 'Failed to update shop status.';
        this.alertDialogService.open('Authorization Error', errorMessage, 'danger');
      }
    });
  }

  cancelShopStatusChange(): void {
    this.showConfirmModal = false;
    this.confirmPasswordValue = '';
    this.cdr.markForCheck();
  }

  /**
   * @description Switches between main application modules ('web' vs 'shop') and updates navigation.
   * @param module The target module to navigate into.
   */
  switchModule(module: 'web' | 'shop'): void {
    this.currentModule = module;
    localStorage.setItem('admin_current_module', module);
    this.router.navigate([module === 'web' ? '/admin/dashboard' : '/admin/shop/dashboard']);
    this.cdr.markForCheck();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    if (window.innerWidth > 768) {
      localStorage.setItem('admin_menu_open', this.isMenuOpen.toString());
    }
    this.cdr.markForCheck();
  }

  onLinkClick(): void {
    if (window.innerWidth <= 768) {
      this.isMenuOpen = false;
    }
  }

  /**
   * @description Initiates sidebar resizing.
   * @param event The mouse interaction event.
   */
  startResizing(event: MouseEvent): void {
    if (window.innerWidth > 768) {
      this.isResizing = true;
      event.preventDefault();
    }
  }

  /**
   * @description Dynamically updates the sidebar width during resize operations.
   */
  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;
    let newWidth = event.clientX;
    if (newWidth >= this.minWidth && newWidth <= this.maxWidth) {
      this.sidebarWidth = newWidth;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    if (this.isResizing) {
      this.isResizing = false;
      localStorage.setItem('admin_sidebar_width', this.sidebarWidth.toString());
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.permissionService.clearPermissions();
        this.router.navigate(['/auth/login']);
      },
      error: () => this.router.navigate(['/auth/login'])
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.userEmailSubscription?.unsubscribe();
  }
}