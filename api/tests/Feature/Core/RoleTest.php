<?php

/**
 * @file RoleTest.php
 * @path api/tests/Feature/Core/RoleTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of roles and permissions (CoreRoleController,
 *   CorePermissionController): listing, sysadmin-only management, the protected sysadmin
 *   role, permission matrix sync, delete / restore / trash.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core;

use App\Models\Core\CoreRole;
use Tests\TestCase;

/**
 * @description /api/core/roles and /api/core/permissions.
 */
class RoleTest extends TestCase
{
    /**
     * @description The permission list is ordered by module, then key.
     * @input Permissions web/b, core/z, core/a; GET /api/core/permissions as any signed-in account.
     * @output 200 [core/a, core/z, web/b] with id, permission_key, description, module.
     */
    public function test_permissions_are_listed_by_module(): void
    {
        $this->permission('b-key', 'web');
        $this->permission('z-key', 'core');
        $this->permission('a-key', 'core');
        $this->signIn($this->user());

        $this->getJson('/api/core/permissions')
            ->assertOk()
            ->assertJsonPath('data.*.permission_key', ['a-key', 'z-key', 'b-key'])
            ->assertJsonStructure(['data' => [['id', 'permission_key', 'description', 'module']]]);
    }

    /**
     * @description The role list is paginated and carries user counts and permission keys.
     * @input Role 'editor' (web-news-view) with 1 user; GET /api/core/roles?per_page=1.
     * @output 200 {data, total, per_page 1, current_page, last_page}; users_count, permissions.
     */
    public function test_index_paginated(): void
    {
        $editor = $this->role('editor', ['web-news-view'], ['description' => 'Edits news']);
        $this->user([], $editor);
        $this->signIn($this->user());

        $this->getJson('/api/core/roles?per_page=1')
            ->assertOk()
            ->assertJson(['meta' => ['total' => 1, 'per_page' => 1, 'current_page' => 1, 'last_page' => 1]])
            ->assertJsonPath('data.0.role_name', 'editor')
            ->assertJsonPath('data.0.users_count', 1)
            ->assertJsonPath('data.0.permissions', ['web-news-view'])
            ->assertJsonPath('data.0.is_protected', false);
    }

    /**
     * @description Search matches name or description and stays inside the trash view;
     *   no_pagination returns a plain array ordered by id.
     * @input Active 'alpha' (desc 'news'), trashed 'beta' (desc 'news'); ?only_trashed=1&search=news,
     *        ?no_pagination=true&search=news.
     * @output Trash search: only beta. Full list search: only alpha (trashed excluded).
     */
    public function test_index_search_trash_and_no_pagination(): void
    {
        $this->role('alpha', [], ['description' => 'news']);
        $this->role('beta', [], ['description' => 'news'])->delete();
        $this->signIn($this->user());

        $this->getJson('/api/core/roles?only_trashed=1&search=news')
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.role_name', 'beta');
        $this->getJson('/api/core/roles?no_pagination=true&search=news')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.role_name', 'alpha');
    }

    /**
     * @description A role detail is available to any signed-in account; unknown id is 404.
     * @input GET /api/core/roles/{id}, /api/core/roles/999.
     * @output 200 with the role; 404.
     */
    public function test_show(): void
    {
        $role = $this->role('viewer');
        $this->signIn($this->user());

        $this->getJson("/api/core/roles/{$role->id}")->assertOk()->assertJsonPath('data.role_name', 'viewer');
        $this->getJson('/api/core/roles/999')->assertStatus(404);
    }

    /**
     * @description Every mutating action is sysadmin-only (403 + denied log).
     * @input Non-sysadmin: store, update, sync, destroy, restore, force-delete-all.
     * @output 403 for all; one *_denied core log each.
     */
    public function test_non_sysadmin_cannot_manage_roles(): void
    {
        $role = $this->role('target');
        $this->signIn($this->userWith(['core-administrators-update']));

        $this->postJson('/api/core/roles', ['role_name' => 'x'])->assertStatus(403);
        $this->putJson("/api/core/roles/{$role->id}", ['role_name' => 'y'])->assertStatus(403);
        $this->putJson("/api/core/roles/{$role->id}/permissions", ['permission_keys' => []])->assertStatus(403);
        $this->deleteJson("/api/core/roles/{$role->id}")->assertStatus(403);
        $this->postJson("/api/core/roles/{$role->id}/restore")->assertStatus(403);
        $this->deleteJson('/api/core/roles/force-delete-all')->assertStatus(403);

        foreach (['create_denied', 'update_denied', 'sync_permissions_denied', 'delete_denied', 'restore_denied', 'force_delete_all_denied'] as $type) {
            $this->assertCoreLog($type);
        }
    }

