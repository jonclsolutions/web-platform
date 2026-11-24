/**
 * @file public-header.component.ts
 * @path src/app/apps/web/public/components/public-header/public-header.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages the site-wide public header, including dynamic navigation and scroll-responsive UI
 *   animations. The language switcher is in the footer (FooterLanguageSwitcherComponent) - used rarely,
 *   it does not need a place in the header (2026-11).
 * @dependencies
 * - Router: Handles route state detection for active link highlighting.
 * - LocalizationService: Translations of the `web` module.
 * - PublicDataService: Fetches global site configuration.
 * - Angular Signals/RxJS: Manages reactive state updates for the UI.
 * @note siteSettings is read from PublicDataService.siteSettingsValue$ (populated once by
 *   AppBootstrapService during APP_INITIALIZER) instead of being fetched here. By the time
 *   this component renders, the value — and the logo image bytes — are already available.
 */

import {
  Component, OnInit, HostListener, AfterViewInit,
  QueryList, ElementRef, ViewChildren,
  ChangeDetectorRef, NgZone, OnDestroy
} from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, takeUntil } from 'rxjs/operators';
import { LocalizationService } from '../../../../../shared/services/localization.service';
import { PublicDataService } from '../../../../../shared/services/public-data.service';
import * as Web from '../../web-providers';
import { hasApp } from '../../../../apps.registry';
import { stripLanguagePrefix } from '../../../../../shared/utils/language-url';

/**
 * @description Component for the main navigation header.
 * @usage Provides a persistent navigation interface and a mobile-responsive menu.
 * @note Implements advanced DOM manipulation and ResizeObservers to ensure navigation indicators remain synchronized during transitions and scroll events.
 */
@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-header.component.html',
  styleUrls: ['./public-header.component.css']
})
export class PublicHeaderComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('homeLink, servicesLink, shopLink, academyLink')
  navLinks!: QueryList<ElementRef<HTMLAnchorElement>>;
  t: any = null;
  /** Link to the e-shop only when it is part of this build (apps.registry). */
  readonly showShopLink = hasApp('shop');
  indicatorStyle: any = {};
  scrolled: boolean = false;
  private resizeObserver: ResizeObserver | undefined;

  siteSettings: any = null;

  showIndicator: boolean = false;
  isAnimatingTransition: boolean = false;
  private animationTimeout: any;
  /** Initial route sync of ngOnInit (cleared on destroy). */
  private initialRouteTimeout: any;

