import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  PLATFORM_ID,
  inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';

/**
 * @description Single point in the hero section's animated particle field.
 */
interface HeroParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface HeroMousePoint {
  x: number;
  y: number;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent extends BasePublicComponent implements AfterViewInit, OnDestroy {

  protected readonly translationKey = 'home';

  // Zachovaná struktura assetů pro kompatibilitu s HTML
  private heroBackgroundImageUrl: string = 'assets/images/backgrounds/home_background.jpg';
  private serviceBackgrounds: { [key: string]: string } = {
    webapp: 'assets/images/backgrounds/service-web.jpg',
    desktopapp: 'assets/images/backgrounds/service-desktop.jpg',
    mobileapp: 'assets/images/backgrounds/service-mobile.jpg',
    aiapp: 'assets/images/backgrounds/service-ai.jpg',
  };

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

  hoverState: { [key: string]: boolean } = {
    webapp: false,
    website: false,
    desktopapp: false,
    graphicdesign: false,
  };

  // ── Hero particle background ─────────────────────────────────────────
  // Canvas-based "network" effect (dark background, drifting dots
  // connected by fading lines, reacting to the cursor) painted behind the
  // hero section's text — similar to the coolbackgrounds.io "particles"
  // style. Pure canvas + requestAnimationFrame, no external library.

  /** Canvas element (`#heroParticleCanvas` in the template) used as the hero's animated background. */
  @ViewChild('heroParticleCanvas') private heroParticleCanvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  private particleCtx: CanvasRenderingContext2D | null = null;
  private particles: HeroParticle[] = [];
  private particleAnimationFrameId: number | null = null;
  private particleResizeObserver?: ResizeObserver;
  /** Element that receives pointer events for the field (canvas itself is `pointer-events: none`). */
  private particleInteractionEl?: HTMLElement;
  /** Current cursor position relative to the canvas, or null when the pointer is outside/inactive. */
  private mouse: HeroMousePoint | null = null;

  /** RGB triplet for the dots/lines — matches the site's purple accent (`#a67dff`). */
  private readonly PARTICLE_COLOR = '166, 125, 255';
  /** Roughly one particle per this many square px of canvas area — lower = denser field. */
  private readonly PARTICLE_DENSITY = 14000;
  private readonly PARTICLE_MIN_COUNT = 26;
  private readonly PARTICLE_MAX_COUNT = 85;
  /** Max distance (px) at which two particles are still linked by a line. */
  private readonly PARTICLE_LINK_DISTANCE = 170;
  /** Max distance (px) at which the cursor links to a particle. */
  private readonly MOUSE_LINK_DISTANCE = 220;
  /** Radius (px) around the cursor within which particles get gently pushed away. */
  private readonly MOUSE_REPEL_RADIUS = 120;
  /** Strength of the cursor's repel effect. */
  private readonly MOUSE_REPEL_STRENGTH = 0.6;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.heroParticleCanvasRef) return;
    this.initParticleField(this.heroParticleCanvasRef.nativeElement);
  }

  override ngOnDestroy(): void {
    this.stopParticleField();
    super.ngOnDestroy();
  }

  /**
   * @description Boots up the particle network: sizes the canvas to its
   * parent, seeds a particle field scaled to that area, watches for resize
   * and cursor movement, and starts the render loop entirely outside
   * Angular's zone (it repaints every frame and never needs change detection).
   */
  private initParticleField(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.particleCtx = ctx;

    this.resizeParticleCanvas(canvas);
    this.seedParticles(canvas);

    this.particleResizeObserver = new ResizeObserver(() => this.resizeParticleCanvas(canvas));
    this.particleResizeObserver.observe(canvas.parentElement ?? canvas);

    // Canvas is `pointer-events: none` (so it never blocks clicks on the
    // hero content), so pointer tracking listens on its parent instead.
    this.particleInteractionEl = canvas.parentElement ?? canvas;

    this.ngZone.runOutsideAngular(() => {
      this.particleInteractionEl!.addEventListener('mousemove', this.handlePointerMove);
      this.particleInteractionEl!.addEventListener('mouseleave', this.handlePointerLeave);
      this.particleInteractionEl!.addEventListener('touchmove', this.handleTouchMove, { passive: true });
      this.particleInteractionEl!.addEventListener('touchend', this.handlePointerLeave);

      this.renderParticleFrame(canvas);
    });
  }

  private handlePointerMove = (event: MouseEvent): void => {
    const canvas = this.heroParticleCanvasRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  private handleTouchMove = (event: TouchEvent): void => {
    const canvas = this.heroParticleCanvasRef?.nativeElement;
    const touch = event.touches[0];
    if (!canvas || !touch) return;
    const rect = canvas.getBoundingClientRect();
    this.mouse = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  private handlePointerLeave = (): void => {
    this.mouse = null;
  };

  /**
   * @description Syncs the canvas' backing buffer to its on-screen size,
   * scaled for `devicePixelRatio` so dots and lines stay crisp on high-DPI
   * screens.
   */
  private resizeParticleCanvas(canvas: HTMLCanvasElement): void {
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? canvas.clientWidth;
    const height = parent?.clientHeight ?? canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    this.particleCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * @description Generates the particle field, scaling particle count to
   * the canvas' visible area so density looks consistent from a small
   * phone hero to a wide desktop one.
   */
  private seedParticles(canvas: HTMLCanvasElement): void {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    const targetCount = Math.round((width * height) / this.PARTICLE_DENSITY);
    const count = Math.min(this.PARTICLE_MAX_COUNT, Math.max(this.PARTICLE_MIN_COUNT, targetCount));

    this.particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 1.6 + 0.8
    }));
  }

  /**
   * @description Single animation step: drifts every particle (nudging it
   * away from the cursor when nearby), bounces it off the canvas edges,
   * draws it as a soft dot, then connects it to nearby particles — and to
   * the cursor itself — with a line whose opacity fades with distance.
   * That's the classic drifting-network particle look, now reactive to
   * the mouse like coolbackgrounds.io's "particles" preset.
   */
  private renderParticleFrame = (canvas: HTMLCanvasElement): void => {
    const ctx = this.particleCtx;
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    for (const particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Gently push the particle away from the cursor if it's close by.
      if (this.mouse) {
        const dx = particle.x - this.mouse.x;
        const dy = particle.y - this.mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.MOUSE_REPEL_RADIUS && distance > 0.01) {
          const force = (1 - distance / this.MOUSE_REPEL_RADIUS) * this.MOUSE_REPEL_STRENGTH;
          particle.x += (dx / distance) * force;
          particle.y += (dy / distance) * force;
        }
      }

      if (particle.x <= 0 || particle.x >= width) particle.vx *= -1;
      if (particle.y <= 0 || particle.y >= height) particle.vy *= -1;
      particle.x = Math.min(Math.max(particle.x, 0), width);
      particle.y = Math.min(Math.max(particle.y, 0), height);

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.PARTICLE_COLOR}, 0.85)`;
      ctx.fill();
    }

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.PARTICLE_LINK_DISTANCE) {
          const opacity = (1 - distance / this.PARTICLE_LINK_DISTANCE) * 0.4;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${this.PARTICLE_COLOR}, ${opacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Link the cursor itself into the network, same fading-line treatment.
    if (this.mouse) {
      for (const particle of this.particles) {
        const dx = particle.x - this.mouse.x;
        const dy = particle.y - this.mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.MOUSE_LINK_DISTANCE) {
          const opacity = (1 - distance / this.MOUSE_LINK_DISTANCE) * 0.55;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.strokeStyle = `rgba(${this.PARTICLE_COLOR}, ${opacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.arc(this.mouse.x, this.mouse.y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.PARTICLE_COLOR}, 0.9)`;
      ctx.fill();
    }

    this.particleAnimationFrameId = requestAnimationFrame(() => this.renderParticleFrame(canvas));
  };

  /**
   * @description Cancels the render loop, disconnects the resize observer
   * and removes the pointer listeners so the particle field doesn't keep
   * running (or leak) once the home page is navigated away from.
   */
  private stopParticleField(): void {
    if (this.particleAnimationFrameId !== null) {
      cancelAnimationFrame(this.particleAnimationFrameId);
      this.particleAnimationFrameId = null;
    }
    this.particleResizeObserver?.disconnect();
    this.particleResizeObserver = undefined;

    this.particleInteractionEl?.removeEventListener('mousemove', this.handlePointerMove);
    this.particleInteractionEl?.removeEventListener('mouseleave', this.handlePointerLeave);
    this.particleInteractionEl?.removeEventListener('touchmove', this.handleTouchMove);
    this.particleInteractionEl?.removeEventListener('touchend', this.handlePointerLeave);
    this.particleInteractionEl = undefined;
    this.mouse = null;
  }

  // Metody zůstávají beze změn pro zachování vazby v HTML
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
    this.cdr.markForCheck(); // Zajištění detekce změny pro OnPush
  }
}