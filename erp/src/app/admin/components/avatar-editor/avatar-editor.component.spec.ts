/**
 * @file avatar-editor.component.spec.ts
 * @path src/app/admin/components/avatar-editor/avatar-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AvatarEditorComponent: browser check of the picked file, upload and
 *   removal through the API, the own photo in the header, the read-only mode and errors.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler / AuthService / i18n / alert stubs);
 *   CurrentUserProfileService spy.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AvatarEditorComponent, AVATAR_MAX_BYTES } from './avatar-editor.component';
import { CurrentUserProfileService } from '../../../core/services/current-user-profile.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('AvatarEditorComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<AvatarEditorComponent>;
  let component: AvatarEditorComponent;
  let profile: jasmine.SpyObj<CurrentUserProfileService>;
  let el: HTMLElement;

  /** @description Simulates picking a file in the hidden input. */
  const pick = (file: File): void => {
    const input = el.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    profile = jasmine.createSpyObj<CurrentUserProfileService>('CurrentUserProfileService', ['invalidate']);
    await TestBed.configureTestingModule({
      imports: [AvatarEditorComponent],
      providers: [...ctx.providers, { provide: CurrentUserProfileService, useValue: profile }],
    }).compileComponents();
    fixture = TestBed.createComponent(AvatarEditorComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.componentRef.setInput('userId', 7);
    fixture.detectChanges();
  });

  /**
   * @description A wrong type or a too large file is refused in the browser - nothing is sent.
   * @input  a PDF; a JPG of 2 MB + 1 byte.
   * @output alert 'warning' twice (type, size), no upload.
   */
  it('refuses a wrong file before the upload', () => {
    pick(new File(['x'], 'cv.pdf', { type: 'application/pdf' }));
    pick(new File([new Uint8Array(AVATAR_MAX_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' }));
    expect(ctx.alert.open).toHaveBeenCalledWith('avatar-editor.error_title', 'avatar-editor.error_type', 'warning');
    expect(ctx.alert.open).toHaveBeenCalledWith('avatar-editor.error_title', 'avatar-editor.error_size', 'warning');
    expect(ctx.dataHandler.upload).not.toHaveBeenCalled();
  });

  /**
   * @description A valid photo of another account is uploaded as `avatar` and shown; the header is
   *   not touched; "Remove" deletes it again.
   * @input  userId 7 (signed in: 1); PNG; upload answers a URL; remove answers null.
   * @output upload('core/users/7/avatar', FormData with avatar); avatarChange URL; img shown;
   *   setAvatarUrl not called; delete('core/users/7/avatar'); avatarChange null; remove button gone.
   */
  it('uploads and removes the photo of an account', () => {
    const changes: (string | null)[] = [];
    component.avatarChange.subscribe(url => changes.push(url));
    (ctx.dataHandler.upload as jasmine.Spy).and.returnValue(of({ avatar_url: '/photo.webp' }));
    pick(new File(['png'], 'me.png', { type: 'image/png' }));

    const [url, body] = (ctx.dataHandler.upload as jasmine.Spy).calls.mostRecent().args;
    expect(url).toBe('core/users/7/avatar');
    expect((body as FormData).get('avatar')).toEqual(jasmine.any(File));
    expect(changes).toEqual(['/photo.webp']);
    expect((el.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('/photo.webp');
    expect(ctx.auth.setAvatarUrl).not.toHaveBeenCalled();

    (ctx.dataHandler.delete as jasmine.Spy).and.returnValue(of({ avatar_url: null }));
    (el.querySelector('.avatar-editor-btn--danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('core/users/7/avatar');
    expect(changes).toEqual(['/photo.webp', null]);
    expect(el.querySelector('.avatar-editor-btn--danger')).toBeNull();
  });

  /**
   * @description The own photo goes to the header at once and drops the cached own profile.
   * @input  userId '1' (= signed-in account); upload answers a URL.
   * @output setAvatarUrl('/me.webp'), profile.invalidate().
   */
  it('updates the header for the own photo', () => {
    fixture.componentRef.setInput('userId', '1');
    (ctx.dataHandler.upload as jasmine.Spy).and.returnValue(of({ avatar_url: '/me.webp' }));
    pick(new File(['jpg'], 'me.jpg', { type: 'image/jpeg' }));
    expect(ctx.auth.setAvatarUrl).toHaveBeenCalledWith('/me.webp');
    expect(profile.invalidate).toHaveBeenCalled();
  });

  /**
   * @description A failed upload keeps the old photo and unlocks the controls (the DataHandler
   *   shows the error itself).
   * @input  avatarUrl '/old.webp'; upload errors.
   * @output busy false, avatarUrl '/old.webp', no avatarChange.
   */
  it('keeps the photo after a failed upload', () => {
    fixture.componentRef.setInput('avatarUrl', '/old.webp');
    const emit = spyOn(component.avatarChange, 'emit');
    (ctx.dataHandler.upload as jasmine.Spy).and.returnValue(throwError(() => ({ status: 422 })));
    pick(new File(['jpg'], 'me.jpg', { type: 'image/jpeg' }));
    expect(component.busy).toBeFalse();
    expect(component.avatarUrl).toBe('/old.webp');
    expect(emit).not.toHaveBeenCalled();
  });

  /**
   * @description Read-only: only the photo, no controls; pickFile() / remove() do nothing.
   * @input  editable false, avatarUrl set; pickFile(); remove().
   * @output no button / input; no API call.
   */
  it('shows only the photo when not editable', () => {
    fixture.componentRef.setInput('editable', false);
    fixture.componentRef.setInput('avatarUrl', '/x.webp');
    fixture.detectChanges();
    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('input')).toBeNull();
    component.pickFile();
    component.remove();
    expect(ctx.dataHandler.delete).not.toHaveBeenCalled();
  });

  /**
   * @description The circle opens the file picker; an empty pick does nothing.
   * @input  click the circle; change event without a file.
   * @output input.click() called; no upload.
   */
  it('opens the file picker from the circle', () => {
    const input = el.querySelector('input[type="file"]') as HTMLInputElement;
    const click = spyOn(input, 'click');
    (el.querySelector('.avatar-editor-circle') as HTMLButtonElement).click();
    expect(click).toHaveBeenCalled();
    Object.defineProperty(input, 'files', { value: [], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(ctx.dataHandler.upload).not.toHaveBeenCalled();
  });
});
