/**
 * @file project-templates.component.spec.ts
 * @path src/app/admin/web-pages/project-templates/project-templates.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectTemplatesComponent (page web/projects/templates): loading,
 *   the form of a new / existing template (rows added, moved, removed, validation of the days),
 *   saving (POST new, PUT existing - the checkpoints replace the stored ones), deleting after a
 *   confirmation, the "+ N days" labels and the read-only mode.
 * @dependencies testing/admin-test-helpers (DataHandler, i18n, alert, confirm, permission doubles)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ProjectTemplate, ProjectTemplatesComponent } from './project-templates.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ProjectTemplatesComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ProjectTemplatesComponent>;
  let component: ProjectTemplatesComponent;
  const dh = () => ctx.dataHandler as any;

  const templates = (): ProjectTemplate[] => [
    { id: 1, name: 'Web', description: 'Presentation web', checkpoints: [
      { label: 'Design', description: null, offset_days: 7 }, { label: 'Launch', description: 'Go live', offset_days: null },
    ] },
  ];

  beforeEach(async () => {
    ctx = createAdminTestContext();
    dh().getCollection.and.returnValue(of(templates()));
    await TestBed.configureTestingModule({ imports: [ProjectTemplatesComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ProjectTemplatesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description Templates load and render with their checkpoints and day offsets.
   * @input  1 template with 2 checkpoints
   * @output getCollection('project-portal/projects/templates'); 1 item; labels 'projects.template_offset' / 'projects.template_no_date'
   */
  it('loads the templates', () => {
    fixture.detectChanges();
    expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/templates');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.ps-item').length).toBe(1);
    expect(component.offsetLabel(7)).toBe('projects.template_offset');
    expect(component.offsetLabel(null)).toBe('projects.template_no_date');
  });

  /**
   * @description A new template needs a name and a title in every row; days are whole numbers
   *   0–3650; rows are added, moved and removed (one always stays); saving posts the trimmed
   *   payload and keeps the list sorted.
   * @input  openNew; rows 'Brief' (0), 'Analysis' ('x' → '3'); move; remove; save 'Audit'
   * @output post('project-portal/projects/templates', { name 'Audit', description null, checkpoints [Analysis 3, Brief 0] });
   *   list Audit, Web; form closed; success alert
   */
  it('creates a template with its checkpoints', () => {
    fixture.detectChanges();
    component.openNew();
    expect(component.editing).toBe('new');
    expect(component.draftValid).toBeFalse();
    component.draft.name = ' Audit ';
    component.draft.checkpoints[0].label = 'Brief';
    component.draft.checkpoints[0].offset_days = '0';
    component.addRow();
    component.draft.checkpoints[1].label = ' Analysis ';
    component.draft.checkpoints[1].offset_days = 'x';
    expect(component.draftValid).toBeFalse();
    component.draft.checkpoints[1].offset_days = '3651';
    expect(component.draftValid).toBeFalse();
    component.draft.checkpoints[1].offset_days = '3';
    expect(component.draftValid).toBeTrue();
    component.moveRow(1, -1);
    component.moveRow(0, -1);
    expect(component.draft.checkpoints.map(c => c.label)).toEqual([' Analysis ', 'Brief']);
    component.addRow();
    component.removeRow(2);
    expect(component.draft.checkpoints.length).toBe(2);

    dh().post.and.returnValue(of({ id: 2, name: 'Audit', description: null, checkpoints: [] }));
    component.save();
    expect(dh().post).toHaveBeenCalledWith('project-portal/projects/templates', {
      name: 'Audit', description: null, checkpoints: [
        { label: 'Analysis', description: null, offset_days: 3 }, { label: 'Brief', description: null, offset_days: 0 },
      ],
    });
    expect(component.templates.map(t => t.name)).toEqual(['Audit', 'Web']);
    expect(component.editing).toBeNull();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'projects.template_saved', 'success');
  });

  /**
   * @description An existing template opens with its rows (empty days as ''), the last row is
   *   never removed, saving PUTs and replaces it; deleting asks first.
   * @input  openEdit(Web); remove rows; save; delete declined / confirmed
   * @output draft rows Design '7' / Launch ''; put('project-portal/projects/templates/1', …); delete only after confirm
   */
  it('edits and deletes a template', async () => {
    fixture.detectChanges();
    component.openEdit(component.templates[0]);
    expect(component.editing).toBe(1);
    expect(component.draft.checkpoints).toEqual([
      { label: 'Design', description: '', offset_days: '7' }, { label: 'Launch', description: 'Go live', offset_days: '' },
    ]);
    component.removeRow(0);
    component.removeRow(0);
    expect(component.draft.checkpoints.length).toBe(1);
    dh().put.and.returnValue(of({ ...templates()[0], checkpoints: [{ label: 'Launch', description: 'Go live', offset_days: null }] }));
    component.save();
    expect(dh().put).toHaveBeenCalledWith('project-portal/projects/templates/1', jasmine.objectContaining({ name: 'Web', checkpoints: [{ label: 'Launch', description: 'Go live', offset_days: null }] }));
    expect(component.templates[0].checkpoints.length).toBe(1);

    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    await component.remove(component.templates[0]);
    expect(dh().delete).not.toHaveBeenCalled();
    ctx.confirm.open.and.returnValue(Promise.resolve(true));
    dh().delete.and.returnValue(of(null));
    component.openEdit(component.templates[0]);
    await component.remove(component.templates[0]);
    expect(dh().delete).toHaveBeenCalledWith('project-portal/projects/templates/1');
    expect(component.templates).toEqual([]);
    expect(component.editing).toBeNull();
  });

  /**
   * @description Without the update permission the page is read-only.
   * @input  granted only web-projects-view
   * @output canEdit false; openNew / openEdit / save / remove do nothing
   */
  it('is read-only without the update permission', async () => {
    ctx.permissions.granted = new Set(['web-projects-view']);
    fixture.detectChanges();
    expect(component.canEdit).toBeFalse();
    component.openNew();
    component.openEdit(component.templates[0]);
    expect(component.editing).toBeNull();
    component.save();
    await component.remove(component.templates[0]);
    expect(dh().post).not.toHaveBeenCalled();
    expect(dh().delete).not.toHaveBeenCalled();
  });
});