// Constants for indicator layout
  private readonly LINK_WIDTH = 100;
  private readonly GAP_DEFAULT = 12;
  private readonly GAP_SCROLLED = 6;
  private readonly INDICATOR_ANIMATION_DURATION = 400;

  private currentActiveRoute: string | null = null;

  isMobileView: boolean = false;
  isMenuOpen: boolean = false;

  private destroy$ = new Web.Subject<void>();

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public localizationService: LocalizationService,
    private publicDataService: PublicDataService
  ) {
    this.localizationService.setModule('web');
  }

  /**
   * @description Initializes translation streams and route observation.
   */
  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(t => {
        this.t = t;
        this.cdr.markForCheck();
      });

    // Read from the cache populated by AppBootstrapService at startup —
    // do NOT fetch here, that would duplicate the request and reintroduce
    // the "empty logo" flash that preloading is meant to avoid.
    // NOTE: cache holds the full { settings, social_links } response shape,
    // so we unwrap .settings here (header doesn't use social_links itself).
    this.publicDataService.siteSettingsValue$
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        this.siteSettings = res?.settings ?? null;
        this.cdr.markForCheck();
      });

    this.checkMobileView();

    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntil(this.destroy$))
      .subscribe((event: NavigationEnd) => {
        window.scrollTo(0, 0);
        // Links are compared without the language of the URL (`/cs/services` → `/services`).
        this.currentActiveRoute = stripLanguagePrefix((event as NavigationEnd).urlAfterRedirects);
        this.handleRouteChange();
      });

    // Initial check for current route
    this.initialRouteTimeout = setTimeout(() => {
      this.currentActiveRoute = stripLanguagePrefix(this.router.url);
      this.handleRouteChange();
    }, 0);

    this.scheduleUpdate(false);
    this.initResizeObserver();
  }

  ngAfterViewInit(): void { this.scheduleUpdate(false); }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.checkMobileView();
    if (!this.isMobileView && this.isMenuOpen) this.closeMenu();
  }

  /**
   * @description Toggles state based on viewport width.
   */
  private checkMobileView(): void {
    const newIsMobileView = window.innerWidth <= 768;
    if (this.isMobileView !== newIsMobileView) {
      this.isMobileView = newIsMobileView;
      this.cdr.detectChanges();
      if (!this.isMobileView) this.scheduleUpdate(false);
    }
  }

  toggleMenu(): void { this.isMenuOpen = !this.isMenuOpen; this.toggleScroll(this.isMenuOpen); }
  closeMenu(): void  { this.isMenuOpen = false; this.toggleScroll(false); }

  private toggleScroll(blockScroll: boolean): void {
    const html = document.documentElement;
    if (html) blockScroll ? html.classList.add('no-scroll') : html.classList.remove('no-scroll');
  }

  /**
   * @description Handles visual feedback for route changes, including indicator animation sequences.
   */
  private handleRouteChange(): void {
    if (this.isMobileView) return;
    const allLinks = this.navLinks.map(link => link.nativeElement);
    const targetLink = allLinks.find(link => {
      const linkRoute = link.getAttribute('routerLink');
      return linkRoute && this.currentActiveRoute?.startsWith(linkRoute);
    });

    this.navLinks.forEach(link => {
      link.nativeElement.classList.remove('active', 'highlight-text', 'is-clicked-animating');
    });
    this.navLinks.forEach(link => link.nativeElement.classList.add('is-clicked-animating'));

    if (targetLink) targetLink.classList.add('highlight-text');
    this.cdr.detectChanges();

    this.showIndicator = true;
    this.isAnimatingTransition = true;
    this.scheduleUpdate(true);

    clearTimeout(this.animationTimeout);
    this.animationTimeout = setTimeout(() => {
      this.showIndicator = false;
      this.isAnimatingTransition = false;
      this.navLinks.forEach(link => {
        link.nativeElement.classList.remove('is-clicked-animating', 'highlight-text');
      });
      if (targetLink) targetLink.classList.add('active');
      this.cdr.detectChanges();
    }, this.INDICATOR_ANIMATION_DURATION);
  }

  /**
   * @description Optimized loop for indicator position updates.
   * @param forceAnimate Boolean to override transition constraints.
   */
  private scheduleUpdate(forceAnimate: boolean = false): void {
    if (this.isMobileView) return;
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.ngZone.run(() => {
            this.updateIndicatorPosition(forceAnimate);
            this.cdr.detectChanges();
          });
        });
      });
    });
  }

  private initResizeObserver(): void {
    const headerElement = document.querySelector('header');
    if (headerElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.ngZone.run(() => {
          this.checkMobileView();
          if (!this.isMobileView) this.scheduleUpdate(false);
        });
      });
      this.resizeObserver.observe(headerElement);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    clearTimeout(this.animationTimeout);
    clearTimeout(this.initialRouteTimeout);
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (this.isMobileView) return;
    const scrollThreshold = 100;
    if (window.scrollY > scrollThreshold !== this.scrolled) {
      this.scrolled = window.scrollY > scrollThreshold;
      this.scheduleUpdate(true);
    }
  }

  /**
   * @description Calculates and updates the navigation indicator styling based on current scroll and route state.
   * @param forceAnimate Ensures CSS transitions are applied.
   */
  updateIndicatorPosition(forceAnimate: boolean = false): void {
    if (this.isMobileView) return;
    const allLinks = this.navLinks.map(link => link.nativeElement);
    let targetLinkElement = allLinks.find(link =>
      (this.showIndicator || this.isAnimatingTransition)
        ? link.getAttribute('routerLink') && this.currentActiveRoute?.startsWith(link.getAttribute('routerLink')!)
        : link.classList.contains('active')
    );

    if (!targetLinkElement) {
      targetLinkElement = allLinks.find(link =>
        link.getAttribute('routerLink') && stripLanguagePrefix(this.router.url).startsWith(link.getAttribute('routerLink')!)
      );
    }

    if (targetLinkElement) {
      const currentGap = this.scrolled ? this.GAP_SCROLLED : this.GAP_DEFAULT;
      const targetLinkIndex = allLinks.indexOf(targetLinkElement);
      if (targetLinkIndex !== -1) {
        this.indicatorStyle = {
          width: `${this.LINK_WIDTH}px`,
          height: this.scrolled ? '26px' : '38px',
          opacity: this.showIndicator ? 1 : 0,
          transform: `translateX(${(targetLinkIndex * this.LINK_WIDTH) + (targetLinkIndex * currentGap)}px) translateY(-50%)`,
          transition: (!forceAnimate && !this.scrolled && !this.isAnimatingTransition)
            ? 'none'
            : `all ${this.INDICATOR_ANIMATION_DURATION / 1000}s cubic-bezier(0.25, 0.8, 0.25, 1)`
        };
      }
    } else {
      this.indicatorStyle = {
        opacity: 0, width: '0px', height: '0px',
        transform: 'translateX(0px) translateY(-50%)', transition: 'none'
      };
    }
  }
}