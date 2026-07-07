/**
 * @file home.component.ts
 * @path src/app/public/web-pages/home/home.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Serves as the landing page for the website, managing the hero section, service overview, and technology stack visualization.
 * @dependencies
 * - LocalizationService: Handles multi-language content injection.
 * - Angular Core/Router: Manages component lifecycle and navigation.
 */

import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as Web from '../../../shared/imports/web-providers';

/**
 * @description Main dashboard component for the homepage.
 * @usage Displays high-level information about services, technologies, and products.
 * @note Implements reactive translation handling and complex hover-based UI transitions.
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [RouterLink]
})
export class HomeComponent implements Web.OnInit, Web.OnDestroy {
  /** Localized content object for the homepage */
  t: any = null;
  private destroy$ = new Web.Subject<void>();

  // Static asset references
  private heroBackgroundImageUrl: string = 'assets/images/backgrounds/home_background.jpg';
  private serviceBackgrounds: { [key: string]: string } = {
    webapp: 'assets/images/backgrounds/service-web.jpg',
    desktopapp: 'assets/images/backgrounds/service-desktop.jpg',
    mobileapp: 'assets/images/backgrounds/service-mobile.jpg',
    aiapp: 'assets/images/backgrounds/service-ai.jpg',
  };
  
  eshop_default: string = 'assets/images/product_images/admin_panel.png';
  survey_engine: string = 'assets/images/product_images/survey_engine.png';
  survey_solver: string = 'assets/images/product_images/survey_solver.png';
  check_mark: string = 'assets/images/icons/check.png';

  // Technology icon paths
  c_sharp: string = 'assets/images/services-img/csharp.png';
  ts: string = 'assets/images/services-img/ts.png';
  php: string = 'assets/images/services-img/php.png';
  python: string = 'assets/images/services-img/py.png';
  cpp: string = 'assets/images/services-img/cpp.png';
  kotlin: string = 'assets/images/services-img/kotlin.png';

  /** Tracks hover states for interactive service cards */
  hoverState: { [key: string]: boolean } = {
    webapp: false,
    website: false,
    desktopapp: false,
    graphicdesign: false,
  };

  constructor(
    private localizationService: Web.LocalizationService,
    private cdr: ChangeDetectorRef
  ) { }

  /**
   * @description Subscribes to translation service to inject content dynamically.
   */
  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.home) {
          this.t = translations.home;
          this.cdr.markForCheck(); 
        }
      });
  }

  /**
   * @description Cleans up resources on destruction.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Maps technology names to their corresponding asset URLs.
   * @param name Name of the technology.
   * @returns Asset path for the logo.
   */
  getTechIcon(name: string): string {
    const icons: Record<string, string> = {
      'C#': this.c_sharp,
      'TypeScript': this.ts,
      'PHP': this.php,
      'Python': this.python,
      'C++': this.cpp,
      'Kotlin': this.kotlin
    };
    return icons[name] || '';
  }

  /**
   * @description Returns CSS background URL for the hero component.
   */
  getHeroBackground(): string {
    return `url('${this.heroBackgroundImageUrl}')`;
  }

  /**
   * @description Returns CSS background URL for a specific service card.
   */
  getServiceBackground(serviceName: string): string {
    return `url('${this.serviceBackgrounds[serviceName]}')`;
  }

  /**
   * @description Calculates CSS filter/scale properties for service card imagery based on hover state.
   */
  getServiceOverlayStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      filter: isHovered ? 'grayscale(0%) brightness(1)' : 'grayscale(100%) brightness(0.7)',
      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    };
  }

  /**
   * @description Calculates CSS text color and shadow effects for service cards based on hover state.
   */
  getTextStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      color: isHovered ? '#00bcd4' : '#e0e0e0',
      textShadow: isHovered ? '0 0 15px rgba(0, 188, 212, 0.7)' : 'none',
      transition: 'color 0.4s ease, text-shadow 0.4s ease'
    };
  }

  /**
   * @description Calculates CSS transforms for service card arrow elements based on hover state.
   */
  getArrowStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      color: isHovered ? '#00bcd4' : '#e0e0e0',
      opacity: '1',
      transform: isHovered ? 'translateX(20px)' : 'translateX(0px)',
      transition: 'color 0.4s ease, transform 0.4s ease'
    };
  }

  /**
   * @description Updates hover state for a given service card.
   */
  setHoverState(serviceName: string, isHovering: boolean) {
    this.hoverState[serviceName] = isHovering;
  }
}