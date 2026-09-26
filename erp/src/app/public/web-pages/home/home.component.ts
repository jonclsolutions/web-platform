/**
 * @file home.component.ts
 * @path src/app/public/web-pages/home/home.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Public home page - hero, about, system features, tech stack, FAQ and CTA.
 * @refactor-note (2026-09-26): The animated hero particle field (canvas, ResizeObserver,
 *   mouse interaction, requestAnimationFrame loop) was removed - the hero now uses a static
 *   space background image (assets/images/home/hero-space-bg.svg). Unused imports
 *   (ElementRef, ViewChild, OnDestroy, NgZone, PLATFORM_ID, inject, isPlatformBrowser) and
 *   the HeroParticle / HeroMousePoint interfaces were removed with it. Nothing else changed.
 * @dependencies BasePublicComponent, RouterLink, tech-stack.config
 */
import {
  Component,
  ChangeDetectionStrategy
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';
import { TECH_STACK_ROW_TOP, TECH_STACK_ROW_BOTTOM, TechStackItem, buildMarqueeLoop } from './tech-stack.config';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent extends BasePublicComponent {

  protected readonly translationKey = 'home';

  private heroBackgroundImageUrl: string = 'assets/images/backgrounds/home_background.jpg';
  private serviceBackgrounds: { [key: string]: string } = {
    webapp: 'assets/images/backgrounds/service-web.jpg',
    desktopapp: 'assets/images/backgrounds/service-desktop.jpg',
    mobileapp: 'assets/images/backgrounds/service-mobile.jpg',
    aiapp: 'assets/images/backgrounds/service-ai.jpg',
  };

  graphs_1: string = "assets/images/home/graphs_1.png";
  stats_1: string = "assets/images/home/stats_1.png";

  server: string = "assets/images/svg/server.svg";
  web_desk: string = "assets/images/svg/web-desk.svg";
  desktop_desk: string = "assets/images/svg/desktop-desk.svg";
  mobile_desk: string = "assets/images/svg/mobile-desk.svg";
  ai_desk: string = "assets/images/svg/ai-desk.svg";
  server_resp_1: string = "assets/images/svg/server-resp-1.svg";
  server_resp_2: string = "assets/images/svg/server-resp-2.svg";
  server_mobile: string = "assets/images/svg/server-mobile.svg";

  web_mob: string = "assets/images/svg/web-mob.svg";
  desktop_mob: string = "assets/images/svg/desktop-mob.svg";
  mobile_mob: string = "assets/images/svg/mobile-mob.svg";
  ai_mob: string = "assets/images/svg/ai-mob.svg";

  check_mark: string = 'assets/images/icons/check.png';

  c_sharp: string = 'assets/images/services-img/csharp.png';
  ts: string = 'assets/images/services-img/ts.png';
  php: string = 'assets/images/services-img/php.png';
  python: string = 'assets/images/services-img/py.png';
  cpp: string = 'assets/images/services-img/cpp.png';
  kotlin: string = 'assets/images/services-img/kotlin.png';

  smoke: string = 'assets/images/backgrounds/smoke-cropped.svg';

  hoverState: { [key: string]: boolean } = {
    webapp: false,
    website: false,
    desktopapp: false,
    graphicdesign: false,
  };

  /**
   * @description Tech-stack marquee data (see tech-stack.config.ts). Static, built once -
   * plain readonly fields, stable references for `@for`.
   */
  readonly techStackAll: TechStackItem[] = [...TECH_STACK_ROW_TOP, ...TECH_STACK_ROW_BOTTOM];
  readonly techStackTopLoop: TechStackItem[] = buildMarqueeLoop(TECH_STACK_ROW_TOP);
  readonly techStackBottomLoop: TechStackItem[] = buildMarqueeLoop(TECH_STACK_ROW_BOTTOM);

  /** Whether the tech-stack marquee is paused by the user (WCAG 2.2.2). */
  techStackPaused = false;

  toggleTechStackPaused(): void {
    this.techStackPaused = !this.techStackPaused;
  }

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

  getHeroBackground(): string {
    return `url('${this.heroBackgroundImageUrl}')`;
  }

  getServiceBackground(serviceName: string): string {
    return `url('${this.serviceBackgrounds[serviceName]}')`;
  }

  getServiceOverlayStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      filter: isHovered ? 'grayscale(0%) brightness(1)' : 'grayscale(100%) brightness(0.7)',
      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    };
  }

  getTextStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      color: isHovered ? '#00bcd4' : '#e0e0e0',
      textShadow: isHovered ? '0 0 15px rgba(0, 188, 212, 0.7)' : 'none',
      transition: 'color 0.4s ease, text-shadow 0.4s ease'
    };
  }

  getArrowStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      color: isHovered ? '#00bcd4' : '#e0e0e0',
      opacity: '1',
      transform: isHovered ? 'translateX(20px)' : 'translateX(0px)',
      transition: 'color 0.4s ease, transform 0.4s ease'
    };
  }

  setHoverState(serviceName: string, isHovering: boolean) {
    this.hoverState[serviceName] = isHovering;
    this.cdr.markForCheck();
  }
}