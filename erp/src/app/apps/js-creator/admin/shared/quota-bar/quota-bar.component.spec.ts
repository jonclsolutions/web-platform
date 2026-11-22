/**
 * @file quota-bar.component.spec.ts
 * @path src/app/apps/js-creator/admin/shared/quota-bar/quota-bar.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of QuotaBarComponent: loads the usage, shows used / allowed with the
 *   percent, warns from 80 %, reports a full workspace and the size of the trash.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles).
 */

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { QuotaBarComponent } from './quota-bar.component';
import { createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

describe('QuotaBarComponent', () => {
  /**
   * @description Renders the usage with its level.
   * @param used Used bytes.
   * @param trash Bytes in the trash.
   */
  async function render(used: number, trash = 0): Promise<HTMLElement> {
    const ctx = createAdminTestContext();
    ctx.dataHandler.get.and.returnValue(of({ used_bytes: used, quota_bytes: 1024 * 1024, trash_bytes: trash, counts: { folders: 0, images: 0, fonts: 0, templates: 0 } }));
    await TestBed.configureTestingModule({ imports: [QuotaBarComponent], providers: ctx.providers }).compileComponents();
    const fixture = TestBed.createComponent(QuotaBarComponent);
    fixture.detectChanges();
    expect(ctx.dataHandler.get).toHaveBeenCalledWith('js-creator/usage');
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * @description 25 % of 1 MB is ok, without notes.
   * @input used 256 kB of 1 MB
   * @output class qb--ok, "256 kB … 1 MB (25 %)", no note
   */
  it('shows the usage', async () => {
    const el = await render(256 * 1024);
    expect(el.querySelector('.qb--ok')).not.toBeNull();
    expect(el.querySelector('.qb-value')!.textContent).toContain('(25 %)');
    expect(el.querySelector('.qb-note')).toBeNull();
  });

  /**
   * @description From 80 % a warning, at 100 % the note of a full workspace; the trash size.
   * @input 85 % with 10 kB in the trash; then 100 %
   * @output qb--warning + quota_warning + quota_trash; qb--full + quota_full
   */
  it('warns and reports a full workspace', async () => {
    let el = await render(0.85 * 1024 * 1024, 10 * 1024);
    expect(el.querySelector('.qb--warning .qb-note')!.textContent).toContain('js-creator-shared.quota_warning');
    expect(el.querySelector('.qb-trash')!.textContent).toContain('10 kB');
    TestBed.resetTestingModule();
    el = await render(1024 * 1024);
    expect(el.querySelector('.qb--full .qb-note')!.textContent).toContain('js-creator-shared.quota_full');
  });
});
