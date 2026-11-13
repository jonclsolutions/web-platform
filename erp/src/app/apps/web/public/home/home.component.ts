/**
 * @file home.component.ts
 * @path src/app/apps/web/public/home/home.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Public home page - hero, about, system features, tech stack, FAQ and CTA.
 * @dependencies BasePublicComponent, RouterLink, tech-stack.config
 */
import {
  Component,
  ChangeDetectionStrategy
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasePublicComponent } from '../../../../public/base-public.component';
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