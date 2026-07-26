import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
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
export class HomeComponent extends BasePublicComponent implements OnDestroy {

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
  private heroParticleCanvasEl?: HTMLCanvasElement;
  private hasInitialized = false;

  @ViewChild('heroParticleCanvas') set heroParticleCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (ref?.nativeElement && !this.hasInitialized) {
      this.heroParticleCanvasEl = ref.nativeElement;
      this.hasInitialized = true;
      
      // Spustíme hned, jakmile Angular prvek vykreslí do DOMu
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          if (this.heroParticleCanvasEl) {
            this.initParticleField(this.heroParticleCanvasEl);
          }
        }, 50);
      }
    }
  }

  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  private particleCtx: CanvasRenderingContext2D | null = null;
  private particles: HeroParticle[] = [];
  private particleAnimationFrameId: number | null = null;
  private particleResizeObserver?: ResizeObserver;
  private particleInteractionEl?: HTMLElement;
  private mouse: HeroMousePoint | null = null;

  private readonly PARTICLE_COLOR = '166, 125, 255';

  /**
   * Cílová "hustota" v px² plochy na jednu částici - určuje průměrnou vzdálenost
   * mezi tečkami. Toto číslo se NEMĚNÍ podle velikosti plochy (proto samo o sobě
   * dává na všech rozlišeních konzistentní design), problém byl jen v tom, že
   * výsledný počet byl dřív tvrdě ořezáván (viz PARTICLE_MIN/MAX_COUNT níže).
   */
  private readonly PARTICLE_DENSITY = 14000;

  /**
   * Dolní/horní mez počtu částic. Dolní mez chrání jen velmi malé plochy
   * (ať tam není jen pár osamocených teček), horní mez je čistě výkonnostní
   * pojistka pro extrémně velké plochy (spojnice se počítají O(n²) na snímek) -
   * NENÍ to designový strop, proto je nastavena mnohem výš, než kolik reálně
   * kdy vzorec plocha/hustota na běžných rozlišeních vrátí.
   */
  private readonly PARTICLE_MIN_COUNT = 14;
  private readonly PARTICLE_MAX_COUNT = 260;

  /**
   * Vzdálenosti pro spojnice/interakci jsou navržené a odladěné pro tuto
   * referenční šířku plátna (běžný notebook). Při jiné šířce se přepočítají
   * proporcionálně (viz `currentScale`), takže relativní "hustota pavučiny"
   * zůstává na všech rozlišeních stejná - na 1440px šířky se chování vůbec
   * nezmění, jinde se poměrově přizpůsobí.
   */
  private readonly REFERENCE_WIDTH = 1440;
  private readonly SCALE_MIN = 0.4;
  private readonly SCALE_MAX = 2.6;

  private readonly PARTICLE_LINK_DISTANCE = 170;
  private readonly MOUSE_LINK_DISTANCE = 220;
  private readonly MOUSE_REPEL_RADIUS = 120;
  private readonly MOUSE_REPEL_STRENGTH = 0.6;

  /** Aktuální poměr aktuální_šířka / REFERENCE_WIDTH, přepočítaný při každém resize. */
  private currentScale = 1;

  override ngOnDestroy(): void {
    this.stopParticleField();
    super.ngOnDestroy();
  }

  private initParticleField(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.particleCtx = ctx;

    this.resizeParticleCanvas(canvas);
    this.seedParticles(canvas);

    this.particleResizeObserver = new ResizeObserver(() => this.resizeParticleCanvas(canvas));
    this.particleResizeObserver.observe(canvas.parentElement ?? canvas);

    // Důležité: Interakce se poslouchá na rodiči, protože canvas má pointer-events: none
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
    const canvas = this.heroParticleCanvasEl;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  private handleTouchMove = (event: TouchEvent): void => {
    const canvas = this.heroParticleCanvasEl;
    const touch = event.touches[0];
    if (!canvas || !touch) return;
    const rect = canvas.getBoundingClientRect();
    this.mouse = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  private handlePointerLeave = (): void => {
    this.mouse = null;
  };

  /** Ořízne hodnotu do zadaného rozsahu [min, max]. */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private resizeParticleCanvas(canvas: HTMLCanvasElement): void {
    const parent = canvas.parentElement;
    let width = parent?.clientWidth ?? canvas.clientWidth;
    let height = parent?.clientHeight ?? canvas.clientHeight;

    if (width === 0 || height === 0) {
      const rect = canvas.getBoundingClientRect();
      const parentRect = parent?.getBoundingClientRect();
      width = rect.width || parentRect?.width || window.innerWidth;
      height = rect.height || parentRect?.height || 500;
    }

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    this.particleCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Přepočet měřítka pro spojnice/interakci dle aktuální (logické, CSS) šířky plátna.
    this.currentScale = this.clamp(width / this.REFERENCE_WIDTH, this.SCALE_MIN, this.SCALE_MAX);

    if (this.particles.length === 0 && width > 0 && height > 0) {
      this.seedParticles(canvas);
    }
  }

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

  private renderParticleFrame = (canvas: HTMLCanvasElement): void => {
    const ctx = this.particleCtx;
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Vzdálenosti přepočtené na aktuální velikost plátna - viz komentář u currentScale výše.
    const linkDistance = this.PARTICLE_LINK_DISTANCE * this.currentScale;
    const mouseLinkDistance = this.MOUSE_LINK_DISTANCE * this.currentScale;
    const mouseRepelRadius = this.MOUSE_REPEL_RADIUS * this.currentScale;

    ctx.clearRect(0, 0, width, height);

    for (const particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (this.mouse) {
        const dx = particle.x - this.mouse.x;
        const dy = particle.y - this.mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouseRepelRadius && distance > 0.01) {
          const force = (1 - distance / mouseRepelRadius) * this.MOUSE_REPEL_STRENGTH;
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

        if (distance < linkDistance) {
          const opacity = (1 - distance / linkDistance) * 0.4;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${this.PARTICLE_COLOR}, ${opacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    if (this.mouse) {
      for (const particle of this.particles) {
        const dx = particle.x - this.mouse.x;
        const dy = particle.y - this.mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouseLinkDistance) {
          const opacity = (1 - distance / mouseLinkDistance) * 0.55;
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
    this.hasInitialized = false;
  }

  // Ostatní metody beze změny
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