/**
 * @file form-builder.component.spec.ts
 * @path src/app/admin/components/builders/form-builder/form-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of FormBuilderComponent – the generic create / edit popup of the admin
 *   (field visibility, defaults, value normalisation, multiselect, password confirmation, header
 *   text, validation messages and the submitted payload: plain object or FormData with files).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub, AlertDialogService spy), ScrollLockService (spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { FormControl, NgForm } from '@angular/forms';

import { FormBuilderComponent } from './form-builder.component';
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
     * @description Opening the form locks scrolling, destroying it unlocks.
     * @input  ngOnInit(), ngOnDestroy()
     * @output lock once, unlock once
     */
    it('locks scrolling while open', () => {
      create();
      component.ngOnDestroy();
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
     * @description Overlay click cancels, a click inside the form does not.
     * @input  onOverlayClick target === currentTarget, then different target
     * @output formCanceled emitted once
     */
    it('cancels on an overlay click only', () => {
      let cancelled = 0;
      component.formCanceled.subscribe(() => cancelled++);
      const overlay = {};
      component.onOverlayClick({ target: overlay, currentTarget: overlay } as any);
      component.onOverlayClick({ target: {}, currentTarget: overlay } as any);
      expect(cancelled).toBe(1);
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
});