    /**
     * @description A sysadmin creates a role; the name must be unique.
     * @input Sysadmin: POST {role_name:'editor', forces_2fa:true}, POST {role_name:'editor'}.
     * @output 201 with forces_2fa true, users_count 0; then 422 "This role already exists."
     */
    public function test_sysadmin_creates_role(): void
    {
        $this->signIn($this->sysadmin());

        $this->postJson('/api/core/roles', ['role_name' => 'editor', 'description' => 'd', 'forces_2fa' => true])
            ->assertCreated()
            ->assertJsonPath('data.role_name', 'editor')
            ->assertJsonPath('data.forces_2fa', true)
            ->assertJsonPath('data.users_count', 0);
        $this->assertCoreLog('create', 'Created role: editor');

        $this->postJson('/api/core/roles', ['role_name' => 'editor'])
            ->assertStatus(422)->assertJsonPath('errors.role_name.0', 'This role already exists.');
    }

    /**
     * @description A sysadmin renames a role (keeping its own name is not a duplicate); the
     *   protected sysadmin role cannot be modified.
     * @input Sysadmin: PUT role 'editor' {role_name:'editor', description}; PUT the sysadmin role.
     * @output 200 with the new description; 403 "System role cannot be modified."
     */
    public function test_sysadmin_updates_role(): void
    {
        $admin = $this->signIn($this->sysadmin());
        $role = $this->role('editor');

        $this->putJson("/api/core/roles/{$role->id}", ['role_name' => 'editor', 'description' => 'new'])
            ->assertOk()->assertJsonPath('data.description', 'new');
        $this->assertCoreLog('update', 'Updated role: editor');

        $this->putJson('/api/core/roles/' . $admin->roles->first()->id, ['role_name' => 'sysadmin'])
            ->assertStatus(403)->assertJson(['message' => 'System role cannot be modified.']);
    }

    /**
     * @description The permission matrix replaces the role's permissions; unknown keys are
     *   refused; the sysadmin role is protected.
     * @input Sysadmin: PUT permissions [a, b] on 'editor' (had c); PUT ['nope']; PUT on sysadmin role.
     * @output 200 with permissions [a, b]; 422; 403.
     */
    public function test_sync_permissions(): void
    {
        $admin = $this->signIn($this->sysadmin());
        $role = $this->role('editor', ['c-key']);
        $this->permission('a-key');
        $this->permission('b-key');

        $this->putJson("/api/core/roles/{$role->id}/permissions", ['permission_keys' => ['a-key', 'b-key']])
            ->assertOk()->assertJsonPath('data.permissions', ['a-key', 'b-key']);
        $this->assertCoreLog('sync_permissions', '(2 permissions)');

        $this->putJson("/api/core/roles/{$role->id}/permissions", ['permission_keys' => ['nope']])
            ->assertStatus(422)->assertJsonPath('errors', fn ($e) => isset($e['permission_keys.0']));
        $this->putJson('/api/core/roles/' . $admin->roles->first()->id . '/permissions', ['permission_keys' => []])
            ->assertStatus(403);
    }

    /**
     * @description Deleting: the sysadmin role and roles in use cannot be deleted; an unused
     *   role (also a trashed one) is deleted permanently.
     * @input Sysadmin: DELETE sysadmin role, role with a user, unused role.
     * @output 403, 403 naming the user count, 204 (role gone).
     */
    public function test_destroy(): void
    {
        $admin = $this->signIn($this->sysadmin());
        $used = $this->role('used');
        $this->user([], $used);
        $unused = $this->role('unused');
        $unused->delete();

        $this->deleteJson('/api/core/roles/' . $admin->roles->first()->id)->assertStatus(403);
        $this->deleteJson("/api/core/roles/{$used->id}")
            ->assertStatus(403)->assertJsonPath('message', fn ($m) => str_contains($m, 'assigned to 1 user account(s)'));
        $this->deleteJson("/api/core/roles/{$unused->id}")->assertNoContent();

        $this->assertNull(CoreRole::withTrashed()->find($unused->id));
        $this->assertCoreLog('hard_delete', "Deleted role ID: {$unused->id}");
    }

    /**
     * @description A sysadmin restores a trashed role.
     * @input Trashed role, POST restore.
     * @output 200 with the role; role active again.
     */
    public function test_restore(): void
    {
        $this->signIn($this->sysadmin());
        $role = $this->role('old');
        $role->delete();

        $this->postJson("/api/core/roles/{$role->id}/restore")->assertOk()->assertJsonPath('data.role_name', 'old');

        $this->assertFalse($role->fresh()->trashed());
        $this->assertCoreLog('restore', 'Restored role: old');
    }

    /**
     * @description Emptying the role trash deletes the trashed roles only; a database error answers 500.
     * @input Trashed + active role, DELETE force-delete-all; then core_roles DELETE fails.
     * @output 204, active role kept; then 500 "Emptying trash failed."
     */
    public function test_force_delete_all_trashed(): void
    {
        $this->signIn($this->sysadmin());
        $this->role('trashed')->delete();
        $active = $this->role('active');

        $this->deleteJson('/api/core/roles/force-delete-all')->assertNoContent();
        $this->assertSame(0, CoreRole::onlyTrashed()->count());
        $this->assertNotNull($active->fresh());
        $this->assertCoreLog('force_delete_all', 'Deleted: 1');

        $this->role('again')->delete();
        $this->failOn('core_roles', 'DELETE');
        $this->deleteJson('/api/core/roles/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Emptying trash failed.']);
    }
}
