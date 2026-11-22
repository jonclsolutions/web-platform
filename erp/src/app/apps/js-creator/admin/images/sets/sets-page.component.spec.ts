/**
 * @file sets-page.component.spec.ts
 * @path src/app/apps/js-creator/admin/images/sets/sets-page.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of SetsPageComponent: list with the formats of the sets, generating as
 *   the main action, the popup (name, templates added / ordered / removed, the limit of 10,
 *   caption), saving, the explanation of a field of another kind (422 field_conflict), the trash
 *   and the permissions.
 * @dependencies SetsPageComponent, admin-test-helpers.ts.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MAX_SET_TEMPLATES, SetsPageComponent } from './sets-page.component';
import { CreatorSet, CreatorTemplate } from '../../shared/js-creator.models';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

/**
 * @description Template of the section.
 * @param id Id.
 * @param size Width and height.
 */
function template(id: number, size: [number, number] = [1080, 1350]): CreatorTemplate {
  return {
    id, section: 'images', name: `T${id}`, width: size[0], height: size[1], output_format: 'png', output_quality: 90, caption_template: null,
    thumb_url: null, version: 1, created_at: null, updated_at: null, deleted_at: null,
  };
}

/**
 * @description Set with templates.
 * @param id Id.
 * @param templates Templates (id, trashed).
 */
function set(id: number, templates: [number, boolean][]): CreatorSet {
  return {
    id, section: 'images', name: `S${id}`, caption_template: null, created_at: null, updated_at: '2026-11-22 10:00:00', deleted_at: null,
    templates: templates.map(([tid, trashed]) => ({ id: tid, name: `T${tid}`, width: 1080, height: tid === 2 ? 1920 : 1350, output_format: 'png', thumb_url: null, trashed })),
  };
}

