/**
 * @file motion-presets.ts
 * @path src/app/apps/web/public/motion/motion-presets.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared motion vocabulary of the public website: easing curves, springs, the scroll
 *   smoothing spring and small math helpers. Every animation of the public web takes its timing
 *   from here, so pages move the same way (design rules: shared-styles/DESIGN.md, chapter 7).
 * @dependencies motion (cubicBezier)
 */
import { cubicBezier } from 'motion';

/** Cubic-bezier points of the entrance curve (arrivals, reveals). */
export const EASE_OUT_POINTS: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Entrance curve as a function – scroll-linked arrivals map their progress through it. */
export const easeOut = cubicBezier(0.16, 1, 0.3, 1);

/** Curve for a move between two states (pinned hero, accordion). */
export const easeInOut = cubicBezier(0.65, 0, 0.35, 1);

/** Gentler arrival for tiles that slide in row by row (the staircase stays visible longer). */
export const tileEase = cubicBezier(0.33, 1, 0.68, 1);

/** Spring of UI elements (cards, blocks): settles with a small overshoot. */
export const SPRING_UI = { type: 'spring' as const, damping: 14, stiffness: 140, mass: 0.8 };

/** Spring of large panels (the hero screen): heavier, calmer. */
export const SPRING_HEAVY = { type: 'spring' as const, damping: 18, stiffness: 180, mass: 0.8 };

/**
 * Spring that smooths raw scroll progress before it drives anything (ω ≈ 45 rad/s, ζ ≈ 1.07,
 * ~30 ms lag): wheel steps glide instead of jumping, without a heavy, delayed feel.
 */
export const SCROLL_SMOOTH = { stiffness: 500, damping: 24, mass: 0.25, restDelta: 0.0005 };

/** Masked word reveal of headings: duration and delay between words (seconds). */
export const MASK_DURATION = 0.8;
export const MASK_STAGGER = 0.09;

/** Delay between children of a group reveal (seconds). */
export const GROUP_STAGGER = 0.07;

/** Opacity-only fade used instead of movement when the visitor prefers reduced motion (seconds). */
export const REDUCED_FADE = 0.15;

/**
 * @description Clamps a number to the 0–1 range.
 * @param value Any number.
 * @returns The value limited to [0, 1].
 */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * @description Sub-range of a 0–1 progress, normalised to 0–1 again (a "window" of the scroll).
 * @param value Progress 0–1.
 * @param from Start of the window.
 * @param to End of the window (greater than `from`).
 * @returns 0 before the window, 1 after it, linear inside.
 */
export function band(value: number, from: number, to: number): number {
  return clamp01((value - from) / (to - from));
}

/**
 * @description Linear interpolation.
 * @param a Value at k = 0.
 * @param b Value at k = 1.
 * @param k Progress 0–1.
 * @returns a + (b − a) · k.
 */
export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}
