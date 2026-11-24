/**
 * @file form-builder.component.spec.ts
 * @path src/app/admin/components/builders/form-builder/form-builder.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of FormBuilderComponent – the generic create / edit popup of the admin
 *   (field visibility, defaults, value normalisation, multiselect, password confirmation, header
 *   text, validation messages, the attachment rules of the upload profiles (types / sizes of the
 *   API) and the submitted payload: plain object or FormData with files).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub, AlertDialogService spy), ScrollLockService (spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { FormControl, NgForm } from '@angular/forms';

import { By } from '@angular/platform-browser';
import { FormBuilderComponent } from './form-builder.component';
import { MultiFileUploadComponent } from '../../../../shared/components/multi-file-upload/multi-file-upload.component';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('FormBuilderComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<FormBuilderComponent>;
  let component: FormBuilderComponent;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;

  const defs: any[] = [
    { column_name: 'name', label: 'Name', type: 'text', required: true },
    { column_name: 'role', label: 'Role', type: 'select', options: [{ value: '1', label: 'Admin' }, { value: '2', label: 'User' }] },
    { column_name: 'active', label: 'Active', type: 'select', options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }] },
    { column_name: 'tags', label: 'Tags', type: 'multiselect', options: [{ value: 1, label: 'A' }, { value: 2, label: 'B' }] },
    { column_name: 'files', label: 'Files', type: 'files' },
    { column_name: 'password', label: 'Password', type: 'confirm-password', show_in_edit: false },
    { column_name: 'note', label: 'Note', type: 'text', show_in_create: false, defaultValue: 'x' },
    { column_name: 'level', label: 'Level', type: 'text', defaultValue: 3 }
  ];

  /** Fake NgForm with the given validity and one control per field name. */
  const fakeForm = (valid: boolean, names: string[] = ['name']): NgForm => ({
    valid,
    controls: Object.fromEntries(names.map(n => [n, jasmine.createSpyObj('Control', ['markAsTouched'])]))
  }) as unknown as NgForm;

  const create = (edit: any = null) => {
    component.inputDefinitions = defs;
    component.formDataToEdit = edit;
    component.ngOnInit();
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    scrollLock = jasmine.createSpyObj<ScrollLockService>('ScrollLockService', ['lock', 'unlock']);
    await TestBed.configureTestingModule({
      imports: [FormBuilderComponent],
      providers: [...ctx.providers, { provide: ScrollLockService, useValue: scrollLock }]
    }).compileComponents();
    fixture = TestBed.createComponent(FormBuilderComponent);
    component = fixture.componentInstance;
  });

  describe('create mode', () => {
    /**
     * @description Create mode hides show_in_create: false fields and fills defaults.
     * @input  definitions above, formDataToEdit = null
     * @output 'note' not visible; formData name '', tags [], files [], level 3
     */
    it('shows create fields with their defaults', () => {
      create();
      expect(component.visibleInputDefinitions.map(d => d.column_name)).not.toContain('note');
      expect(component.formData['name']).toBe('');
      expect(component.formData['tags']).toEqual([]);
      expect(component.formData['files']).toEqual([]);
      expect(component.formData['level']).toBe(3);
    });

    /**
     * @description The header says "create" when no record is edited.
     * @input  create mode, no headerText
     * @output displayHeader = 'form-builder.create_header'
     */
    it('uses the create header', () => {
      create();
      expect(component.displayHeader).toBe('form-builder.create_header');
    });

    /**
     * @description An explicit header text always wins.
     * @input  headerText 'Custom'
     * @output displayHeader = 'Custom'
     */
    it('prefers an explicit header text', () => {
      component.headerText = 'Custom';
      create({ id: 4 });
      expect(component.displayHeader).toBe('Custom');
    });

    /**
     * @description The rendered form (its popup frame) locks scrolling, destroying it unlocks.
     * @input  render, destroy
     * @output lock once, unlock once
     */
    it('locks scrolling while open', () => {
      create();
      fixture.detectChanges();
      fixture.destroy();
      expect(scrollLock.lock).toHaveBeenCalledTimes(1);
      expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit mode', () => {
    /**
     * @description Edit mode copies the record and hides show_in_edit: false fields.
     * @input  formDataToEdit { id: 7, name: 'Bob', role: 2 }
     * @output formData is a copy (not the same object); 'password' hidden; 'note' visible
     */
    it('edits a copy of the record', () => {
      const record = { id: 7, name: 'Bob', role: 2 };
      create(record);
      expect(component.formData).not.toBe(record);
      expect(component.formData['name']).toBe('Bob');
      const visible = component.visibleInputDefinitions.map(d => d.column_name);
      expect(visible).not.toContain('password');
      expect(visible).toContain('note');
    });

    /**
     * @description Select values are turned into the matching option string; booleans to '1'/'0'.
     * @input  role 2 (number), active true (boolean)
     * @output role '2', active '1'
     */
    it('normalises select values to option strings', () => {
      create({ id: 1, role: 2, active: true });
      expect(component.formData['role']).toBe('2');
      expect(component.formData['active']).toBe('1');
    });

    /**
     * @description A select value without a matching option is left unchanged.
     * @input  role 99
     * @output role stays 99
     */
    it('keeps select values without a matching option', () => {
      create({ id: 1, role: 99 });
      expect(component.formData['role']).toBe(99);
    });

    /**
     * @description Existing files are not re-sent; multiselect values become strings.
     * @input  files [{ id: 1 }], tags [1, 2]
     * @output files [], tags ['1', '2']
     */
    it('resets file arrays and stringifies multiselect values', () => {
      create({ id: 1, files: [{ id: 1 }], tags: [1, 2] });
      expect(component.formData['files']).toEqual([]);
      expect(component.formData['tags']).toEqual(['1', '2']);
    });

    /**
     * @description The edit header includes the record id when it has one.
     * @input  formDataToEdit { id: 12 }, then { name: 'x' } (no id)
     * @output 'form-builder.edit_header_with_id' (with {id} replaced), then 'form-builder.edit_header'
     */
    it('uses the edit header with or without id', () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'form-builder.edit_header_with_id' ? 'Edit {id}' : p));
      create({ id: 12 });
      expect(component.displayHeader).toBe('Edit 12');
      component.formDataToEdit = { name: 'x' };
      expect(component.displayHeader).toBe('form-builder.edit_header');
    });
  });

  describe('inputs changing after init', () => {
    /**
     * @description New field definitions are applied to the visible fields.
     * @input  after init, inputDefinitions = [one text field]; ngOnChanges
     * @output visibleInputDefinitions has 1 field
     */
    it('reapplies changed definitions', () => {
      create();
      component.inputDefinitions = [{ column_name: 'only', label: 'Only', type: 'text' } as any];
      component.ngOnChanges({ inputDefinitions: new SimpleChange(defs, component.inputDefinitions, false) });
      expect(component.visibleInputDefinitions.map(d => d.column_name)).toEqual(['only']);
    });

    /**
     * @description Field overrides from the page are written into the form data.
     * @input  fieldOverrides { role: '1' }
     * @output formData.role = '1'
     */
    it('applies field overrides', () => {
      create();
      component.fieldOverrides = { role: '1' };
      component.ngOnChanges({ fieldOverrides: new SimpleChange(null, component.fieldOverrides, false) });
      expect(component.formData['role']).toBe('1');
    });

    /**
     * @description Changes before init are ignored (ngOnInit sets everything up).
     * @input  ngOnChanges before ngOnInit with fieldOverrides
     * @output formData unchanged ({})
     */
    it('ignores changes before init', () => {
      component.fieldOverrides = { role: '1' };
      component.ngOnChanges({ fieldOverrides: new SimpleChange(null, component.fieldOverrides, true) });
      expect(component.formData).toEqual({});
    });
  });

  describe('multiselect', () => {
    /**
     * @description Checking adds the value once, unchecking removes it.
     * @input  toggle 1 on, 1 on again, 2 on, 1 off
     * @output tags ['2']; isMultiselectChecked('tags', 2) true, (1) false
     */
    it('adds and removes values', () => {
      create();
      const ev = (checked: boolean) => ({ target: { checked } } as any);
      component.onMultiselectToggle('tags', 1, ev(true));
      component.onMultiselectToggle('tags', 1, ev(true));
      component.onMultiselectToggle('tags', 2, ev(true));
      component.onMultiselectToggle('tags', 1, ev(false));
      expect(component.formData['tags']).toEqual(['2']);
      expect(component.isMultiselectChecked('tags', 2)).toBeTrue();
      expect(component.isMultiselectChecked('tags', 1)).toBeFalse();
    });

    /**
     * @description Options listed in disabledOptionValues are disabled (e.g. granted by role).
     * @input  disabledOptionValues ['2']
     * @output option 2 disabled, option 1 enabled
     */
    it('disables options from disabledOptionValues', () => {
      const def = { ...defs[3], disabledOptionValues: ['2'] };
      expect(component.isOptionDisabled(def, 2)).toBeTrue();
      expect(component.isOptionDisabled(def, 1)).toBeFalse();
    });
  });

  describe('password confirmation', () => {
    /**
     * @description A mismatch is reported only after the confirmation was typed.
     * @input  password 'a'; confirmation '' then 'b' then 'a'
     * @output false, true, false
     */
    it('passwordMismatch() compares with the confirmation', () => {
      create();
      component.formData['password'] = 'a';
      expect(component.passwordMismatch('password')).toBeFalse();
      component.confirmPasswordData['password'] = 'b';
      expect(component.passwordMismatch('password')).toBeTrue();
      component.confirmPasswordData['password'] = 'a';
      expect(component.passwordMismatch('password')).toBeFalse();
    });

    /**
     * @description Submitting with a mismatch shows an error and sends nothing.
     * @input  password 'a', confirmation 'b'; onSubmit(valid form)
     * @output alert ('shared.error', 'form-builder.alert_password_mismatch_message', 'danger'); formSubmitted not emitted
     */
    it('blocks submit on mismatch', () => {
      create();
      component.formData['password'] = 'a';
      component.confirmPasswordData['password'] = 'b';
      let sent = 0;
      component.formSubmitted.subscribe(() => sent++);
      component.onSubmit(fakeForm(true));
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'form-builder.alert_password_mismatch_message', 'danger');
      expect(sent).toBe(0);
    });
  });

  describe('submit', () => {
    /**
     * @description A valid form without files is sent as a plain object copy.
     * @input  edit { id: 3, name: 'Bob' }; onSubmit(valid form)
     * @output formSubmitted emits object with id 3 and name 'Bob'; every control marked touched; isSubmitting true
     */
    it('emits a plain object without files', () => {
      create({ id: 3, name: 'Bob' });
      let payload: any;
      component.formSubmitted.subscribe(p => (payload = p));
      const form = fakeForm(true, ['name']);
      component.onSubmit(form);
      expect(payload).toEqual(jasmine.objectContaining({ id: 3, name: 'Bob' }));
      expect(payload instanceof FormData).toBeFalse();
      expect((form.controls['name'] as any).markAsTouched).toHaveBeenCalled();
      expect(component.isSubmitting).toBeTrue();
    });

    /**
     * @description With files the payload is FormData: files as name[], arrays as name[], empty arrays skipped, id kept.
     * @input  edit { id: 5, name: 'Bob', tags: [1] } plus files [a.txt, b.txt]
     * @output FormData with name 'Bob', tags[] ['1'], files[] 2 files, no 'files_removed_ids'; payload.id = 5
     */
    it('emits FormData when files are attached', () => {
      create({ id: 5, name: 'Bob', tags: [1] });
      component.onFilesChange([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')], 'files');
      let payload: any;
      component.formSubmitted.subscribe(p => (payload = p));
      component.onSubmit(fakeForm(true));
      expect(payload instanceof FormData).toBeTrue();
      expect(payload.get('name')).toBe('Bob');
      expect(payload.getAll('tags[]')).toEqual(['1']);
      expect(payload.getAll('files[]').length).toBe(2);
      expect(payload.id).toBe(5);
    });

    /**
     * @description A single file input is appended under its own name.
     * @input  onFileChange with file cv.pdf for 'cv'
     * @output FormData 'cv' is a File named 'cv.pdf'
     */
    it('appends a single file under its field name', () => {
      create();
      const file = new File(['x'], 'cv.pdf');
      component.onFileChange({ target: { files: [file] } }, 'cv');
      let payload: any;
      component.formSubmitted.subscribe(p => (payload = p));
      component.onSubmit(fakeForm(true));
      expect((payload.get('cv') as File).name).toBe('cv.pdf');
    });

    /**
     * @description Removed existing files are sent as <field>_removed_ids.
     * @input  onExistingFilesRemoved([4, 6], 'files')
     * @output formData.files_removed_ids = [4, 6]
     */
    it('records removed existing files', () => {
      create({ id: 1 });
      component.onExistingFilesRemoved([4, 6], 'files');
      expect(component.formData['files_removed_ids']).toEqual([4, 6]);
    });

    /**
     * @description An invalid form shows a warning and sends nothing.
     * @input  onSubmit(invalid form)
     * @output alert ('form-builder.alert_invalid_form_title', 'form-builder.alert_invalid_form_message', 'warning'); no emit
     */
    it('warns on an invalid form', () => {
      create();
      let sent = 0;
      component.formSubmitted.subscribe(() => sent++);
      component.onSubmit(fakeForm(false));
      expect(ctx.alert.open).toHaveBeenCalledWith('form-builder.alert_invalid_form_title', 'form-builder.alert_invalid_form_message', 'warning');
      expect(sent).toBe(0);
    });

    /**
     * @description A second submit while the first is running is ignored (no double save).
     * @input  onSubmit twice
     * @output formSubmitted emitted once
     */
    it('ignores a second submit while submitting', () => {
      create({ id: 1, name: 'a' });
      let sent = 0;
      component.formSubmitted.subscribe(() => sent++);
      component.onSubmit(fakeForm(true));
      component.onSubmit(fakeForm(true));
      expect(sent).toBe(1);
    });
  });

  describe('validation messages and closing', () => {
    /**
     * @description Messages appear only for touched/dirty invalid controls; the field message wins.
     * @input  required error untouched; touched required; touched pattern with field errorMessage 'Bad'; touched email
     * @output null; 'form-builder.validation_required'; 'Bad'; 'form-builder.validation_email'
     */
    it('getValidationErrorMessage() picks the right message', () => {
      const control = (errors: any, touched: boolean) => {
        const c = new FormControl('');
        c.setErrors(errors);
        if (touched) c.markAsTouched();
        return c;
      };
      const def: any = { column_name: 'x' };
      expect(component.getValidationErrorMessage(control({ required: true }, false), def)).toBeNull();
      expect(component.getValidationErrorMessage(control({ required: true }, true), def)).toBe('form-builder.validation_required');
      expect(component.getValidationErrorMessage(control({ pattern: true }, true), { ...def, errorMessage: 'Bad' })).toBe('Bad');
      expect(component.getValidationErrorMessage(control({ email: true }, true), def)).toBe('form-builder.validation_email');
    });

    /**
     * @description The form sits in the shared popup frame: closing the frame (backdrop, close
     *   button) cancels, a click inside the form does not; the save button in the frame's footer
     *   submits the form by its id.
     * @input  render; backdrop press + click; click into the card; close button
     * @output formCanceled emitted twice; size lg; submit button form = form id
     */
    it('cancels when the frame closes and saves from its footer', () => {
      let cancelled = 0;
      component.formCanceled.subscribe(() => cancelled++);
      create();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const overlay = el.querySelector('.am-overlay') as HTMLElement;
      overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      overlay.click();
      (el.querySelector('.am-card') as HTMLElement).click();
      (el.querySelector('.am-close') as HTMLElement).click();
      expect(cancelled).toBe(2);
      expect((el.querySelector('.am-card') as HTMLElement).dataset['size']).toBe('lg');
      const submit = el.querySelector('.am-footer button[type="submit"]') as HTMLButtonElement;
      expect(submit.getAttribute('form')).toBe(el.querySelector('form')!.id);
    });

    /**
     * @description A select change is forwarded to the page.
     * @input  onFieldChange('role', '2')
     * @output fieldChanged emits { columnName: 'role', value: '2' }
     */
    it('forwards field changes', () => {
      let event: any;
      component.fieldChanged.subscribe(e => (event = e));
      component.onFieldChange('role', '2');
      expect(event).toEqual({ columnName: 'role', value: '2' });
    });

    /**
     * @description An avatar field renders the photo editor of the edited account (editable or
     *   read-only) and keeps + reports a saved change.
     * @input  edit of { id: 5, avatar_url: '/a.webp' } with an editable, then a read-only avatar
     *   field; onAvatarChange('avatar_url', '/b.webp').
     * @output editor with userId 5 and the URL, controls shown / hidden; formData updated,
     *   avatarChanged { columnName: 'avatar_url', value: '/b.webp' }.
     */
    it('renders and reports an avatar field', () => {
      component.inputDefinitions = [{ column_name: 'avatar_url', label: 'Photo', type: 'avatar', editable: true } as any];
      component.formDataToEdit = { id: 5, avatar_url: '/a.webp' };
      component.ngOnInit();
      fixture.detectChanges();
      const editor = fixture.debugElement.query(By.css('app-avatar-editor'));
      expect(editor.componentInstance.userId).toBe(5);
      expect(editor.componentInstance.avatarUrl).toBe('/a.webp');
      expect(editor.nativeElement.querySelector('.avatar-editor-circle')).not.toBeNull();

      let event: any;
      component.avatarChanged.subscribe(e => (event = e));
      component.onAvatarChange('avatar_url', '/b.webp');
      expect(component.formData['avatar_url']).toBe('/b.webp');
      expect(event).toEqual({ columnName: 'avatar_url', value: '/b.webp' });

      component.inputDefinitions = [{ column_name: 'avatar_url', label: 'Photo', type: 'avatar', editable: false } as any];
      component.ngOnChanges({ inputDefinitions: { firstChange: false } as any });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.avatar-editor-circle')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-avatar-editor app-user-avatar')).not.toBeNull();
    });

    /**
     * @description The rendered form shows a label per visible field and the required star.
     * @input  create mode with the definitions above; detectChanges()
     * @output label 'Name' with '*'; no label for hidden 'note'
     */
    it('renders the visible fields', () => {
      component.inputDefinitions = defs;
      fixture.detectChanges();
      const labels = Array.from(fixture.nativeElement.querySelectorAll('.field-label')).map((l: any) => l.textContent.replace(/\s+/g, ' ').trim());
      expect(labels).toContain('Name *');
      expect(labels.some(l => l.startsWith('Note'))).toBeFalse();
    });
  });

  describe('upload rules', () => {
    const uploadDefs: any[] = [
      { column_name: 'subject', label: 'Subject', type: 'text' },
      { column_name: 'attachment', label: 'Attachment', type: 'file', uploadProfile: 'job_application' },
      { column_name: 'attachments', label: 'Attachments', type: 'files', uploadProfile: 'raw_request_commission' },
      { column_name: 'plain', label: 'Plain', type: 'file' }
    ];
    const pick = (name: string, size = 10) => {
      const f = new File(['x'], name);
      Object.defineProperty(f, 'size', { value: size });
      return { target: { files: [f], value: 'C:/' + name } };
    };

    beforeEach(() => {
      component.inputDefinitions = uploadDefs;
      fixture.detectChanges();
    });

    /**
     * @description Fields with an uploadProfile get the rules of the API (e.g. the user-request
     *   attachments: raw_request_commission); the file pickers offer every file and no type list
     *   is shown up front (it comes with a refusal only); a field without a profile has no rules.
     * @input  definitions above (job_application 'file', raw_request_commission 'files', 'file' without profile)
     * @output no accept, no hint, types text ready for the error; uploader 10 files / 20 / 50 MB without
     *   svg / xml; plain field: no rules, no types text; a profile not used by any field is not loaded (null)
     */
    it('passes the rules of the profile to the file fields', () => {
      const attachment = uploadDefs[1];
      expect(component.rulesFor(attachment)!.max_files).toBe(1);
      expect(component.allowedTypesFor(attachment)).toBe('file-upload.allowed_types_hint');
      const input = fixture.nativeElement.querySelector('#attachment') as HTMLInputElement;
      expect(input.hasAttribute('accept')).toBeFalse();
      expect(fixture.nativeElement.textContent).not.toContain('file-upload.allowed_types_hint');

      const uploader = fixture.debugElement.query(By.directive(MultiFileUploadComponent)).componentInstance as MultiFileUploadComponent;
      expect([uploader.maxFiles, uploader.maxFileSizeMb, uploader.maxTotalSizeMb]).toEqual([10, 20, 50]);
      expect(uploader.allowedExtensions).not.toContain('svg');
      expect(uploader.allowedExtensions).not.toContain('xml');

      const plain = uploadDefs[3];
      expect(component.rulesFor(plain)).toBeNull();
      expect(component.allowedTypesFor(plain)).toBe('');
      expect((fixture.nativeElement.querySelector('#plain') as HTMLInputElement).hasAttribute('accept')).toBeFalse();
      expect(component.rulesFor({ column_name: 'x', label: 'X', type: 'file', uploadProfile: 'sales_order' } as any)).toBeNull();
    });

    /**
     * @description A single file of a refused type (xml, svg, no extension) or over the size limit
     *   is not put into the form data: the input is cleared and a warning dialog says why (a type
     *   refusal also lists the allowed types). An
     *   allowed file is kept; a field without a profile leaves the check to the API.
     * @input  onFileChange feed.xml / logo.svg / README / big.pdf (21 MB) / ok.pdf on 'attachment';
     *   tool.exe on 'plain'; empty selection
     * @output 3× type warning with the allowed types + 1× size warning, formData.attachment unset, value ''; ok.pdf kept;
     *   tool.exe kept; empty selection ignored
     */
    it('refuses a single file that breaks the rules', () => {
      for (const name of ['feed.xml', 'logo.svg', 'README']) {
        const event = pick(name);
        component.onFileChange(event, 'attachment');
        expect(event.target.value).toBe('');
        expect(component.formData['attachment']).toBeUndefined();
        expect(ctx.alert.open).toHaveBeenCalledWith('file-upload.alert_file_refused_title', 'file-upload.error_file_type file-upload.allowed_types_hint', 'warning');
      }
      component.onFileChange(pick('big.pdf', 21 * 1024 * 1024), 'attachment');
      expect(ctx.alert.open).toHaveBeenCalledWith('file-upload.alert_file_refused_title', 'file-upload.error_file_too_large', 'warning');
      expect(ctx.alert.open).toHaveBeenCalledTimes(4);

      component.onFileChange(pick('ok.pdf'), 'attachment');
      expect((component.formData['attachment'] as File).name).toBe('ok.pdf');
      component.onFileChange(pick('tool.exe', 30 * 1024 * 1024), 'plain');
      expect((component.formData['plain'] as File).name).toBe('tool.exe');
      component.onFileChange({ target: { files: [] } }, 'plain');
      expect((component.formData['plain'] as File).name).toBe('tool.exe');
      expect(ctx.alert.open).toHaveBeenCalledTimes(4);
    });
  });

  describe('record popup (recordMode)', () => {
    const record = { id: 12, name: 'Anna', role: '1', created_at: '2026-11-20T10:00:00Z', note: 'n' };
    const details: any[] = [
      { key: 'id', displayName: 'ID', type: 'text' },
      { key: 'name', displayName: 'Name', type: 'text' },
      { key: 'created_at', displayName: 'Created', type: 'date' },
    ];
    const open = (readOnly = false, actions: any[] = []) => {
      fixture.componentRef.setInput('inputDefinitions', [defs[0], defs[1]]);
      fixture.componentRef.setInput('formDataToEdit', record);
      fixture.componentRef.setInput('recordMode', true);
      fixture.componentRef.setInput('readOnly', readOnly);
      fixture.componentRef.setInput('detailColumns', details);
      fixture.componentRef.setInput('recordActions', actions);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    /**
     * @description The record popup is the form and the detail: title "Record <id>", the values
     *   that are no editable field (ID, created) as compact read-only text above the form, the
     *   actions of the record on the left of the footer (Delete red; nothing in the header next
     *   to the close button) emitting their action, Save changes in the footer.
     * @input record 12; detail columns id, name, created_at; fields name, role; actions delete.
     * @output heading 'form-builder.record_header_with_id' with 12; infoColumns id + created_at;
     *   one compact embedded details block; no button in .am-header-actions; footer action with
     *   the danger class emits 'delete';
     *   submit label 'form-builder.save_button'.
     */
    it('shows the form with read-only values and the record actions', () => {
      const el = open(false, [{ type: 'delete_button', action: 'delete', isActive: true, display_name: 'Delete', icon: 'delete' }]);
      expect(component.displayHeader).toBe('form-builder.record_header_with_id');
      expect(component.infoColumns.map(c => c.key)).toEqual(['id', 'created_at']);
      expect(el.querySelectorAll('app-details-builder').length).toBe(1);
      expect(el.querySelector('.details-embedded--compact')).not.toBeNull();
      expect(el.querySelectorAll('.form-grid-layout input, .form-grid-layout select').length).toBe(2);
      expect(el.querySelector('.am-header-actions button')).toBeNull();
      const action = el.querySelector('.am-footer .fb-record-actions .fb-record-action') as HTMLButtonElement;
      expect(action.classList).toContain('fb-record-action--danger');
      expect(action.getAttribute('aria-label')).toBe('Delete');
      const emitted = spyOn(component.recordAction, 'emit');
      action.click();
      expect(emitted).toHaveBeenCalledWith('delete');
      expect(el.querySelector('.am-btn--primary')!.textContent!.trim()).toBe('form-builder.save_button');
    });

    /**
     * @description Up to two other actions are buttons next to Delete; more go under "⋯ More"
     *   (a menu) while Delete stays visible; an item of the menu emits its action and closes it.
     * @input actions variants, images + delete; then variants, images, orders + delete.
     * @output 3 buttons (variants, images, delete last); then More + delete, menu with 3 items,
     *   click on 'orders' emits it and closes the menu.
     */
    it('puts more than two other actions under More', () => {
      const act = (action: string, type = 'neutral_button') => ({ type, action, isActive: true, display_name: action });
      let el = open(false, [act('variants'), act('images'), act('delete', 'delete_button')]);
      expect(Array.from(el.querySelectorAll('.fb-record-actions > .fb-record-action')).map(b => b.textContent!.trim())).toEqual(['variants', 'images', 'delete']);
      expect(component.moreActionsMenu).toBeFalse();

      fixture.componentRef.setInput('recordActions', [act('variants'), act('images'), act('orders'), act('delete', 'delete_button')]);
      fixture.detectChanges();
      el = fixture.nativeElement;
      expect(component.moreActionsMenu).toBeTrue();
      expect(el.querySelectorAll('.fb-record-actions > .fb-record-action--danger').length).toBe(1);
      const more = el.querySelector('.fb-more > .fb-record-action') as HTMLButtonElement;
      expect(more.textContent).toContain('form-builder.more_actions_button');
      more.click();
      fixture.detectChanges();
      const items = Array.from(el.querySelectorAll('.fb-more-item')) as HTMLButtonElement[];
      expect(items.map(b => b.textContent!.trim())).toEqual(['variants', 'images', 'orders']);
      const emitted = spyOn(component.recordAction, 'emit');
      items[2].click();
      expect(emitted).toHaveBeenCalledWith('orders');
      expect(component.isMoreActionsOpen).toBeFalse();
    });

    /**
     * @description Without the edit permission the popup shows only the values: all detail
     *   columns, no fields, Close instead of Cancel / Save; closing never asks.
     * @input readOnly true; onCancel().
     * @output embedded details (not compact), no inputs, one footer button 'form-builder.close_button';
     *   formCanceled at once, no confirmation.
     */
    it('only shows the values without the edit permission', () => {
      const el = open(true);
      expect(component.infoColumns).toEqual([]);
      expect(el.querySelector('.details-embedded')).not.toBeNull();
      expect(el.querySelector('.details-embedded--compact')).toBeNull();
      expect(el.querySelectorAll('.form-grid-layout').length).toBe(0);
      const footer = Array.from(el.querySelectorAll('.am-btn')) as HTMLButtonElement[];
      expect(footer.map(b => b.textContent!.trim())).toEqual(['form-builder.close_button']);
      const canceled = spyOn(component.formCanceled, 'emit');
      component.onCancel();
      expect(canceled).toHaveBeenCalled();
      expect(ctx.confirm.open).not.toHaveBeenCalled();
    });

    /**
     * @description Closing the record popup with unsaved changes asks first: "keep editing" keeps
     *   it open, "discard" closes; chosen files count as a change; a clean popup closes at once;
     *   resetSubmitting allows another save after a failure.
     * @input clean onCancel; files chosen + confirm false; confirm true; isSubmitting + resetSubmitting.
     * @output clean: formCanceled without a question; dirty: question with the discard texts,
     *   no close, then close; isSubmitting false.
     */
    it('asks before closing with unsaved changes', async () => {
      open();
      const canceled = spyOn(component.formCanceled, 'emit');
      component.onCancel();
      expect(canceled).toHaveBeenCalledTimes(1);
      expect(ctx.confirm.open).not.toHaveBeenCalled();

      component.onFilesChange([new File(['x'], 'a.pdf')], 'files');
      expect(component.isDirty).toBeTrue();
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      component.onCancel();
      await fixture.whenStable();
      expect(ctx.confirm.open).toHaveBeenCalledWith('form-builder.discard_confirm_title', 'form-builder.discard_confirm_message',
        { confirm: 'form-builder.discard_confirm_button', cancel: 'form-builder.discard_keep_button' });
      expect(canceled).toHaveBeenCalledTimes(1);
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      component.onCancel();
      await fixture.whenStable();
      expect(canceled).toHaveBeenCalledTimes(2);

      component.isSubmitting = true;
      component.resetSubmitting();
      expect(component.isSubmitting).toBeFalse();
    });
  });
});
