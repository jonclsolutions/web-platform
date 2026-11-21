/**
 * @file creator-settings.component.spec.ts
 * @path src/app/apps/js-creator/admin/settings/creator-settings.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of CreatorSettingsComponent: loads the default quota and the accounts,
 *   validates and saves the default quota, sets / resets the quota of an account, read-only
 *   without the update permission.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CreatorSettingsComponent } from './creator-settings.component';
import { QuotaAccount } from '../shared/js-creator.models';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

/**
 * @description Row of the overview.
 * @param id Account.
 * @param quotaMb Individual quota.
 */
function account(id: number, quotaMb: number | null = null): QuotaAccount {
  return { id, name: `User ${id}`, has_access: id !== 3, used_bytes: 900 * 1024 * 1024, quota_mb: quotaMb, quota_bytes: (quotaMb ?? 1024) * 1024 * 1024, counts: { folders: 2, images: 5, fonts: 1 } };
}

describe('CreatorSettingsComponent', () => {
  let fixture: ComponentFixture<CreatorSettingsComponent>;
  let component: CreatorSettingsComponent;
  let ctx: AdminTestContext;

  /**
   * @description Creates the page.
   * @param granted Permissions.
   */
  async function create(granted: string[] | 'all' = 'all'): Promise<void> {
    ctx = createAdminTestContext({ granted });
    ctx.dataHandler.get.and.returnValue(of({ default_quota_mb: 1024 }));
    ctx.dataHandler.getCollection.and.returnValue(of([account(1), account(3, 50)]));
    ctx.dataHandler.put.and.callFake(((url: string, body: { quota_mb?: number | null; default_quota_mb?: number }) =>
      of(url === 'js-creator/settings' ? { default_quota_mb: body.default_quota_mb } : account(1, body.quota_mb ?? null))) as never);
    await TestBed.configureTestingModule({ imports: [CreatorSettingsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(CreatorSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description The overview shows the numbers, the level of the usage and accounts without
   *   access.
   * @input accounts 1 (900 MB of 1 GB) and 3 (no access, 50 MB quota)
   * @output 2 rows; level warning for 1, full for 3; badge no_access once
   */
  it('shows the overview of accounts', async () => {
    await create();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    expect(component.level(component.accounts[0])).toBe('warning');
    expect(component.level(component.accounts[1])).toBe('full');
    expect(fixture.nativeElement.querySelectorAll('.cs-badge').length).toBe(1);
  });

  /**
   * @description The default quota is validated (1 … 102 400) and saved.
   * @input 0, then 2048
   * @output error_quota_range without a request; PUT settings {2048}; saved
   */
  it('saves the default quota', async () => {
    await create();
    component.defaultDraft = 0;
    component.saveDefault();
    expect(component.defaultError).toBe('js-creator-settings.error_quota_range');
    expect(ctx.dataHandler.put).not.toHaveBeenCalled();
    component.defaultDraft = 2048;
    component.saveDefault();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/settings', { default_quota_mb: 2048 });
    expect(component.saved).toBeTrue();
    expect(component.defaultQuota).toBe(2048);
  });

  /**
   * @description An individual quota is set, then reset to the default; the row is replaced.
   * @input openQuota(1) → own 300; openQuota(1) → default
   * @output PUT users/1/quota {300}, then {null}; row quota_mb 300, then null
   */
  it('sets and resets the quota of an account', async () => {
    await create();
    component.openQuota(component.accounts[0]);
    component.dialog!.useDefault = false;
    component.dialog!.quotaMb = 300;
    component.submitQuota();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/settings/users/1/quota', { quota_mb: 300 });
    expect(component.accounts[0].quota_mb).toBe(300);

    component.openQuota(component.accounts[0]);
    component.dialog!.useDefault = true;
    component.submitQuota();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/settings/users/1/quota', { quota_mb: null });
    expect(component.accounts[0].quota_mb).toBeNull();
  });

  /**
   * @description Without js-creator-settings-update nothing can be changed.
   * @input permission js-creator-settings-view only
   * @output no save button, no edit buttons, disabled field
   */
  it('is read-only without the update permission', async () => {
    await create(['js-creator-settings-view']);
    expect(component.canUpdate).toBeFalse();
    expect(fixture.nativeElement.querySelector('.cs-default button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.cs-actions')).toBeNull();
  });
});
