/**
 * @file home.component.ts
 * @path src/app/apps/web/public/home/home.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Public home page - pinned hero (admin screen landing flat; its own geometry on
 *   phones), about, system features, tech stack, FAQ and CTA in a content sheet that slides over
 *   the hero.
 * @dependencies BasePublicComponent, RouterLink, tech-stack.config, WebMotionService,
 *   RevealDirective, RevealTextDirective, ScrollEffectDirective, motion-presets
 */
import {
  Component,
  ChangeDetectionStrategy,
  DOCUMENT,
  ElementRef,
  ViewChild,
  inject
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasePublicComponent } from '../../../../public/base-public.component';
import { TECH_STACK_ROW_TOP, TECH_STACK_ROW_BOTTOM, TechStackItem, buildMarqueeLoop } from './tech-stack.config';
import { WebMotionService } from '../motion/web-motion.service';
import { RevealDirective } from '../motion/reveal.directive';
import { RevealTextDirective } from '../motion/reveal-text.directive';
import { ScrollEffectDirective } from '../motion/scroll-effect.directive';
import { band, easeInOut, lerp } from '../motion/motion-presets';

/** Widest viewport of the phone / tablet layout (phone geometry of the hero scene). */
const COMPACT_QUERY = '(max-width: 905px)';
/** Phones: space kept for the fixed header above the flat screen (logo pill + air). */
const COMPACT_HEADER_SPACE = 96;
/** Phones: gap between the last hero line (stats) and the top edge of the rising screen. */
const COMPACT_TEXT_GAP = 32;
/** Phones: the rising screen starts at least this low (share of the viewport height). */
const COMPACT_START_MIN = 0.74;
/** Wide screens: default start of the screen's top edge (share of the viewport height). */
const WIDE_START = 0.68;
/** Wide screens: gap between the stats and the top edge of the rising screen (px). */
const WIDE_TEXT_GAP = 36;
/** Wide screens: at least this much of the screen peeks out at the start (px). */
const WIDE_MIN_PEEK = 90;
/** Wide screens: default horizon line above the stage bottom (px). */
const WIDE_HORIZON = 300;
/** Phones: at least this much of the screen peeks out at the start (px). */
const COMPACT_MIN_PEEK = 56;
/** Phones: share of the free height above the flat screen (0.5 = centred; lower = higher up). */
const COMPACT_END_BIAS = 0.35;
/** Phones: gap between the flat screen and the top edge of the content sheet when the pin ends. */
const COMPACT_SHEET_GAP = 28;

/**
 * @description Phone geometry of the hero scene, measured from the layout (untransformed boxes)
 *   when the scene starts, after fonts load and on every resize – never per frame.
 * @param startY Top edge of the screen at the start (just under the stats, at the bottom).
 * @param endY Top edge of the flat screen (centred below the header).
 * @param horizonY Planet horizon at the start (just above the screen).
 * @param stageH Height of the sticky stage (100dvh – follows the mobile address bar).
 * @param sheetPull Top margin of the content sheet (≤ 0) so it ends 28 px under the flat screen.
 */
interface CompactHeroGeometry {
  startY: number;
  endY: number;
  horizonY: number;
  stageH: number;
  sheetPull: number;
}
/** Viewport where the feature tiles stack in one column (home.component.css). */
const ONE_COLUMN_QUERY = '(max-width: 640px)';