describe('SetsPageComponent', () => {
  let fixture: ComponentFixture<SetsPageComponent>;
  let component: SetsPageComponent;
  let ctx: AdminTestContext;
  let navigate: jasmine.Spy;

  /**
   * @description Creates the page: two sets (S1 with T1 + T2, S2 with only a template in the trash)
   *   and templates T1-T12 to add.
   * @param granted Permissions.
   */
  async function create(granted: string[] | 'all' = 'all'): Promise<void> {
    ctx = createAdminTestContext({ granted });
    ctx.dataHandler.getPaginatedCollection.and.callFake(((url: string) => of(url.includes('/templates')
      ? { data: Array.from({ length: 12 }, (_, i) => template(i + 1, i === 1 ? [1080, 1920] : [1080, 1350])), meta: { total: 12, per_page: 48, current_page: 1, last_page: 1 } }
      : { data: [set(1, [[1, false], [2, false]]), set(2, [[3, true]])], meta: { total: 2, per_page: 48, current_page: 1, last_page: 1 } })) as never);
    ctx.dataHandler.postQuietly.and.returnValue(of(set(9, [])) as never);
    ctx.dataHandler.putQuietly.and.returnValue(of(set(1, [])) as never);
    ctx.dataHandler.delete.and.returnValue(of(undefined) as never);
    ctx.dataHandler.post.and.returnValue(of(set(2, [])) as never);
    await TestBed.configureTestingModule({ imports: [SetsPageComponent], providers: ctx.providers }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(SetsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description Cards show one frame per format (a template in the trash faded); Generate opens
   *   generating of a set with a template outside the trash, not of a set without one.
   * @input S1 (T1, T2), S2 (only T3 in the trash)
   * @output 2 cards, 2 + 1 frames, 1 faded; navigate image-sets/1/generate; nothing for S2
   */
  it('lists sets and opens generating', async () => {
    await create();
    const cards = fixture.nativeElement.querySelectorAll('.st-card');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelectorAll('.st-format').length).toBe(2);
    expect(cards[1].querySelectorAll('.st-format--trashed').length).toBe(1);
    expect(ctx.dataHandler.getPaginatedCollection.calls.first().args[0]).toContain('js-creator/images/sets?');
    (cards[0].querySelector('.st-generate') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/admin/js-creator/image-sets', 1, 'generate']);
    navigate.calls.reset();
    component.generate(component.items[1]);
    expect(navigate).not.toHaveBeenCalled();
  });

  /**
   * @description New set: a name is required; templates are added from the search (each once, at
   *   most 10), ordered and removed; the save sends the name, the caption (empty = null) and the
   *   ids in their order; editing an existing set saves it.
   * @input no name; "Kampaň" + T2, T1, T1 again, move T1 up, remove T2; 11 additions; edit S1
   * @output error; POST {name, caption null, template_ids [1]}; 10 at most; PUT sets/1 with [1, 2]
   */
  it('creates and edits sets', async () => {
    await create();
    component.openCreate();
    component.submitDialog();
    expect(component.dialog?.error).toBe('js-creator-sets.error_name_required');

    const d = component.dialog!;
    d.name = 'Kampaň';
    component.addTemplate(template(2, [1080, 1920]));
    component.addTemplate(template(1));
    component.addTemplate(template(1));
    expect(d.templates.map(t => t.id)).toEqual([2, 1]);
    expect(component.candidates.some(t => t.id === 1)).toBeFalse();
    component.moveTemplate(1, -1);
    expect(d.templates.map(t => t.id)).toEqual([1, 2]);
    component.removeTemplate(1);
    component.submitDialog();
    expect(ctx.dataHandler.postQuietly).toHaveBeenCalledWith('js-creator/images/sets', { name: 'Kampaň', caption_template: null, template_ids: [1] });
    expect(component.dialog).toBeNull();

    component.openCreate();
    for (let i = 1; i <= 12; i++) component.addTemplate(template(i));
    expect(component.dialog!.templates.length).toBe(MAX_SET_TEMPLATES);

    component.openDialog(component.items[0]);
    component.dialog!.caption = 'Nové {{title}}';
    component.submitDialog();
    expect(ctx.dataHandler.putQuietly).toHaveBeenCalledWith('js-creator/images/sets/1', { name: 'S1', caption_template: 'Nové {{title}}', template_ids: [1, 2] });
  });

  /**
   * @description A refused save explains itself: a field of another kind names the field, both
   *   templates and their kinds; a template that cannot be added is named; other errors show the status.
   * @input 422 field_conflict (title text in T2, image in T1); 422 template_ids.1; 500
   * @output error_conflict with key, templates and kinds; error_template with T2; error_save (500)
   */
  it('explains a refused set', async () => {
    await create();
    component.openCreate();
    const d = component.dialog!;
    d.name = 'X';
    component.addTemplate(template(1));
    component.addTemplate(template(2));
    ctx.dataHandler.postQuietly.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 422, error: { error_code: 'field_conflict', conflict: { key: 'title', template_id: 2, type: 'text', other_id: 1, other_type: 'image' } },
    })));
    ctx.i18n.getValue.and.callFake((key: string) => (key === 'js-creator-sets.error_conflict' ? '{key}|{template}|{type}|{other}|{other_type}' : key));
    component.submitDialog();
    expect(d.error).toBe('title|T2|js-creator-sets.kind_text|T1|js-creator-sets.kind_image');
    expect(component.dialog).not.toBeNull();

    ctx.dataHandler.postQuietly.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { 'template_ids.1': ['x'] } } })));
    ctx.i18n.getValue.and.callFake((key: string) => (key === 'js-creator-sets.error_template' ? 'bad {template}' : key));
    component.submitDialog();
    expect(d.error).toBe('bad T2');

    ctx.dataHandler.postQuietly.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.submitDialog();
    expect(d.error).toBe('js-creator-sets.error_save (500)');
  });

  /**
   * @description Trash: delete (confirmed), restore, delete for good, empty; without permissions
   *   no New set, no edit / delete buttons and no Generate.
   * @input remove S1; restore / destroy S2; empty trash; view-only account
   * @output DELETE sets/1, POST sets/2/restore, DELETE sets/2?force=1, DELETE sets/trash; hidden buttons
   */
  it('works with the trash and the permissions', async () => {
    await create();
    await component.remove(component.items[0]);
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/sets/1');
    component.restore(component.items[1]);
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/sets/2/restore', {});
    await component.destroy(component.items[1]);
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/sets/2?force=1');
    await component.emptyTrash();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/sets/trash');

    TestBed.resetTestingModule();
    await create(['view-js-creator', 'js-creator-images-view']);
    expect(fixture.nativeElement.querySelector('app-page-header .ws-btn--primary')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.st-card .ws-icon-btn').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.st-generate')).toBeNull();
  });
});
