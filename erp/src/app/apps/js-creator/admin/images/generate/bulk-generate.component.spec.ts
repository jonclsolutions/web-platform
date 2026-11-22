/**
 * @file bulk-generate.component.spec.ts
 * @path src/app/apps/js-creator/admin/images/generate/bulk-generate.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the dialog "Generate from a table": a CSV is read and mapped,
 *   rows are checked by the runner of the page (and images matched to chosen photos or the
 *   library loaded only then), the ready rows are generated one after another with their
 *   values, a stopping refusal ends the run, Stop ends it after the row, a bad file is explained.
 * @dependencies BulkGenerateComponent, a fake BulkRunner, admin-test-helpers (DataHandler, i18n).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';
import { BulkGenerateComponent, BulkRunInput, BulkRunner } from './bulk-generate.component';
import { Field } from '../../shared/render/document';
import { CreatorOutput } from '../../shared/js-creator.models';
import type { ProduceResult } from './generate-page.component';

/** Fields of the tests: title (required text), photo (image). */
const FIELDS: Field[] = [
  { key: 'title', type: 'text', label: 'Nadpis', help: '', required: true, sample: '', maxLength: 30, multiline: false },
  { key: 'photo', type: 'image', label: 'Fotka', help: '', required: false, minWidth: 0, minHeight: 0 },
];

/**
 * @description Output answered by a fake run.
 * @param id Id.
 */
function made(id: number): CreatorOutput {
  return {
    id, section: 'images', folder_id: null, name: `O${id}`, template_id: 7, template_name: 'T', caption: null, width: 10, height: 10, format: 'png',
    page_count: 1, size_bytes: 1, url: null, thumb_url: null, download_url: null, created_at: null, updated_at: null, deleted_at: null,
  };
}

