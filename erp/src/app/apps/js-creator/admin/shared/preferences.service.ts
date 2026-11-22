/**
 * @file preferences.service.ts
 * @path src/app/apps/js-creator/admin/shared/preferences.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Personal settings of the account in JS Creator (`/api/js-creator/preferences`):
 *   brand colours offered by every colour picker of the editor and hashtag sets inserted into
 *   the text of the post. Loaded once and kept in a signal for the whole admin; every change
 *   saves the whole settings (the API checks them strictly) and keeps the old state when the
 *   save fails.
 * @dependencies DataHandler; js-creator.models.ts.
 */

import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { CreatorPreferences, HashtagSet } from './js-creator.models';

/** Most brand colours (as the API). */
export const MAX_BRAND_COLORS = 16;
/** Most hashtag sets (as the API). */
export const MAX_HASHTAG_SETS = 30;
/** Longest text of a hashtag set (as the API). */
export const MAX_HASHTAGS = 500;

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly api = inject(DataHandler);

  /** Settings of the account (empty until loaded). */
  readonly preferences = signal<CreatorPreferences>({ colors: [], hashtag_sets: [] });
  /** The settings were loaded. */
  private loaded: Promise<void> | null = null;

  /** @description Loads the settings once (later calls wait for the same load). */
  load(): Promise<void> {
    this.loaded ??= firstValueFrom(this.api.get<CreatorPreferences>('js-creator/preferences'))
      .then(value => this.preferences.set({ colors: value?.colors ?? [], hashtag_sets: value?.hashtag_sets ?? [] }))
      .catch(() => {
        this.loaded = null;
      });
    return this.loaded;
  }

  /**
   * @description Adds a brand colour (lower case, no repeats, at most MAX_BRAND_COLORS).
   * @param color `#rrggbb`.
   * @returns Whether it was saved.
   */
  addColor(color: string): Promise<boolean> {
    const value = color.toLowerCase();
    const colors = this.preferences().colors;
    if (!/^#[0-9a-f]{6}$/.test(value) || colors.includes(value) || colors.length >= MAX_BRAND_COLORS) return Promise.resolve(false);
    return this.save({ ...this.preferences(), colors: [...colors, value] });
  }

  /**
   * @description Removes a brand colour.
   * @param color `#rrggbb`.
   */
  removeColor(color: string): Promise<boolean> {
    return this.save({ ...this.preferences(), colors: this.preferences().colors.filter(c => c !== color) });
  }

  /**
   * @description Saves the hashtag sets (all of them).
   * @param sets Sets in their order.
   */
  saveHashtagSets(sets: HashtagSet[]): Promise<boolean> {
    return this.save({ ...this.preferences(), hashtag_sets: sets });
  }

  /**
   * @description Saves the whole settings; the signal changes only after the API accepted them.
   * @param value New settings.
   */
  private async save(value: CreatorPreferences): Promise<boolean> {
    try {
      const saved = await firstValueFrom(this.api.putQuietly<CreatorPreferences>('js-creator/preferences', value));
      this.preferences.set({ colors: saved?.colors ?? value.colors, hashtag_sets: saved?.hashtag_sets ?? value.hashtag_sets });
      return true;
    } catch {
      return false;
    }
  }
}
