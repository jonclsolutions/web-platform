/**
 * @file js-creator-api.service.ts
 * @path src/app/apps/js-creator/admin/shared/js-creator-api.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calls of the JS Creator API (`/api/js-creator/…`) through DataHandler (envelope,
 *   auth headers, the one error dialog). Every list and change concerns the OWN workspace of the
 *   signed-in account - the API never returns another workspace.
 * @dependencies DataHandler; js-creator.models.ts.
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { ApiPage } from '../../../../shared/interfaces/api-envelope';
import {
  CreatorAsset, CreatorFolder, CreatorFont, CreatorSettings, FontFaceFields, QuotaAccount, WorkspaceUsage,
} from './js-creator.models';

/** Query of the list of library images. */
export interface AssetQuery {
  page: number;
  search?: string;
  trashed?: boolean;
}

@Injectable({ providedIn: 'root' })
export class JsCreatorApiService {
  private readonly api = inject(DataHandler);

  /** @description Usage of the own workspace. */
  usage(): Observable<WorkspaceUsage> {
    return this.api.get<WorkspaceUsage>('js-creator/usage');
  }

  /**
   * @description Own folders (all), or the items of the folder trash.
   * @param trashed true = the trash.
   */
  folders(trashed = false): Observable<CreatorFolder[]> {
    return this.api.getCollection<CreatorFolder>('js-creator/folders', trashed ? { only_trashed: 1 } : undefined);
  }

  /**
   * @description New folder.
   * @param name Name.
   * @param parentId Parent (null = top level).
   */
  createFolder(name: string, parentId: number | null): Observable<CreatorFolder> {
    return this.api.post<CreatorFolder>('js-creator/folders', { name, parent_id: parentId });
  }

  /**
   * @description Rename and / or move a folder.
   * @param id Folder.
   * @param changes `name` and / or `parent_id` (null = top level).
   */
  updateFolder(id: number, changes: { name?: string; parent_id?: number | null }): Observable<CreatorFolder> {
    return this.api.put<CreatorFolder>(`js-creator/folders/${id}`, changes);
  }

  /**
   * @description Folder to the trash (with its subtree), or `force` = an item of the trash for good.
   * @param id Folder.
   * @param force Delete for good.
   */
  deleteFolder(id: number, force = false): Observable<void> {
    return this.api.delete(`js-creator/folders/${id}${force ? '?force=1' : ''}`);
  }

  /** @description Restore an item of the folder trash. */
  restoreFolder(id: number): Observable<CreatorFolder> {
    return this.api.post<CreatorFolder>(`js-creator/folders/${id}/restore`, {});
  }

  /** @description Empty the folder trash. */
  emptyFolderTrash(): Observable<void> {
    return this.api.delete('js-creator/folders/trash');
  }

  /**
   * @description Page of the own library images.
   * @param query Page, search, trash.
   */
  assets(query: AssetQuery): Observable<ApiPage<CreatorAsset>> {
    const params = new URLSearchParams({ page: String(query.page) });
    if (query.search) params.set('search', query.search);
    if (query.trashed) params.set('only_trashed', '1');
    return this.api.getPaginatedCollection<CreatorAsset>(`js-creator/library/assets?${params.toString()}`);
  }

  /**
   * @description Upload one image to the library (one file per request - the request limit of
   *   the server is 25 MB).
   * @param file Image.
   * @returns The new image.
   */
  uploadAsset(file: File): Observable<CreatorAsset[]> {
    const data = new FormData();
    data.append('files[]', file, file.name);
    return this.api.upload<CreatorAsset[]>('js-creator/library/assets', data);
  }

  /** @description Rename an image. */
  renameAsset(id: number, name: string): Observable<CreatorAsset> {
    return this.api.put<CreatorAsset>(`js-creator/library/assets/${id}`, { name });
  }

  /** @description Image to the trash, or `force` = an image of the trash for good. */
  deleteAsset(id: number, force = false): Observable<void> {
    return this.api.delete(`js-creator/library/assets/${id}${force ? '?force=1' : ''}`);
  }

  /** @description Restore an image of the trash. */
  restoreAsset(id: number): Observable<CreatorAsset> {
    return this.api.post<CreatorAsset>(`js-creator/library/assets/${id}/restore`, {});
  }

  /** @description Empty the image trash. */
  emptyAssetTrash(): Observable<void> {
    return this.api.delete('js-creator/library/assets/trash');
  }

  /** @description Own fonts, or the font trash. */
  fonts(trashed = false): Observable<CreatorFont[]> {
    return this.api.getCollection<CreatorFont>('js-creator/library/fonts', trashed ? { only_trashed: 1 } : undefined);
  }

  /**
   * @description Upload one font face.
   * @param file Font file.
   * @param face Family, weight, style.
   */
  uploadFont(file: File, face: FontFaceFields): Observable<CreatorFont> {
    const data = new FormData();
    data.append('file', file, file.name);
    data.append('family', face.family);
    data.append('weight', String(face.weight));
    data.append('style', face.style);
    return this.api.upload<CreatorFont>('js-creator/library/fonts', data);
  }

  /** @description Change the face of a font. */
  updateFont(id: number, face: FontFaceFields): Observable<CreatorFont> {
    return this.api.put<CreatorFont>(`js-creator/library/fonts/${id}`, face);
  }

  /** @description Font to the trash, or `force` = a font of the trash for good. */
  deleteFont(id: number, force = false): Observable<void> {
    return this.api.delete(`js-creator/library/fonts/${id}${force ? '?force=1' : ''}`);
  }

  /** @description Restore a font of the trash. */
  restoreFont(id: number): Observable<CreatorFont> {
    return this.api.post<CreatorFont>(`js-creator/library/fonts/${id}/restore`, {});
  }

  /** @description Empty the font trash. */
  emptyFontTrash(): Observable<void> {
    return this.api.delete('js-creator/library/fonts/trash');
  }

  /** @description Settings of the application. */
  settings(): Observable<CreatorSettings> {
    return this.api.get<CreatorSettings>('js-creator/settings');
  }

  /** @description Change the default quota. */
  updateSettings(settings: CreatorSettings): Observable<CreatorSettings> {
    return this.api.put<CreatorSettings>('js-creator/settings', settings);
  }

  /** @description Overview of the accounts (numbers only). */
  quotaAccounts(): Observable<QuotaAccount[]> {
    return this.api.getCollection<QuotaAccount>('js-creator/settings/users');
  }

  /**
   * @description Individual quota of an account.
   * @param userId Account.
   * @param quotaMb MB, or null = the default quota.
   */
  updateQuota(userId: number, quotaMb: number | null): Observable<QuotaAccount> {
    return this.api.put<QuotaAccount>(`js-creator/settings/users/${userId}/quota`, { quota_mb: quotaMb });
  }
}
