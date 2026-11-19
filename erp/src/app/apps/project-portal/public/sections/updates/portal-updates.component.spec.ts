/**
 * @file portal-updates.component.spec.ts
 * @path src/app/apps/project-portal/public/sections/updates/portal-updates.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalUpdatesComponent: the updates load when the section opens and
 *   after a refresh of the header; empty text.
 * @dependencies ../../portal.testing (stubs, sample data); fakeAsync for timers.
 */

import { TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { of } from 'rxjs';
import { setUpPortal } from '../../portal.testing';
import { PortalUpdatesComponent } from './portal-updates.component';

describe('PortalUpdatesComponent', () => {
  /**
   * @description Updates are loaded on open and on refresh, rendered with their files.
   * @input updates section; refreshed$; no updates.
   * @output get('…/updates'); 1 card 'Week 2' with its file; requested again; 'updates_empty'.
   */
  it('shows the updates of the supplier', fakeAsync(() => {
    const ctx = setUpPortal({ imports: [PortalUpdatesComponent] });
    ctx.replies['/tok/updates'] = () => of([{ id: 2, title: 'Week 2', body: 'Design done', author_label: 'Petr', published_at: '2026-11-11 09:00:00',
      attachments: [{ id: 1, original_filename: 'plan.pdf', mime_type: null, size_bytes: 2 * 1024 * 1024, download_url: 'https://x/a/1', view_url: null }] }]);
    const fixture = TestBed.createComponent(PortalUpdatesComponent);
    fixture.detectChanges();
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/updates');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-update').length).toBe(1);
    expect(el.querySelector('.pp-update')!.textContent).toContain('Week 2');
    expect(el.querySelector('.pp-attachment-size')!.textContent).toContain('2.0 MB');

    ctx.get.calls.reset();
    ctx.replies['/tok/updates'] = () => of([]);
    ctx.session.refreshed$.next();
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/updates');
    fixture.detectChanges();
    expect(el.textContent).toContain('updates_empty');
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
