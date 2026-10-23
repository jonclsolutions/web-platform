/**
 * @file edit-roles.component.spec.ts
 * @path src/app/admin/core-pages/edit-roles/edit-roles.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of EditRolesComponent – role and permission management: grouping of
 *   permission keys (module → resource → CRUD order), role list search, permission checklist
 *   with group toggles, protected (system) roles read-only, saving permissions / details,
 *   creating and deleting roles, Czech plural forms and export values.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, alert spy, i18n stub),
 *   ResourceCacheService (real), RoleOptionsService (stub)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EditRolesComponent } from './edit-roles.component';
import { RoleOptionsService } from '../../../core/services/role-options.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('EditRolesComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<EditRolesComponent>;
  let component: EditRolesComponent;
  let roleOptions: { invalidate: jasmine.Spy };

  const permissions = [
    { id: 1, permission_key: 'web-news-delete', description: 'Delete news', module: 'web' },
    { id: 2, permission_key: 'web-news-view', description: 'View news', module: 'web' },
    { id: 3, permission_key: 'web-news-create', description: null, module: 'web' },
    { id: 4, permission_key: 'web-about-view', description: null, module: 'web' },
    { id: 5, permission_key: 'view-web', description: 'Web section', module: 'web' },
    { id: 6, permission_key: 'core-administrators-view', description: null, module: 'core' }
  ];
  const makeRoles = () => [
    { id: 1, role_name: 'sysadmin', description: 'System', is_protected: true, forces_2fa: true, users_count: 1, permissions: [] },
    { id: 2, role_name: 'editor', description: 'Content editor', is_protected: false, forces_2fa: false, users_count: 0, permissions: ['web-news-view'] },
    { id: 3, role_name: 'manager', description: null, is_protected: false, forces_2fa: false, users_count: 3, permissions: [] }
  ];

  beforeEach(async () => {
    ctx = createAdminTestContext();
    (ctx.dataHandler as any).get.and.returnValue(of(permissions));
    (ctx.dataHandler as any).getCollection.and.callFake(() => of(makeRoles()));
    roleOptions = { invalidate: jasmine.createSpy('invalidate') };
    await TestBed.configureTestingModule({
      imports: [EditRolesComponent],
      providers: [...ctx.providers, { provide: RoleOptionsService, useValue: roleOptions }]
    }).compileComponents();
    fixture = TestBed.createComponent(EditRolesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  const role = (id: number) => component.roles.find(r => r.id === id)!;

  /**
   * @description Init loads permissions and the full role list, then selects the first role.
   * @input  ngOnInit()
   * @output get('core/permissions'); getCollection('core/roles?no_pagination=true'); 3 roles; selectedRole sysadmin; isLoading false
   */
  it('loads permissions and roles and selects the first role', () => {
    component.ngOnInit();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('core/permissions');
    expect((ctx.dataHandler as any).getCollection).toHaveBeenCalledWith('core/roles?no_pagination=true');
    expect(component.roles.length).toBe(3);
    expect(component.selectedRole?.role_name).toBe('sysadmin');
    expect(component.isLoading).toBeFalse();
  });

  /**
   * @description Permission keys are grouped by module and resource; actions go view → create → update → delete; "general" last.
   * @input  6 permissions (web news ×3, web about, view-web, core administrators)
   * @output modules ['web', 'core']; web resources ['About', 'News', general]; News items view, create, delete
   */
  it('groups permissions by module and resource', () => {
    component.ngOnInit();
    const web = component.permissionGroups.find(g => g.module === 'web')!;
    expect(component.permissionGroups.map(g => g.module)).toEqual(['web', 'core']);
    expect(web.moduleLabel).toBe('edit-roles.module_web');
    expect(web.resources.map(r => r.resourceLabel)).toEqual(['About', 'News', 'edit-roles.general_resource_label']);
    expect(web.resources[1].items.map(p => p.permission_key)).toEqual(['web-news-view', 'web-news-create', 'web-news-delete']);
    expect(component.moduleLabel('unknown')).toBe('unknown');
  });

  /**
   * @description A failure while loading permissions shows an error and stops loading.
   * @input  get('core/permissions') fails
   * @output alert ('edit-roles.error_title', 'edit-roles.load_permissions_error', 'danger'); isLoading false; roles not requested
   */
  it('reports a failed permission load', () => {
    (ctx.dataHandler as any).get.and.returnValue(throwError(() => new Error('x')));
    component.ngOnInit();
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-roles.error_title', 'edit-roles.load_permissions_error', 'danger');
    expect(component.isLoading).toBeFalse();
    expect((ctx.dataHandler as any).getCollection).not.toHaveBeenCalled();
  });

  /**
   * @description The role list and the permission checklist can be searched.
   * @input  roleSearch 'CONTENT'; permissionSearch 'delete'
   * @output filteredRoles ['editor'] (match in description); visible permissions ['web-news-delete'] only
   */
  it('filters roles and permissions by search', () => {
    component.ngOnInit();
    component.roleSearch = 'CONTENT';
    expect(component.filteredRoles.map(r => r.role_name)).toEqual(['editor']);
    component.permissionSearch = 'delete';
    const keys = component.visiblePermissionGroups.flatMap(g => g.resources.flatMap(r => r.items.map(p => p.permission_key)));
    expect(keys).toEqual(['web-news-delete']);
  });

  /**
   * @description System (protected) roles are read-only: no toggling, saving or detail editing.
   * @input  selected sysadmin (is_protected); togglePermission, toggleModuleGroup, startEditingDetails, savePermissions
   * @output currentPermissions stays empty; not dirty; not editing; put not called
   */
  it('keeps protected roles read-only', () => {
    component.ngOnInit();
    component.togglePermission('web-news-view');
    component.toggleModuleGroup(component.permissionGroups[0]);
    component.startEditingDetails();
    component.savePermissions();
    expect(component.currentPermissions.size).toBe(0);
    expect(component.isPermissionsDirty).toBeFalse();
    expect(component.isEditingDetails).toBeFalse();
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
  });

  /**
   * @description Single and group toggles change the checklist; full / partial states follow.
   * @input  editor (has web-news-view); toggleResourceGroup(News) twice; toggleModuleGroup(web)
   * @output News partial before; full after first toggle; empty after second; module fully checked after module toggle; dirty
   */
  it('toggles single permissions and whole groups', () => {
    component.ngOnInit();
    component.selectRole(role(2));
    const web = component.permissionGroups.find(g => g.module === 'web')!;
    const news = web.resources.find(r => r.resourceLabel === 'News')!;
    expect(component.isResourcePartiallyChecked(news)).toBeTrue();
    component.toggleResourceGroup(news);
    expect(component.isResourceFullyChecked(news)).toBeTrue();
    component.toggleResourceGroup(news);
    expect(news.items.some(p => component.isChecked(p.permission_key))).toBeFalse();
    component.toggleModuleGroup(web);
    expect(component.isModuleFullyChecked(web)).toBeTrue();
    expect(component.isModulePartiallyChecked(web)).toBeFalse();
    expect(component.isPermissionsDirty).toBeTrue();
    component.discardPermissionChanges();
    expect(Array.from(component.currentPermissions)).toEqual(['web-news-view']);
    expect(component.isPermissionsDirty).toBeFalse();
  });

  /**
   * @description Switching roles with unsaved changes asks first; "cancel" keeps the current role.
   * @input  editor with a toggled permission; window.confirm → false, then → true; selectRole(manager)
   * @output still editor after cancel; manager after confirm; dirty reset
   */
  it('asks before leaving unsaved changes', () => {
    component.ngOnInit();
    component.selectRole(role(2));
    component.togglePermission('web-about-view');
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(false);
    component.selectRole(role(3));
    expect(confirmSpy).toHaveBeenCalledWith('edit-roles.confirm_unsaved_switch');
    expect(component.selectedRole?.id).toBe(2);
    confirmSpy.and.returnValue(true);
    component.selectRole(role(3));
    expect(component.selectedRole?.id).toBe(3);
    expect(component.isPermissionsDirty).toBeFalse();
  });

  /**
   * @description Saving permissions sends the checked keys and updates the role locally (API returns no body).
   * @input  editor; toggle web-about-view; savePermissions(); put returns undefined
   * @output put('core/roles/2/permissions', { permission_keys: ['web-news-view', 'web-about-view'] }); role permissions updated; success alert
   */
  it('saves the permissions of a role', () => {
    component.ngOnInit();
    component.selectRole(role(2));
    component.togglePermission('web-about-view');
    (ctx.dataHandler as any).put.and.returnValue(of(undefined));
    component.savePermissions();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/roles/2/permissions', { permission_keys: ['web-news-view', 'web-about-view'] });
    expect(role(2).permissions).toEqual(['web-news-view', 'web-about-view']);
    expect(component.isPermissionsDirty).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-roles.success_title', 'edit-roles.save_permissions_success', 'success');
  });

  /**
   * @description A failed permission save shows the server message.
   * @input  put fails with { error: { message: 'Forbidden' } }
   * @output alert ('edit-roles.error_title', 'Forbidden', 'danger'); still dirty; isSavingPermissions false
   */
  it('shows the server message when saving permissions fails', () => {
    component.ngOnInit();
    component.selectRole(role(2));
    component.togglePermission('web-about-view');
    (ctx.dataHandler as any).put.and.returnValue(throwError(() => ({ error: { message: 'Forbidden' } })));
    component.savePermissions();
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-roles.error_title', 'Forbidden', 'danger');
    expect(component.isPermissionsDirty).toBeTrue();
    expect(component.isSavingPermissions).toBeFalse();
  });

  /**
   * @description Saving name / description / forced 2FA trims values and refreshes the shared role options.
   * @input  editor; startEditingDetails(); draftName '  writer ', description '  ', forces 2FA true; saveDetails()
   * @output put('core/roles/2', { role_name: 'writer', description: null, forces_2fa: true, … }); role renamed; roleOptions.invalidate()
   */
  it('saves role details', () => {
    component.ngOnInit();
    component.selectRole(role(2));
    component.startEditingDetails();
    component.draftName = '  writer ';
    component.draftDescription = '  ';
    component.draftForcesTwoFa = true;
    component.saveDetails();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/roles/2',
      jasmine.objectContaining({ role_name: 'writer', description: null, forces_2fa: true }));
    expect(role(2).role_name).toBe('writer');
    expect(component.isEditingDetails).toBeFalse();
    expect(roleOptions.invalidate).toHaveBeenCalled();
  });

  /**
   * @description An empty role name is rejected; cancelling restores the original values.
   * @input  draftName '   '; saveDetails(); cancelEditingDetails()
   * @output alert ('edit-roles.validation_title', 'edit-roles.role_name_required', 'danger'); no put; draftName 'editor'
   */
  it('requires a role name and can cancel editing', () => {
    component.ngOnInit();
    component.selectRole(role(2));
    component.startEditingDetails();
    component.draftName = '   ';
    component.saveDetails();
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-roles.validation_title', 'edit-roles.role_name_required', 'danger');
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
    component.cancelEditingDetails();
    expect(component.draftName).toBe('editor');
    expect(component.isEditingDetails).toBeFalse();
  });

  /**
   * @description A new role is created without permissions and then selected after a forced reload.
   * @input  openNewRoleForm(); name 'auditor', forces 2FA; createRole(); reloaded list contains 'auditor'
   * @output post('core/roles', { role_name: 'auditor', permissions: [], is_protected: false, forces_2fa: true, … }); selectedRole 'auditor'; form closed
   */
  it('creates a new role', () => {
    component.ngOnInit();
    component.openNewRoleForm();
    component.newRoleName = ' auditor ';
    component.newRoleForcesTwoFa = true;
    (ctx.dataHandler as any).getCollection.and.callFake(() => of([...makeRoles(),
      { id: 4, role_name: 'auditor', description: null, is_protected: false, forces_2fa: true, users_count: 0, permissions: [] }]));
    component.createRole();
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('core/roles',
      jasmine.objectContaining({ role_name: 'auditor', permissions: [], is_protected: false, forces_2fa: true, users_count: 0 }));
    expect(component.showNewRoleForm).toBeFalse();
    expect(component.selectedRole?.role_name).toBe('auditor');
    expect(roleOptions.invalidate).toHaveBeenCalled();
  });

  /**
   * @description Creating a role without a name or with a server validation error shows the error in the form.
   * @input  name ''; then name 'x' with post error { errors: { role_name: ['Taken'] } }
   * @output newRoleError 'edit-roles.new_role_name_required'; then 'Taken'
   */
  it('shows role creation errors in the form', () => {
    component.ngOnInit();
    component.openNewRoleForm();
    component.createRole();
    expect(component.newRoleError).toBe('edit-roles.new_role_name_required');
    component.newRoleName = 'x';
    (ctx.dataHandler as any).post.and.returnValue(throwError(() => ({ error: { errors: { role_name: ['Taken'] } } })));
    component.createRole();
    expect(component.newRoleError).toBe('Taken');
    expect(component.isCreatingRole).toBeFalse();
  });

  /**
   * @description Only non-system roles without users can be deleted; the reason is shown otherwise.
   * @input  sysadmin, manager (3 users), editor (0 users)
   * @output canDeleteRole false/false/true; reasons 'edit-roles.delete_blocked_system', 'edit-roles.delete_blocked_users', ''; openDeleteConfirm(manager) ignored
   */
  it('blocks deleting system roles and roles with users', () => {
    component.ngOnInit();
    expect(component.canDeleteRole(role(1))).toBeFalse();
    expect(component.canDeleteRole(role(3))).toBeFalse();
    expect(component.canDeleteRole(role(2))).toBeTrue();
    expect(component.deleteBlockedReason(role(1))).toBe('edit-roles.delete_blocked_system');
    expect(component.deleteBlockedReason(role(3))).toBe('edit-roles.delete_blocked_users');
    expect(component.deleteBlockedReason(role(2))).toBe('');
    component.openDeleteConfirm(role(3));
    expect(component.pendingDeleteRole).toBeNull();
  });

  /**
   * @description Deleting the selected role removes it and selects the first remaining role.
   * @input  select editor; openDeleteConfirm(editor); confirmDelete()
   * @output delete('core/roles/2'); roles without editor; selectedRole sysadmin; success alert
   */
  it('deletes a role after confirmation', () => {
    component.ngOnInit();
    component.selectRole(role(2));
    component.openDeleteConfirm(role(2));
    component.confirmDelete();
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('core/roles/2');
    expect(component.roles.map(r => r.id)).toEqual([1, 3]);
    expect(component.selectedRole?.id).toBe(1);
    expect(component.pendingDeleteRole).toBeNull();
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-roles.deleted_title', 'edit-roles.role_deleted_success', 'success');
  });

  /**
   * @description A failed delete keeps the confirmation open with the error.
   * @input  delete fails with { error: { message: 'In use' } }
   * @output deleteError 'In use'; pendingDeleteRole still editor; roles unchanged
   */
  it('keeps the confirmation open when delete fails', () => {
    component.ngOnInit();
    component.openDeleteConfirm(role(2));
    (ctx.dataHandler as any).delete.and.returnValue(throwError(() => ({ error: { message: 'In use' } })));
    component.confirmDelete();
    expect(component.deleteError).toBe('In use');
    expect(component.pendingDeleteRole?.id).toBe(2);
    expect(component.roles.length).toBe(3);
  });

  /**
   * @description User counts use the Czech plural forms (0 → zero, 1 → one, 2–4 → few, 5+ → many).
   * @input  usersCountLabel(0), (1), (3), (5)
   * @output '0 edit-roles.users_zero', '1 edit-roles.users_one', '3 edit-roles.users_few', '5 edit-roles.users_many'
   */
  it('uses Czech plural forms for user counts', () => {
    expect(component.usersCountLabel(0)).toBe('0 edit-roles.users_zero');
    expect(component.usersCountLabel(1)).toBe('1 edit-roles.users_one');
    expect(component.usersCountLabel(3)).toBe('3 edit-roles.users_few');
    expect(component.usersCountLabel(5)).toBe('5 edit-roles.users_many');
  });

  /**
   * @description Export values: permissions joined by '; ', booleans translated, null as ''; CSV escaping.
   * @input  getExportValue(editor, …); escapeCsvValue('a;b"c')
   * @output 'web-news-view'; 'edit-roles.export_bool_no'; ''; '"a;b""c"'
   */
  it('formats export values', () => {
    component.ngOnInit();
    const c = component as any;
    expect(c.getExportValue(role(2), 'permissions')).toBe('web-news-view');
    expect(c.getExportValue(role(2), 'is_protected')).toBe('edit-roles.export_bool_no');
    expect(c.getExportValue(role(1), 'forces_2fa')).toBe('edit-roles.export_bool_yes');
    expect(c.getExportValue(role(3), 'description')).toBe('');
    expect(c.escapeCsvValue('a;b"c')).toBe('"a;b""c"');
    expect(c.escapeCsvValue('plain')).toBe('plain');
  });

  /**
   * @description Export with no roles shows an error; a CSV export downloads a file and closes the popup.
   * @input  roles []; openExportPopup(); then roles loaded; handleExportFormatSelected({ format: 'csv', columnKeys: ['role_name'] })
   * @output alert 'edit-roles.export_empty_error'; triggerDownload called with 'edit-roles.export_filename_prefix-<date>.csv'; popup closed
   */
  it('exports the roles', () => {
    component.roles = [];
    component.openExportPopup();
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-roles.btn_export', 'edit-roles.export_empty_error', 'danger');
    expect(component.showExportPopup).toBeFalse();
    component.ngOnInit();
    component.openExportPopup();
    expect(component.showExportPopup).toBeTrue();
    const download = spyOn(component as any, 'triggerDownload');
    component.handleExportFormatSelected({ format: 'csv', columnKeys: ['role_name'] } as any);
    expect(download).toHaveBeenCalledWith(jasmine.any(Blob), `edit-roles.export_filename_prefix-${new Date().toISOString().slice(0, 10)}.csv`);
    expect(component.showExportPopup).toBeFalse();
    expect(component.isExporting).toBeFalse();
  });

  /**
   * @description The page renders the role list.
   * @input  detectChanges()
   * @output text contains 'sysadmin' and 'editor'
   */
  it('renders the role list', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('sysadmin');
    expect(text).toContain('editor');
  });
});
