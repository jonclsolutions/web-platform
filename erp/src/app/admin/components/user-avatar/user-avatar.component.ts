/**
 * @file user-avatar.component.ts
 * @path src/app/admin/components/user-avatar/user-avatar.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Round profile photo of an admin account - the photo of its signed URL, or the
 * default image (grey circle with a white silhouette) when the account has none or the photo
 * cannot be loaded (e.g. an expired signed URL of a page left open for days).
 * @usage `<app-user-avatar [src]="user.avatar_url" [size]="32" [label]="user.full_name">`
 * @dependencies none
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  templateUrl: './user-avatar.component.html',
  styleUrl: './user-avatar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAvatarComponent implements OnChanges {
  /** Signed URL of the photo; null / '' = the default image. */
  @Input() src: string | null | undefined = null;
  /** Edge of the circle in px. */
  @Input() size = 32;
  /** Accessible name (e.g. the full name); '' = decorative (hidden from screen readers). */
  @Input() label = '';

  /** The photo failed to load - the default image is shown instead. */
  failed = false;

  private readonly cd = inject(ChangeDetectorRef);

  /** @description A new URL gets a new chance to load. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src']) this.failed = false;
  }

  /** @description Falls back to the default image. */
  onError(): void {
    this.failed = true;
    this.cd.markForCheck();
  }
}
