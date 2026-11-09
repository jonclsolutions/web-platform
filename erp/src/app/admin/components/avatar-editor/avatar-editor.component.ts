/**
 * @file avatar-editor.component.ts
 * @path src/app/admin/components/avatar-editor/avatar-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Profile photo of an admin account with its controls: a click on the circle (or
 * the "Change photo" pictogram) picks a JPG / PNG / WebP file that is uploaded at once, "Remove photo" returns
 * the default image. The file is checked in the browser first (type, at most 2 MB - the same
 * limits as UserAvatarController), the server crops it to a square, scales it to 256×256 px and
 * stores it as WebP without metadata. The change is saved on its own - it is not part of a
 * surrounding form and needs no "Save".
 * @note A change of the OWN photo is shown in the admin header at once (AuthService) and the
 * cached own profile is dropped (CurrentUserProfileService).
 * @usage `<app-avatar-editor [userId]="user.id" [avatarUrl]="user.avatar_url" [editable]="true"
 *   (avatarChange)="user.avatar_url = $event">`
 * @dependencies
 * - DataHandler: POST / DELETE core/users/{id}/avatar (shows the error toast itself).
 * - AuthService, CurrentUserProfileService: own photo.
 * - AdminLocalizationService: section `avatar-editor`.
 * - AlertDialogService: warning about a refused file.
 * - IconComponent: pictograms of the buttons.
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, EventEmitter, Input, Output,
  ViewChild, inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentUserProfileService } from '../../../core/services/current-user-profile.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/** @description Accepted types (UserAvatarController: mimes jpg, jpeg, png, webp). */
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** @description Largest accepted file (UserAvatarController: max 2048 kB). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-avatar-editor',
  standalone: true,
  imports: [UserAvatarComponent, IconComponent],
  templateUrl: './avatar-editor.component.html',
  styleUrl: './avatar-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarEditorComponent {
  /** Account of the photo. */
  @Input({ required: true }) userId!: number | string;
  /** Current signed URL of the photo (null = the default image). */
  @Input() avatarUrl: string | null = null;
  /** Shows the controls; false = only the photo. */
  @Input() editable = true;
  /** Edge of the circle in px. */
  @Input() size = 96;
  /** Accessible name of the photo (e.g. the full name). */
  @Input() label = '';

  /** New URL after an upload, null after the removal. */
  @Output() avatarChange = new EventEmitter<string | null>();

  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  /** An upload / removal is running. */
  busy = false;

  readonly accept = AVATAR_MIME_TYPES.join(',');

  private readonly dataHandler = inject(DataHandler);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(CurrentUserProfileService);
  private readonly alertDialog = inject(AlertDialogService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  public readonly i18n = inject(AdminLocalizationService);

  /** @description Texts of the section `avatar-editor`. */
  get strings(): any {
    return this.i18n.getMergedSection('avatar-editor');
  }

  /** @description Opens the file picker. */
  pickFile(): void {
    if (this.editable && !this.busy) this.fileInput?.nativeElement.click();
  }

  /**
   * @description Checks the picked file and uploads it.
   * @param event `change` of the file input.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';   // the same file can be picked again after an error
    if (!file) return;

    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      this.alertDialog.open(this.strings.error_title, this.strings.error_type, 'warning');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      this.alertDialog.open(this.strings.error_title, this.strings.error_size, 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file, file.name);
    this.run(this.dataHandler.upload<{ avatar_url: string | null }>(this.endpoint, formData));
  }

  /** @description Removes the photo. */
  remove(): void {
    if (!this.editable || this.busy || !this.avatarUrl) return;
    this.run(this.dataHandler.delete<{ avatar_url: null }>(this.endpoint));
  }

  /** @description `core/users/{id}/avatar`. */
  private get endpoint(): string {
    return `core/users/${encodeURIComponent(String(this.userId))}/avatar`;
  }

  /**
   * @description Runs an upload / removal and publishes the new URL (errors: the DataHandler toast).
   * @param request$ The API call.
   */
  private run(request$: Observable<{ avatar_url: string | null } | null>): void {
    this.busy = true;
    this.cd.markForCheck();
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.busy = false;
        this.avatarUrl = data?.avatar_url ?? null;
        if (String(this.userId) === this.authService.getUserId()) {
          this.authService.setAvatarUrl(this.avatarUrl);
          this.profileService.invalidate();
        }
        this.avatarChange.emit(this.avatarUrl);
        this.cd.markForCheck();
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }
}
