/**
 * @file retention-settings.component.spec.ts
 * @path src/app/admin/core-pages/web-settings/retention-settings/retention-settings.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of RetentionSettingsComponent ("Data retention" tab, VT-10): loading and
 *   its error / retry, the period options and labels, read-only mode without the update
 *   permission, saving the periods and the confirmed immediate clean-up.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, i18n / permission stubs, alert / confirm spies).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { RETENTION_OPTIONS, RetentionSetting, RetentionSettingsComponent } from './retention-settings.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('RetentionSettingsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<RetentionSettingsComponent>;
  let component: RetentionSettingsComponent;

  const rows: RetentionSetting[] = [
    { data_key: 'job_applications', retention_days: 180, last_run_at: '2026-11-04T03:45:00Z', last_deleted_count: 2 },
    { data_key: 'sales_orders', retention_days: null, last_run_at: null, last_deleted_count: null },
    { data_key: 'raw_requests', retention_days: 400, last_run_at: null, last_deleted_count: null },
  ];
  const dh = () => ctx.dataHandler as any;

  /** Creates the component with the granted permissions; `answer` is the GET answer. */
  function create(granted: string[] | 'all' = 'all', answer: any = of(rows)): void {
    ctx = createAdminTestContext({ granted });
    dh().get.and.returnValue(answer);
    TestBed.configureTestingModule({ imports: [RetentionSettingsComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(RetentionSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description Loads the settings (a copy - edits never touch the answer), renders a row per
   *   kind with its last run, a select with the standard periods (plus a custom API value) and
   *   translated labels.
   * @input GET rows (180, off, custom 400).
   * @output get('core/retention_settings'); 3 rows, 3 selects; last run text; options: standard
   *   list, 400 added in order; labels 'option_off' / 'option_180' / '{n}' days.
   */
  it('loads and renders the settings', () => {
    create();
    expect(dh().get).toHaveBeenCalledWith('core/retention_settings');
    expect(component.settings).toEqual(rows);
    expect(component.settings[0]).not.toBe(rows[0]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.rs-row').length).toBe(3);
    expect(el.querySelectorAll('select.rs-select').length).toBe(3);
    expect(el.querySelector('.rs-row-last')!.textContent).toContain('retention-settings.last_run');
    expect(el.querySelector('.rs-actions')).not.toBeNull();

    expect(component.optionsFor(rows[0])).toBe(RETENTION_OPTIONS);
    expect(component.optionsFor(rows[2])).toEqual([null, 30, 90, 180, 365, 400, 730, 1095, 1825, 3650]);
    ctx.i18n.getValue.and.callFake((p: string) => (p === 'retention-settings.option_days' ? '{n} days' : p));
    expect(component.periodLabel(null)).toBe('retention-settings.option_off');
    expect(component.periodLabel(180)).toBe('retention-settings.option_180');
    expect(component.periodLabel(400)).toBe('400 days');
  });

  /**
   * @description Without the update permission the periods are read-only and nothing can be
   *   saved or run; a failed load shows the error with a retry; an empty answer gives no rows.
   * @input Granted only the view permission; GET fails, then retry with null.
   * @output No select / actions, '.rs-readonly' ×3; save / purgeNow do nothing; error then retry
   *   → get twice, settings [].
   */
  it('is read-only without the update permission and handles a failed load', async () => {
    create(['core-legal-config-view']);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('select')).toBeNull();
    expect(el.querySelector('.rs-actions')).toBeNull();
    expect(el.querySelectorAll('.rs-readonly').length).toBe(3);
    component.save();
    await component.purgeNow();
    expect(dh().put).not.toHaveBeenCalled();
    expect(dh().post).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    create('all', throwError(() => new Error('x')));
    expect(component.loadError).toBeTrue();
    expect(fixture.nativeElement.querySelector('.rs-error')).not.toBeNull();
    dh().get.and.returnValue(of(null));
    (fixture.nativeElement.querySelector('.rs-error button') as HTMLButtonElement).click();
    expect(dh().get).toHaveBeenCalledTimes(2);
    expect(component.settings).toEqual([]);
    expect(component.loadError).toBeFalse();
  });

  /**
   * @description Save sends every period, takes the answer and confirms; a second save while
   *   saving is ignored; a failure resets the flag.
   * @input job_applications → 365; save (answer echoes); save while saving; save failing.
   * @output put('core/retention_settings', { settings: [...] }) once; alert saved; saving false.
   */
  it('saves the periods', () => {
    create();
    component.settings[0].retention_days = 365;
    dh().put.and.returnValue(of([{ ...rows[0], retention_days: 365 }]));
    component.save();
    expect(dh().put).toHaveBeenCalledWith('core/retention_settings', { settings: [
      { data_key: 'job_applications', retention_days: 365 },
      { data_key: 'sales_orders', retention_days: null },
      { data_key: 'raw_requests', retention_days: 400 },
    ] });
    expect(component.settings).toEqual([{ ...rows[0], retention_days: 365 }]);
    expect(ctx.alert.open).toHaveBeenCalledWith('retention-settings.saved_title', 'retention-settings.saved_message', 'success');

    component.saving = true;
    component.save();
    expect(dh().put).toHaveBeenCalledTimes(1);
    component.saving = false;
    dh().put.and.returnValue(throwError(() => new Error('x')));
    component.save();
    expect(component.saving).toBeFalse();
  });

  /**
   * @description "Run now" asks first; on confirm it posts, shows the total deleted count and
   *   takes the new settings; cancelled / busy does nothing; a failure resets the flag.
   * @input confirm false; confirm true with deleted {a: 2, b: null, c: 3}; busy; failure; answer null.
   * @output no post; post('core/retention_settings/purge', {}); alert count 5; settings replaced;
   *   purging false; with null answer count 0 and the old settings kept.
   */
  it('runs the clean-up after a confirmation', async () => {
    create();
    ctx.i18n.getValue.and.callFake((p: string) => (p === 'retention-settings.purge_done_message' ? '{count} deleted' : p));
    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    await component.purgeNow();
    expect(dh().post).not.toHaveBeenCalled();

    ctx.confirm.open.and.returnValue(Promise.resolve(true));
    dh().post.and.returnValue(of({ deleted: { a: 2, b: null, c: 3 }, settings: [rows[1]] }));
    await component.purgeNow();
    expect(ctx.confirm.open).toHaveBeenCalledWith('retention-settings.purge_confirm_title', 'retention-settings.purge_confirm_message');
    expect(dh().post).toHaveBeenCalledWith('core/retention_settings/purge', {});
    expect(ctx.alert.open).toHaveBeenCalledWith('retention-settings.purge_done_title', '5 deleted', 'success');
    expect(component.settings).toEqual([rows[1]]);
    expect(component.purging).toBeFalse();

    component.purging = true;
    await component.purgeNow();
    expect(dh().post).toHaveBeenCalledTimes(1);
    component.purging = false;

    dh().post.and.returnValue(throwError(() => new Error('x')));
    await component.purgeNow();
    expect(component.purging).toBeFalse();

    dh().post.and.returnValue(of(null));
    await component.purgeNow();
    expect(ctx.alert.open).toHaveBeenCalledWith('retention-settings.purge_done_title', '0 deleted', 'success');
    expect(component.settings).toEqual([rows[1]]);
  });
});
