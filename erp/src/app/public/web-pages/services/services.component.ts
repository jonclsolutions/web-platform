/**
 * @file services.component.ts
 * @path src/app/public/web-pages/services/services.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Orchestrates the presentation of service offerings, including technology stack visualization, dynamic content filtering, and workflow step rendering.
 * @dependencies
 * - LocalizationService: Handles internationalized text for service headers and content.
 * - Reactive forms/RxJS: Manages route-based service filtering and state updates.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import * as Web from '../../../shared/imports/web-providers';
import { Technology } from '../components/interfaces/technology';
import { Item } from '../components/interfaces/item';

/**
 * @description Component for detailing available technical services and development workflows.
 * @usage Users can switch between service categories (web, desktop, mobile, AI) to see specific tech stacks and feature sets.
 * @note Implements a reactive approach to URL parameter listening for deep-linking into specific service categories.
 */
@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule, RouterModule, KeyValuePipe],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesComponent implements OnInit, OnDestroy {
  s: any = null;
  private destroy$ = new Web.Subject<void>();

  currentTech = 'web-dev';
  technologies: Technology[] = [];

  // Static assets for visual representation
  readonly webTechImages = [
    { name: 'C#',         path: 'assets/images/services-img/csharp.png' },
    { name: 'TypeScript', path: 'assets/images/services-img/ts.png' },
    { name: 'PHP',        path: 'assets/images/services-img/php.png' },
  ];
  readonly desktopTechImages = [
    { name: 'C#',     path: 'assets/images/services-img/csharp.png' },
    { name: 'C++',    path: 'assets/images/services-img/cpp.png' },
    { name: 'Python', path: 'assets/images/services-img/py.png' },
  ];
  readonly mobileTechImages = [
    { name: 'C#',         path: 'assets/images/services-img/csharp.png' },
    { name: 'TypeScript', path: 'assets/images/services-img/ts.png' },
    { name: 'Kotlin',     path: 'assets/images/services-img/kotlin.png' },
  ];
  readonly aiTechImages = [
    { name: 'Python', path: 'assets/images/services-img/py.png' },
    { name: 'C++',    path: 'assets/images/services-img/cpp.png' },
  ];

  readonly workflowNumbers = ['01', '02', '03', '04'];

  constructor(
    private cdr: ChangeDetectorRef,
    private route: Web.ActivatedRoute,
    private localizationService: Web.LocalizationService,
  ) {}

  /**
   * @description Initializes service data mapping from translations and monitors route changes for category selection.
   */
  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.services) {
          this.s = translations.services;
          this.technologies = [
            { id: 'web-dev',     name: this.s.web_dev_header },
            { id: 'desktop-dev', name: this.s.desktop_dev_header },
            { id: 'mobile-dev',  name: this.s.mobile_dev_header },
            { id: 'ai-dev',      name: this.s.ai_dev_header },
          ];
          this.cdr.detectChanges();
        }
      });

    this.route.queryParams
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(params => {
        const techId = params['tech'];
        this.currentTech =
          techId && this.technologies.some(t => t.id === techId)
            ? techId
            : 'web-dev';
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Dynamically selects tech stack imagery based on current selection.
   */
  get currentTechImages() {
    return this.currentTech === 'web-dev'     ? this.webTechImages
         : this.currentTech === 'desktop-dev' ? this.desktopTechImages
         : this.currentTech === 'mobile-dev'  ? this.mobileTechImages
         : this.aiTechImages;
  }

  /**
   * @description Resolves header text based on selected tech.
   */
  get currentInfoHeader(): string {
    return this.currentTech === 'web-dev'     ? this.s?.info_header_web
         : this.currentTech === 'desktop-dev' ? this.s?.info_header_desktop
         : this.currentTech === 'mobile-dev'  ? this.s?.info_header_mobile
         : this.s?.info_header_ai;
  }

  /**
   * @description Resolves main descriptive body text based on selected tech.
   */
  get currentMainText(): string {
    return this.currentTech === 'web-dev'     ? this.s?.service_main_text_1
         : this.currentTech === 'desktop-dev' ? this.s?.service_main_text_2
         : this.currentTech === 'mobile-dev'  ? this.s?.service_main_text_3
         : this.s?.service_main_text_4;
  }

  /**
   * @description Retrieves service items dictionary for current tech selection.
   */
  get currentServices() {
    return this.currentTech === 'web-dev'     ? this.s?.webServices
         : this.currentTech === 'desktop-dev' ? this.s?.desktopServices
         : this.currentTech === 'mobile-dev'  ? this.s?.mobileServices
         : this.s?.aiServices;
  }

  /**
   * @description Aggregates pricing items from translation dictionary.
   */
  get priceItems() {
    return [
      this.s?.services?.item_1,
      this.s?.services?.item_2,
      this.s?.services?.item_3,
      this.s?.services?.item_4,
      this.s?.services?.item_5,
      this.s?.services?.item_6,
    ];
  }

  /**
   * @description Aggregates collaboration workflow steps from translation dictionary.
   */
  get workflowSteps() {
    return [
      this.s?.colab?.item_1,
      this.s?.colab?.item_2,
      this.s?.colab?.item_3,
      this.s?.colab?.item_4,
    ];
  }

  /**
   * @description Toggles expansion state for FAQ/Service item elements.
   */
  toggleFaq(item: Item): void {
    item.isActive = !item.isActive;
    this.cdr.markForCheck();
  }

  /**
   * @description Sets the currently viewed technology category.
   */
  selectTech(techId: string): void {
    if (this.currentTech !== techId) {
      this.currentTech = techId;
      this.cdr.detectChanges();
    }
  }
}