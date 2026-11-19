/**
 * @file portal-layout.component.ts
 * @path src/app/apps/project-portal/public/portal-layout/portal-layout.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Layout of the customer project portal (/projects/:token) of a signed-in client
 *   account, built like the administration: header (menu button, signed-in name, refresh,
 *   language), a left menu that collapses (desktop) or slides in (mobile), the title of the
 *   section and the section itself as a child route (/projects/:token/<section>): Overview,
 *   Progress, Communication, Approvals, Updates, Files, Contacts, My account and Help.
 *   The sign-in is a routed page of its own (/projects/login/:token, PortalLoginComponent); the
 *   route of this layout has a session resolver that redirects to the login without a valid
 *   session.
 * @security See PortalSessionService - the session is an HttpOnly cookie, any 401 opens the login.
 * @dependencies PortalSessionService (provided here - one per opened portal), ProjectPortalLocalizationService,
 *   PortalLanguageSwitcherComponent
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { PortalLanguageSwitcherComponent } from '../language-switcher/portal-language-switcher.component';
import { PortalSessionService } from '../portal-session.service';
import { PORTAL_SECTIONS, PortalSection, PublicProject, isPortalSection } from '../portal.models';
import { portalTexts } from '../portal-ui';

/** localStorage key of the collapsed menu (a per-browser convenience only). */
export const PORTAL_SIDEBAR_STORAGE_KEY = 'pp_sidebar_collapsed';

/** Key under which the former versions kept the session token in localStorage (removed on load). */
const LEGACY_STORAGE_PREFIX = 'project_session_';

/** Window width up to which the menu slides in over the content instead of collapsing. */
const MOBILE_MAX_WIDTH = 768;

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [NgTemplateOutlet, RouterOutlet, PortalLanguageSwitcherComponent],
  providers: [PortalSessionService],
  templateUrl: './portal-layout.component.html',
  styleUrls: ['../../../../admin/shared-styles/theme.css', './portal-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalLayoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly session = inject(PortalSessionService);
  readonly t = portalTexts();

  /** Items of the upper part of the left menu. */
  readonly sections = PORTAL_SECTIONS;
  /** Section of the current child route (menu highlight, title). */
  activeSection: PortalSection = 'overview';
  /** Desktop: the left menu shows icons only. */
  sidebarCollapsed = false;
  /** Mobile: the left menu slid in over the content. */
  mobileNavOpen = false;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.removeLegacySessionToken(token);
    this.sidebarCollapsed = this.readSidebarCollapsed();
    this.activeSection = this.currentSection();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.activeSection = this.currentSection();
        this.mobileNavOpen = false;
        this.cdr.markForCheck();
      });

    // The resolver of the route already asked the API (session valid); without a project it
    // redirected to the login, so this is only a safety net.
    const project = this.route.snapshot.data['project'] as PublicProject | undefined;
    this.session.token = token;
    if (project) this.session.start(token, project); else this.session.goToLogin();
  }

  /** @description Section of the active child route (Overview when unknown). */
  private currentSection(): PortalSection {
    const path = this.route.firstChild?.snapshot.routeConfig?.path;
    return isPortalSection(path) ? path : 'overview';
  }

  /** @description Deletes the session token a former version of the portal kept in localStorage. */
  private removeLegacySessionToken(token: string): void {
    try {
      localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${token}`);
    } catch {
      // Storage unavailable - nothing to remove.
    }
  }

  /**
   * @description Opens a section of the left menu; on mobile the slid-in menu closes.
   * @param section Section.
   */
  open(section: PortalSection): void {
    this.mobileNavOpen = false;
    this.session.openSection(section);
  }

  /** @description Name of the signed-in account ("Client: …" of the header). */
  get accountName(): string {
    const account = this.session.project()?.account;
    return account?.display_name || account?.username || '';
  }

  // ── Menu button, collapsed / slid-in menu ─────────────────────────────

  /** @description The window is narrow - the menu slides in over the content. */
  private isMobileWidth(): boolean {
    try {
      return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
    } catch {
      return false;
    }
  }

  /** @description Menu button: slides the menu in / out on mobile, collapses it on desktop (remembered). */
  toggleSidebar(): void {
    if (this.isMobileWidth()) {
      this.mobileNavOpen = !this.mobileNavOpen;
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      this.storeSidebarCollapsed(this.sidebarCollapsed);
    }
    this.cdr.markForCheck();
  }

  /** @description Closes the slid-in menu (overlay click). */
  closeMobileNav(): void {
    this.mobileNavOpen = false;
    this.cdr.markForCheck();
  }

  /** @description Remembered state of the collapsed menu (false when the storage is unavailable). */
  private readSidebarCollapsed(): boolean {
    try {
      return localStorage.getItem(PORTAL_SIDEBAR_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * @description Remembers the collapsed menu in this browser (nothing personal is stored).
   * @param collapsed New state.
   */
  private storeSidebarCollapsed(collapsed: boolean): void {
    try {
      localStorage.setItem(PORTAL_SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Storage unavailable - the menu simply starts expanded next time.
    }
  }
}
