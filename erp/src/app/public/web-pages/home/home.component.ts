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
 * @refactor-note (2026-10-21) Removed unused code (no reference in TS, templates or
 *   string literals): `web_desk`, `desktop_desk`, `mobile_desk`, `ai_desk`, `server_resp_1`, `server_resp_2`, `server_mobile`, `web_mob`, `desktop_mob`, `mobile_mob`, `ai_mob`, `check_mark`, `toggleTechStackPaused`, `getTechIcon`, `getHeroBackground`, `getServiceBackground`, `getServiceOverlayStyles`, `getTextStyles`, `getArrowStyles`, `setHoverState`, `heroBackgroundImageUrl`, `serviceBackgrounds`, `c_sharp`, `python`, `cpp`, `kotlin`, `hoverState`.
 * @refactor-note (2026-10-23) Removed `server` - it pointed to a missing assets/images/svg/server.svg
 *   and no template used it (open finding #46).
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

  hero_img: string = "assets/images/home/hero-space-bg.svg";

  graphs_1: string = "assets/images/home/graphs_1.png";
  stats_1: string = "assets/images/home/stats_1.png";

  ts: string = 'assets/images/services-img/ts.png';
  php: string = 'assets/images/services-img/php.png';

  smoke: string = 'assets/images/backgrounds/smoke-cropped.svg';

  /**
   * @description Tech-stack marquee data (see tech-stack.config.ts). Static, built once -
   * plain readonly fields, stable references for `@for`.
   */
  readonly techStackAll: TechStackItem[] = [...TECH_STACK_ROW_TOP, ...TECH_STACK_ROW_BOTTOM];
  readonly techStackTopLoop: TechStackItem[] = buildMarqueeLoop(TECH_STACK_ROW_TOP);
  readonly techStackBottomLoop: TechStackItem[] = buildMarqueeLoop(TECH_STACK_ROW_BOTTOM);

  /** Whether the tech-stack marquee is paused by the user (WCAG 2.2.2). */
  techStackPaused = false;
}