/**
 * @description Public landing page of the website.
 * @usage Route `''` / `home` of the web public area (web-public.routes.ts).
 * @note The pinned hero scene runs whenever motion is allowed (phones get their own geometry, the
 *   desktop pose is unchanged); it is set up when the hero appears (texts loaded) and torn down
 *   with the page. Everything else is declarative
 *   (directives in the template). Design rules: shared-styles/DESIGN.md.
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['../shared-styles/theme.css', './home.component.css'],
  standalone: true,
  imports: [RouterLink, RevealDirective, RevealTextDirective, ScrollEffectDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent extends BasePublicComponent {

  protected readonly translationKey = 'home';

  private readonly motion = inject(WebMotionService);
  private readonly document = inject(DOCUMENT);

  /** Admin screenshot in the hero frame (1600 px; 2400 px for high-density screens). */
  readonly dashboardImg = 'assets/images/home/dashboard_sc_desktop-1600.webp';
  readonly dashboardSrcset = 'assets/images/home/dashboard_sc_desktop-1600.webp 1600w, assets/images/home/dashboard_sc_desktop-2400.webp 2400w';
  /** Address shown in the hero browser bar – the site's own host. */
  readonly heroDeviceUrl = `${this.document.location?.host ?? ''}/admin`;

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

  /** Whether the hero is pinned (motion allowed, any screen width); decided once per page view. */
  readonly heroPinned = !this.motion.isReduced();
  /** Columns of the feature tiles for their cascade (2, or 1 on phones). */
  readonly featureColumns = this.matches(ONE_COLUMN_QUERY) ? 1 : 2;

  @ViewChild('heroContent') private heroContent?: ElementRef<HTMLElement>;
  @ViewChild('heroDevice') private heroDevice?: ElementRef<HTMLElement>;
  @ViewChild('heroGlare') private heroGlare?: ElementRef<HTMLElement>;
  @ViewChild('heroPlanet') private heroPlanet?: ElementRef<HTMLElement>;
  @ViewChild('heroBeam') private heroBeam?: ElementRef<HTMLElement>;
  @ViewChild('heroHint') private heroHint?: ElementRef<HTMLElement>;
  @ViewChild('sheet') private sheet?: ElementRef<HTMLElement>;

  /** Cleanup of the hero scene (set once the hero exists). */
  private stopHeroScene: (() => void) | null = null;
  /** Phone layout of the scene right now (follows the viewport: rotation, DevTools resize). */
  private compactHero = false;
  /** Measured phone geometry (null until measured / on wide screens). */
  private compactGeometry: CompactHeroGeometry | null = null;
  /** Measured start of the screen and horizon on wide screens (null until measured). */
  private wideGeometry: { startY: number; horizonY: number; stageH: number } | null = null;
  /** Last rendered progress – re-rendered after a re-measure so nothing jumps. */
  private heroProgress = 0;

  /**
   * @description Hero section element – the view query fires when the hero appears (texts loaded),
   *   which is the moment to start the pinned scene.
   */
  @ViewChild('heroSection') set heroSection(ref: ElementRef<HTMLElement> | undefined) {
    if (ref && !this.stopHeroScene && this.heroPinned) {
      // Children queries resolve in the same pass; start after it.
      queueMicrotask(() => this.startHeroScene(ref.nativeElement));
    }
  }

  /** @description Stops the hero scene with the page. */
  protected override onDestroy(): void {
    this.stopHeroScene?.();
    this.stopHeroScene = null;
  }

  /**
   * @description Starts the pinned hero scene: the spring-smoothed progress of the hero section
   *   (top of the section at the top of the viewport → its end at the bottom) drives renderHero().
   * @param section The hero section (200 vh tall when pinned).
   */
  private startHeroScene(section: HTMLElement): void {
    const view = this.document.defaultView;
    if (this.stopHeroScene || !this.heroDevice || !view) {
      return;
    }
    const compactQuery = view.matchMedia?.(COMPACT_QUERY) ?? null;
    const remeasure = () => {
      this.compactHero = !!compactQuery?.matches;
      this.compactGeometry = this.compactHero ? this.measureCompactHero(section, view.innerHeight) : null;
      this.wideGeometry = this.compactHero ? null : this.measureWideHero(section, view.innerHeight);
      // Phones: the sheet follows the flat screen closely; wide screens keep the CSS overlap.
      const sheet = this.sheet?.nativeElement;
      if (sheet) {
        sheet.style.marginTop = this.compactGeometry ? `${this.compactGeometry.sheetPull.toFixed(0)}px` : '';
      }
      this.renderHero(this.heroProgress);
    };
    this.motion.outside(() => {
      remeasure();
      view.addEventListener('resize', remeasure, { passive: true });
      compactQuery?.addEventListener?.('change', remeasure);
      // Web fonts change the height of the hero text once they arrive.
      this.document.fonts?.ready.then(() => this.stopHeroScene && remeasure());
    });
    const stopScroll = this.motion.linkScroll(section, ['start start', 'end end'], progress => this.renderHero(progress));
    this.stopHeroScene = () => {
      stopScroll();
      if (this.sheet) {
        this.sheet.nativeElement.style.marginTop = '';
      }
      view.removeEventListener('resize', remeasure);
      compactQuery?.removeEventListener?.('change', remeasure);
    };
  }

  /**
   * @description Measures the phone geometry of the scene from layout boxes (transforms ignored):
   *   the screen starts just under the stats but at least at 74 % of the viewport height (and keeps
   *   56 px visible), and ends in the upper part of the space below the fixed header (35 % of the
   *   free height above it); the sheet is pulled up to 28 px below the flat screen.
   * @param section The pinned hero section (its first child is the sticky stage).
   * @param fallbackHeight innerHeight, used when the stage has no height (not laid out).
   * @returns Start / end of the screen's top edge, the horizon line, the stage height (px from the
   *   stage top) and the top margin of the sheet.
   */
  private measureCompactHero(section: HTMLElement, fallbackHeight: number): CompactHeroGeometry {
    const vh = (section.firstElementChild as HTMLElement | null)?.offsetHeight || fallbackHeight;
    const content = this.heroContent?.nativeElement;
    const frame = this.heroDevice?.nativeElement;
    const textBottom = content ? content.offsetTop + content.offsetHeight : vh * 0.6;
    const height = frame?.offsetHeight ?? 0;
    const startY = Math.min(Math.max(textBottom + COMPACT_TEXT_GAP, vh * COMPACT_START_MIN), vh - COMPACT_MIN_PEEK);
    const endY = Math.max(COMPACT_HEADER_SPACE, COMPACT_HEADER_SPACE + (vh - COMPACT_HEADER_SPACE - height) * COMPACT_END_BIAS);
    // When the pin ends the stage bottom is at the viewport bottom; the sheet starts there + margin.
    const sheetPull = Math.min(0, endY + height + COMPACT_SHEET_GAP - vh);
    return { startY, endY, horizonY: startY - 14, stageH: vh, sheetPull };
  }

  /**
   * @description Measures where the screen starts on wide screens: at 68 % of the viewport height
   *   as designed, but lower when the hero text reaches further down (short laptop screens, larger
   *   system font scaling) – always 36 px under the stats, with at least 90 px of the screen
   *   visible. The horizon stays 300 px above the bottom, or just above the screen if that is lower,
   *   so neither ever covers the stats. On a 1920 × 1080 screen nothing changes.
   * @param section The pinned hero section (its first child is the sticky stage).
   * @param fallbackHeight innerHeight, used when the stage has no height (not laid out).
   * @returns Start of the screen's top edge, horizon line and stage height (px from the stage top).
   */
  private measureWideHero(section: HTMLElement, fallbackHeight: number): { startY: number; horizonY: number; stageH: number } {
    const vh = (section.firstElementChild as HTMLElement | null)?.offsetHeight || fallbackHeight;
    const content = this.heroContent?.nativeElement;
    const textBottom = content ? content.offsetTop + content.offsetHeight : 0;
    const startY = Math.min(Math.max(vh * WIDE_START, textBottom + WIDE_TEXT_GAP), vh - WIDE_MIN_PEEK);
    return { startY, horizonY: Math.max(vh - WIDE_HORIZON, startY - 14), stageH: vh };
  }

  /**
   * @description One frame of the hero for pin progress p (0–1):
   *   0.00–0.80 the screen rises from 68 % (lower when the text needs it, see measureWideHero) to
   *   10 % of the viewport height, turns from 30° to flat
   *   and grows from 0.8 to 1 (easeInOut); the text leaves upwards in the first 55 % of the move;
   *   0.80–1.00 short hold – the flat screen stays readable before the sheet slides over it.
   *   Phones: the same timing with the measured geometry – from the bottom edge (just under the
   *   stats) to the upper part of the screen below the header, 28° → flat, 0.92 → 1; the horizon
   *   starts right above the screen.
   * @param p Smoothed progress of the pinned section.
   * @note Writes transform / opacity only (compositor); with reduced motion the service passes 1,
   *   but the static layout (hero not pinned) has no scene at all.
   */
  private renderHero(p: number): void {
    this.heroProgress = p;
    const geometry = this.compactHero ? this.compactGeometry : null;
    if (geometry) {
      this.renderCompactHero(p, geometry);
      return;
    }
    const vh = this.document.defaultView?.innerHeight ?? 900;
    const e = easeInOut(band(p, 0, 0.8));
    const out = band(e, 0, 0.55);

    const content = this.heroContent?.nativeElement;
    if (content) {
      content.style.opacity = (1 - out).toFixed(3);
      content.style.transform = `translateY(${(-150 * out).toFixed(1)}px) scale(${(1 - 0.05 * out).toFixed(4)})`;
    }
    const hint = this.heroHint?.nativeElement;
    if (hint) {
      hint.style.opacity = (1 - band(p, 0, 0.04)).toFixed(3);
    }
    const device = this.heroDevice?.nativeElement;
    if (device) {
      device.style.transform =
        `translateY(${lerp(this.wideGeometry?.startY ?? vh * WIDE_START, vh * 0.1, e).toFixed(1)}px) rotateX(${(30 * (1 - e)).toFixed(2)}deg) scale(${lerp(0.8, 1, e).toFixed(4)})`;
    }
    const glare = this.heroGlare?.nativeElement;
    if (glare) {
      glare.style.transform = `translateX(${lerp(-60, 90, e).toFixed(1)}%)`;
      glare.style.opacity = (1 - e).toFixed(3);
    }
    const planet = this.heroPlanet?.nativeElement;
    if (planet) {
      // The planet hangs from the stage bottom (top: 100 %): its rim sits on the horizon line.
      const wide = this.wideGeometry;
      const rim = wide ? wide.horizonY - wide.stageH : -WIDE_HORIZON;
      planet.style.transform = `translateY(${(rim - 160 * e).toFixed(1)}px)`;
    }
    const beam = this.heroBeam?.nativeElement;
    if (beam) {
      beam.style.transform = `translateY(${(-140 * e).toFixed(1)}px)`;
    }
  }

  /**
   * @description Phone frame of the hero (see renderHero): screen from geometry.startY to
   *   geometry.endY, text out upwards, horizon follows; no scroll hint (touch screens).
   * @param p Smoothed progress of the pinned section.
   * @param geometry Measured phone geometry.
   */
  private renderCompactHero(p: number, geometry: CompactHeroGeometry): void {
    const e = easeInOut(band(p, 0, 0.8));
    const out = band(e, 0, 0.55);

    const content = this.heroContent?.nativeElement;
    if (content) {
      content.style.opacity = (1 - out).toFixed(3);
      content.style.transform = `translateY(${(-110 * out).toFixed(1)}px) scale(${(1 - 0.04 * out).toFixed(4)})`;
    }
    const device = this.heroDevice?.nativeElement;
    if (device) {
      device.style.transform =
        `translateY(${lerp(geometry.startY, geometry.endY, e).toFixed(1)}px) rotateX(${(28 * (1 - e)).toFixed(2)}deg) scale(${lerp(0.92, 1, e).toFixed(4)})`;
    }
    const glare = this.heroGlare?.nativeElement;
    if (glare) {
      glare.style.transform = `translateX(${lerp(-60, 90, e).toFixed(1)}%)`;
      glare.style.opacity = (1 - e).toFixed(3);
    }
    const planet = this.heroPlanet?.nativeElement;
    if (planet) {
      // The planet hangs from the stage bottom (top: 100 %): move its rim to the horizon line.
      planet.style.transform = `translateY(${(geometry.horizonY - geometry.stageH - 120 * e).toFixed(1)}px)`;
    }
    const beam = this.heroBeam?.nativeElement;
    if (beam) {
      beam.style.transform = `translateY(${(-100 * e).toFixed(1)}px)`;
    }
  }

  /**
   * @description Media query check that also works outside a browser (tests: false).
   * @param query CSS media query.
   * @returns Whether it matches now.
   */
  private matches(query: string): boolean {
    return !!this.document.defaultView?.matchMedia?.(query).matches;
  }
}
