/**
 * @file multi-file-upload.component.spec.ts
 * @path src/app/shared/components/multi-file-upload/multi-file-upload.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of MultiFileUploadComponent: adding files from the input and by
 *   drag & drop, the three limits (count incl. existing files, size per file, total size) with
 *   their messages, removing new / staged removal of existing files, text overrides and the
 *   rendered labels.
 * @dependencies
 * - Real component (OnPush) rendered via ComponentFixture; File objects created in memory.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MultiFileUploadComponent } from './multi-file-upload.component';

const MB = 1024 * 1024;

/** In-memory file of the given size. */
const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

describe('MultiFileUploadComponent', () => {
  let fixture: ComponentFixture<MultiFileUploadComponent>;
  let component: MultiFileUploadComponent;
  let emitted: File[][];
  let removed: number[][];
  const text = (selector: string) => (fixture.nativeElement.querySelector(selector)?.textContent ?? '').trim();

  /** Simulates the file input change. */
  function choose(...files: File[]): HTMLInputElement {
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return input;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MultiFileUploadComponent] });
    fixture = TestBed.createComponent(MultiFileUploadComponent);
    component = fixture.componentInstance;
    component.maxFiles = 3;
    component.maxFileSizeMb = 1;
    component.maxTotalSizeMb = 2;
    emitted = [];
    removed = [];
    component.filesChanged.subscribe(f => emitted.push(f));
    component.existingFileRemoved.subscribe(ids => removed.push(ids));
    fixture.detectChanges();
  });

  /**
   * @description Files from the input are added and emitted, the list and total are rendered;
   *   an input without files is ignored.
   * @input choose(a.txt 10 B, b.txt 2 KB); input change without files.
   * @output emitted [a, b]; 2 list items; total 'Celkem: 2 / 3 souborů (2 KB nových)'; hint with limits.
   */
  it('adds chosen files and shows the totals', () => {
    expect(text('.mfu-hint')).toBe('(max. 3 souborů, 1 MB/soubor, 2 MB celkem)');
    choose(file('a.txt'), file('b.txt', 2048));
    expect(emitted.length).toBe(1);
    expect(emitted[0].map(f => f.name)).toEqual(['a.txt', 'b.txt']);
    expect(fixture.nativeElement.querySelectorAll('.mfu-file-list li').length).toBe(2);
    expect(text('.mfu-total')).toBe('Celkem: 2 / 3 souborů (2 KB nových)');

    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: null });
    component.onFileInputChange({ target: input } as any);
    expect(emitted.length).toBe(1);
  });

  /**
   * @description Drag & drop toggles the highlight and adds the dropped files.
   * @input dragover; dragleave; dragover + drop with one file; drop without dataTransfer.
   * @output dragging true/false; after drop false + file added; empty drop ignored.
   */
  it('accepts dropped files', () => {
    const dragEvent = (files?: File[]) => ({ preventDefault: jasmine.createSpy(), dataTransfer: files ? { files } : null } as any);
    const over = dragEvent();
    component.onDragOver(over);
    expect(component.isDragging).toBeTrue();
    expect(over.preventDefault).toHaveBeenCalled();
    component.onDragLeave();
    expect(component.isDragging).toBeFalse();

    component.onDragOver(dragEvent());
    component.onDrop(dragEvent([file('d.pdf')]));
    expect(component.isDragging).toBeFalse();
    expect(component.files.map(f => f.name)).toEqual(['d.pdf']);
    component.onDrop(dragEvent());
    expect(component.files.length).toBe(1);
  });

  /**
   * @description Limits: too many files (with / without existing ones), one file too large,
   *   total too large - nothing is added, the message is rendered; a valid add clears it.
   * @input 4 files; 1 existing + 3 files; 1.5 MB file; 2 × 0.9 MB + 1 × 0.9 MB; 1 small file.
   * @output The four Czech default messages; files unchanged; message cleared on success.
   */
  it('enforces the file count and size limits', () => {
    choose(file('1'), file('2'), file('3'), file('4'));
    expect(text('.mfu-error')).toBe('Můžete nahrát maximálně 3 souborů.');
    expect(component.files.length).toBe(0);

    component.existingFiles = [{ id: 7, original_filename: 'old.pdf', size_bytes: 3 * MB }];
    choose(file('1'), file('2'), file('3'));
    expect(text('.mfu-error')).toBe('Můžete mít nahráno maximálně 3 souborů (včetně 1 již existujících).');

    component.existingFiles = [];
    choose(file('big', 1.5 * MB));
    expect(text('.mfu-error')).toBe('Soubor "big" přesahuje limit 1 MB.');

    choose(file('x', 0.9 * MB), file('y', 0.9 * MB));
    choose(file('z', 0.9 * MB));
    expect(text('.mfu-error')).toBe('Celková velikost příloh nesmí přesáhnout 2 MB.');
    expect(component.files.length).toBe(2);
    expect(component.totalSizeLabel).toBe('1.8 MB');

    component.removeFile(0);
    fixture.detectChanges();
    expect(text('.mfu-error')).toBe('');
    expect(emitted[emitted.length - 1].map(f => f.name)).toEqual(['y']);
  });

  /**
   * @description Existing attachments: link when a URL exists, plain name otherwise; removing
   *   one hides it (staged) and emits all removed ids; the counters include them.
   * @input 2 existing (one with view_url); remove id 1 via its button; then id 2.
   * @output 1 link + 1 span; title '(2)' → '(1)'; emitted [1] then [1, 2]; total '1 / 3' then none.
   */
  it('lists and stages removal of existing attachments', () => {
    fixture.componentRef.setInput('existingFiles', [
      { id: 1, original_filename: 'a.pdf', size_bytes: 2048, view_url: '/v/1' } as any,
      { id: 2, original_filename: 'b.pdf', size_bytes: 1024 }
    ]);
    fixture.detectChanges();
    expect(text('.mfu-existing-title')).toBe('Již nahrané přílohy (2)');
    expect(fixture.nativeElement.querySelector('.mfu-existing-link').getAttribute('href')).toBe('/v/1');
    expect(fixture.nativeElement.querySelectorAll('.mfu-existing-item span.mfu-file-name').length).toBe(1);

    (fixture.nativeElement.querySelector('.mfu-existing-item .mfu-remove-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text('.mfu-existing-title')).toBe('Již nahrané přílohy (1)');
    expect(text('.mfu-total')).toBe('Celkem: 1 / 3 souborů');

    component.removeExistingFile(2);
    fixture.detectChanges();
    expect(removed).toEqual([[1], [1, 2]]);
    expect(fixture.nativeElement.querySelector('.mfu-existing-section')).toBeNull();
    expect(fixture.nativeElement.querySelector('.mfu-total')).toBeNull();
  });

  /**
   * @description Text overrides replace the defaults (others keep the default); sizes are
   *   formatted in KB below 1 MB and MB above.
   * @input textOverrides {errorMaxFiles: 'Max {max}!', dropzoneLabel: 'Drop'}; formatSize(512, 1.5 MB).
   * @output 'Drop' rendered; 'Max 3!' on too many files; '1 KB', '1.5 MB'.
   */
  it('uses text overrides and formats sizes', () => {
    fixture.componentRef.setInput('textOverrides', { errorMaxFiles: 'Max {max}!', dropzoneLabel: 'Drop' });
    fixture.detectChanges();
    expect(text('.mfu-dropzone-label')).toBe('Drop');
    choose(file('1'), file('2'), file('3'), file('4'));
    expect(text('.mfu-error')).toBe('Max 3!');
    expect(component.t.totalLabel).toBe('Celkem: {count} / {max} souborů');
    expect(component.formatSize(512)).toBe('1 KB');
    expect(component.formatSize(1.5 * MB)).toBe('1.5 MB');
  });
});
