/**
 * @file portal-settings.component.spec.ts
 * @path src/app/apps/project-portal/admin/portal-settings/portal-settings.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalSettingsComponent: texts of its section, the editor of the
 *   browser titles bound to the area of the portal, and the leave warning with unsaved titles.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortalSettingsComponent } from './portal-settings.component';
import { PageTitlesEditorComponent } from '../../../../admin/components/page-titles-editor/page-titles-editor.component';
import { createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('PortalSettingsComponent', () => {
  let fixture: ComponentFixture<PortalSettingsComponent>;
  let component: PortalSettingsComponent;

  beforeEach(async () => {
    const ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [PortalSettingsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(PortalSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description The page shows its header and the title editor of the area project-portal.
   * @input  rendered page
   * @output header 'project-portal-settings.header'; editor area 'project-portal', endpoint
   *   'project-portal/page-titles', update permission, label section of the page
   */
  it('edits the browser titles of the public pages of the portal', () => {
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('project-portal-settings.header');
    const editor = fixture.debugElement.query(d => d.componentInstance instanceof PageTitlesEditorComponent).componentInstance as PageTitlesEditorComponent;
    expect([editor.area, editor.endpoint, editor.updatePermission, editor.labelSection])
      .toEqual(['project-portal', 'project-portal/page-titles', 'project-portal-settings-update', 'project-portal-settings']);
  });

  /**
   * @description Leaving the page asks only while titles are unsaved.
   * @input  beforeunload with titlesDirty false, then true
   * @output preventDefault not called, then called
   */
  it('warns before leaving with unsaved titles', () => {
    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as BeforeUnloadEvent;
    component.onBeforeUnload(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    component.titlesDirty = true;
    component.onBeforeUnload(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
