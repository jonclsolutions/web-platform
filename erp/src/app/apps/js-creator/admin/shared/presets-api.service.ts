/**
 * @file presets-api.service.ts
 * @path src/app/apps/js-creator/admin/shared/presets-api.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calls of the presets of generating of a section (`/api/js-creator/<section>/presets`)
 *   through DataHandler: the presets of a template / set, new, overwrite, delete. New / overwrite
 *   go without the global error dialog: the page explains a taken name or the limit itself.
 * @dependencies DataHandler; js-creator.models.ts; js-creator-sections.ts.
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { CreatorPreset, PresetSave } from './js-creator.models';
import { JsCreatorSectionId } from './js-creator-sections';

/** Owner of presets: a template or a set. */
export type PresetOwner = { template_id: number } | { set_id: number };

@Injectable({ providedIn: 'root' })
export class PresetsApiService {
  private readonly api = inject(DataHandler);

  /**
   * @description Base path of the presets of a section.
   * @param section Section.
   */
  private base(section: JsCreatorSectionId): string {
    return `js-creator/${section}/presets`;
  }

  /**
   * @description Presets of a template / set by name.
   * @param section Section.
   * @param owner Template or set.
   */
  list(section: JsCreatorSectionId, owner: PresetOwner): Observable<CreatorPreset[]> {
    const params = 'template_id' in owner ? `template_id=${owner.template_id}` : `set_id=${owner.set_id}`;
    return this.api.getCollection<CreatorPreset>(`${this.base(section)}?${params}`);
  }

  /** @description New preset (422 explained by the page). */
  create(section: JsCreatorSectionId, data: PresetSave): Observable<CreatorPreset> {
    return this.api.postQuietly<CreatorPreset>(this.base(section), data);
  }

  /** @description Overwrite of a preset - name and values (422 explained by the page). */
  save(section: JsCreatorSectionId, id: number, data: PresetSave): Observable<CreatorPreset> {
    return this.api.putQuietly<CreatorPreset>(`${this.base(section)}/${id}`, { name: data.name, values: data.values });
  }

  /** @description Deletes a preset (for good). */
  delete(section: JsCreatorSectionId, id: number): Observable<void> {
    return this.api.delete(`${this.base(section)}/${id}`);
  }
}