describe('BulkGenerateComponent', () => {
  let fixture: ComponentFixture<BulkGenerateComponent>;
  let component: BulkGenerateComponent;
  let ctx: AdminTestContext;
  let runs: BulkRunInput[];
  let answers: ProduceResult[];
  let runner: BulkRunner;

  /**
   * @description Creates the dialog with a runner that refuses an empty title and answers runs
   *   from `answers` (default: one output).
   */
  async function create(): Promise<void> {
    ctx = createAdminTestContext();
    ctx.dataHandler.getPaginatedCollection.and.returnValue(of({
      data: [{ id: 5, name: 'logo.png', mime: 'image/png', width: 1, height: 1, size_bytes: 1, url: '/a/5', thumb_url: '/t/5', created_at: null, deleted_at: null }],
      meta: { total: 1, per_page: 48, current_page: 1, last_page: 1 },
    }) as never);
    runs = [];
    answers = [];
    let id = 1;
    runner = {
      fields: () => FIELDS,
      targetCount: () => 2,
      prepare: jasmine.createSpy('prepare').and.resolveTo(),
      check: (texts) => (texts['title'] ? [] : [{ kind: 'required', field: 'title', label: 'Nadpis' }]),
      problemText: problem => `${problem.kind}:${problem.label}`,
      run: async row => {
        runs.push(row);
        return answers.shift() ?? { ok: true, outputs: [made(id++)] };
      },
    };
    await TestBed.configureTestingModule({ imports: [BulkGenerateComponent], providers: [...ctx.providers] }).compileComponents();
    fixture = TestBed.createComponent(BulkGenerateComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('runner', runner);
    fixture.componentRef.setInput('folderLabel', 'Kampaň');
    fixture.detectChanges();
  }

  /**
   * @description Chooses a file in an input of the dialog.
   * @param files Files.
   * @param pick Handler of the component.
   */
  async function choose(files: File[], pick: (event: Event) => Promise<void>): Promise<void> {
    await pick({ target: { files, value: '' } } as unknown as Event);
    fixture.detectChanges();
  }

  afterEach(() => fixture?.destroy());

  /**
   * @description A CSV is mapped by the headers; rows are checked (empty title, image not found
   *   until the library is loaded - it is, because "logo.png" is no chosen photo); a chosen photo
   *   matches by its name; the fonts of all texts are prepared.
   * @input CSV nazev;Nadpis;Fotka with rows (A, Léto, foto.jpg), (B, "", logo.png), (C, Zima, chybí.png); photo foto.jpg
   * @output mapping title 1, photo 2, name 0; library asked once; ready 1 of 3 → 2 of 3 after
   *   the photo (B: required; C: image_not_found "Fotka: chybí.png"); prepare called with the texts
   */
  it('reads, maps and checks a table', async () => {
    await create();
    const csv = new File(['nazev;Nadpis;Fotka\nA;Léto;foto.jpg\nB;;logo.png\nC;Zima;chybí.png\n'], 'akce.csv');
    await choose([csv], e => component.chooseTable(e));
    expect(component.mapping()).toEqual(jasmine.objectContaining({ title: 1, photo: 2, __name: 0, __caption: null }));
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/library/assets?page=1');
    expect(runner.prepare).toHaveBeenCalledWith(['Léto', '', 'Zima']);
    expect(component.readyRows().length).toBe(0);
    expect(component.problemsOf(component.checked()[1])).toEqual(['required:Nadpis']);
    expect(component.checked()[1].images['photo']).toEqual(jasmine.objectContaining({ kind: 'asset' }));

    await choose([new File(['x'], 'foto.jpg')], e => component.choosePhotos(e));
    expect(component.readyRows().map(r => r.row.index)).toEqual([1]);
    expect(component.problemsOf(component.checked()[2])).toEqual(['image_not_found:Fotka: chybí.png']);
    expect(component.outputCount()).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.bk-table tbody tr').length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('js-creator-generate.bulk_target');
  });

  /**
   * @description Generating runs the ready rows in their order with their values; a refusal of a
   *   row is shown at it and the run goes on; a stopping refusal ends the run; Stop ends it after
   *   the row; the summary counts outputs.
   * @input 3 ready rows (one with a caption column); answers ok, refused (not stopping), ok; then
   *   a stopping refusal on the first row; then Stop during the first row
   * @output runs with texts / names / captions; results 2 made + 1 error; stopped after 1 row
   *   with the reason; one run after Stop
   */
  it('generates the ready rows', async () => {
    await create();
    const csv = new File(['Nadpis;text_prispevku\nLéto;Ahoj\nZima;\nJaro;\n'], 'akce.csv');
    await choose([csv], e => component.chooseTable(e));
    answers = [{ ok: true, outputs: [made(1), made(2)] }, { ok: false, error: 'error_overflow', stop: false }, { ok: true, outputs: [made(3)] }];
    await component.generate();
    expect(runs.map(r => [r.index, r.texts['title'], r.name, r.caption])).toEqual([[1, 'Léto', '', 'Ahoj'], [2, 'Zima', '', null], [3, 'Jaro', '', null]]);
    expect(component.madeCount()).toBe(3);
    expect(component.failedRows().map(r => r.error)).toEqual(['js-creator-generate.error_overflow']);
    expect(component.stoppedBy()).toBeNull();

    runs = [];
    answers = [{ ok: false, error: 'error_quota', stop: true }];
    await component.generate();
    expect(runs.length).toBe(1);
    expect(component.stoppedBy()).toBe('js-creator-generate.error_quota');

    runs = [];
    runner.run = async row => {
      runs.push(row);
      component.stop();
      return { ok: true, outputs: [made(9)] };
    };
    await component.generate();
    expect(runs.length).toBe(1);
    expect(component.running()).toBeFalse();
  });

  /**
   * @description A file that is not a table is explained and nothing is mapped; the sample CSV
   *   is saved as a file.
   * @input notes.pdf; downloadSample
   * @output error bulk_error_type; no table; a link with download "js-creator-tabulka.csv" clicked
   */
  it('explains a bad file and offers a sample', async () => {
    await create();
    await choose([new File(['x'], 'notes.pdf')], e => component.chooseTable(e));
    expect(component.table()).toBeNull();
    expect(component.tableError()).toBe('js-creator-generate.bulk_error_type');
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    component.downloadSample();
    expect(click).toHaveBeenCalled();
    expect((click.calls.mostRecent().object as HTMLAnchorElement).download).toBe('js-creator-tabulka.csv');
  });
});
