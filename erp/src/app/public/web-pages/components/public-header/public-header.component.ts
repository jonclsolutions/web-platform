import {
  Component, OnInit, HostListener, AfterViewInit,
  QueryList, ElementRef, ViewChildren,
  ChangeDetectorRef, NgZone, OnDestroy, Output, EventEmitter
} from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, takeUntil } from 'rxjs/operators';
import { LocalizationService, LangMeta } from '../../../../shared/services/localization.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { Observable } from 'rxjs';
import * as Web from '../../../../shared/imports/web-providers';

@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-header.component.html',
  styleUrls: ['./public-header.component.css']
})
export class PublicHeaderComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() menuToggled = new EventEmitter<boolean>();
  @ViewChildren('homeLink, servicesLink, shopLink, academyLink')
  navLinks!: QueryList<ElementRef<HTMLAnchorElement>>;

  t: any = null;
  indicatorStyle: any = {};
  scrolled: boolean = false;
  private resizeObserver: ResizeObserver | undefined;

  siteSettings: any = null;

  cz_flag_link: string = 'assets/images/icons/czech-republic.png';
  en_flag_link: string = 'assets/images/icons/united-kingdom.png';
  tel_icon: string = 'assets/images/icons/call.png';
  mail_icon: string = 'assets/images/icons/mail.png';
  logo: string = 'assets/images/logos/logo.png';

  showIndicator: boolean = false;
  isAnimatingTransition: boolean = false;
  private animationTimeout: any;

  private readonly LINK_WIDTH = 130;
  private readonly GAP_DEFAULT = 15;
  private readonly GAP_SCROLLED = 8;
  private readonly INDICATOR_ANIMATION_DURATION = 400;

  private currentActiveRoute: string | null = null;
  currentLanguage$: Observable<string>;

  isMobileView: boolean = false;
  isMenuOpen: boolean = false;

  /** Stav dropdown přepínače jazyků */
  isLangOpen: boolean = false;

  availableLanguages: LangMeta[] = [];

  private destroy$ = new Web.Subject<void>();

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public localizationService: LocalizationService,
    private publicDataService: PublicDataService
  ) {
    this.localizationService.setModule('web');
    this.currentLanguage$ = this.localizationService.currentLanguage$;
  }

  ngOnInit(): void {
    // Logování jazyků
    this.localizationService.fetchLanguages().subscribe(res => {
      this.availableLanguages = res.languages;
      this.cdr.markForCheck();
    });

    // Logování překladů
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(t => {
        this.t = t;
        this.cdr.markForCheck();
      });

    // Logování nastavení webu
    this.publicDataService.getSiteSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.siteSettings = data.settings;
        this.cdr.markForCheck();
      });

    this.checkMobileView();

    this.router.events.pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        window.scrollTo(0, 0);
        this.currentActiveRoute = (event as NavigationEnd).urlAfterRedirects;
        this.handleRouteChange();
      });

    setTimeout(() => {
      this.currentActiveRoute = this.router.url;
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.lang-dropdown')) {
      this.isLangOpen = false;
      this.cdr.markForCheck();
    }
  }

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

  toggleLangDropdown(): void {
    this.isLangOpen = !this.isLangOpen;
    this.cdr.markForCheck();
  }

  closeLangDropdown(): void {
    this.isLangOpen = false;
    this.cdr.markForCheck();
  }

  getActiveLang(): LangMeta | undefined {
    const current = this.localizationService.getCurrentLanguage();
    return this.availableLanguages.find(l => l.code === current);
  }

  private toggleScroll(blockScroll: boolean): void {
    const html = document.documentElement;
    if (html) blockScroll ? html.classList.add('no-scroll') : html.classList.remove('no-scroll');
  }

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
        link.getAttribute('routerLink') && this.router.url.startsWith(link.getAttribute('routerLink')!)
      );
    }

    if (targetLinkElement) {
      const currentGap = this.scrolled ? this.GAP_SCROLLED : this.GAP_DEFAULT;
      const targetLinkIndex = allLinks.indexOf(targetLinkElement);
      if (targetLinkIndex !== -1) {
        this.indicatorStyle = {
          width: `${this.LINK_WIDTH}px`,
          height: this.scrolled ? '32px' : '48px',
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

  selectLanguage(code: string): void {
    this.localizationService.setLanguage(code);
  }
}