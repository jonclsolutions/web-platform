<?php

/**
 * @file UserListTest.php
 * @path api/tests/Feature/Core/Users/UserListTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the administrators list and detail (UserController index /
 *   show): permission, filters, global search, trash view, sorting and export.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core\Users;

use Tests\TestCase;

/**
 * @description GET /api/core/users and GET /api/core/users/{id}.
 */
class UserListTest extends TestCase
{
    /**
     * @description Without core-administrators-view the list is refused.
     * @input Signed-in account without permissions, GET /api/core/users.
     * @output 403; permission_denied event.
     */
    public function test_index_requires_permission(): void
    {
        $this->signIn($this->user());

        $this->getJson('/api/core/users')->assertStatus(403);

        $this->assertSecurityEvent('permission_denied');
    }

    /**
     * @description The default list is paginated, newest first, without trashed accounts.
     * @input Viewer + 2 accounts + 1 soft-deleted account, GET ?per_page=2.
     * @output 200 {data(2), total 3, per_page 2, current_page 1, last_page 2}, highest id first.
     */
    public function test_index_paginates_without_trashed(): void
    {
        $this->signIn($this->userWith(['core-administrators-view']));
        $a = $this->user();
        $b = $this->user();
        $this->user()->delete();

        $this->getJson('/api/core/users?per_page=2')
            ->assertOk()
            ->assertJson(['total' => 3, 'per_page' => 2, 'current_page' => 1, 'last_page' => 2])
            ->assertJsonPath('data.0.id', $b->id)
            ->assertJsonPath('data.1.id', $a->id);
    }

    /**
     * @description only_trashed (or is_deleted) shows only the trash.
     * @input 1 active and 1 soft-deleted account, GET ?only_trashed=true and ?is_deleted=1.
     * @output 200 with only the deleted account in both cases.
     */
    public function test_index_trash_view(): void
    {
        $this->signIn($this->userWith(['core-administrators-view']));
        $deleted = $this->user();
        $deleted->delete();

        foreach (['only_trashed=true', 'is_deleted=1'] as $query) {
            $this->getJson("/api/core/users?{$query}")
                ->assertOk()
                ->assertJsonPath('total', 1)
                ->assertJsonPath('data.0.id', $deleted->id);
        }
    }

    /**
     * @description Column filters (full_name, user_email, role_id, is_blocked) narrow the list.
     * @input Accounts with distinct names, e-mails, roles and block state.
     * @output Each filter returns exactly the matching account.
     */
    public function test_index_column_filters(): void
    {
        $this->signIn($this->sysadmin(['full_name' => 'Root', 'user_email' => 'root@example.com']));
        $editor = $this->role('editor');
        $alice = $this->user(['full_name' => 'Alice Novak', 'user_email' => 'alice@corp.cz'], $editor);
        $bob = $this->user(['full_name' => 'Bob Dvorak', 'user_email' => 'bob@corp.cz', 'is_blocked' => true]);

        $this->getJson('/api/core/users?full_name=Novak')->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $alice->id);
        $this->getJson('/api/core/users?user_email=bob@')->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $bob->id);
        $this->getJson("/api/core/users?role_id={$editor->id}")->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $alice->id);
        $this->getJson('/api/core/users?is_blocked=true')->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $bob->id);
    }

    /**
     * @description The global search matches name OR e-mail but stays inside the trash scope.
     * @input Active 'Carl' (carl@x.cz), deleted 'Carla', GET ?search=carl.
     * @output Only the active account (the OR does not break out of the trashed scope).
     */
    public function test_index_search_respects_trash_scope(): void
    {
        $this->signIn($this->userWith(['core-administrators-view']));
        $carl = $this->user(['full_name' => 'Somebody', 'user_email' => 'carl@x.cz']);
        $this->user(['full_name' => 'Carla'])->delete();

        $this->getJson('/api/core/users?search=carl')
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $carl->id);
    }

    /**
     * @description Sorting by role name joins the role table; other columns sort on users.
     * @input Accounts with roles 'b-role' and 'a-role', sort_by=role_name asc, sort_by=users.full_name asc.
     * @output Order by role name, then by full name.
     */
    public function test_index_sorting(): void
    {
        $this->signIn($this->userWith(['core-administrators-view'], ['full_name' => 'Zed']));
        $first = $this->user(['full_name' => 'Anna'], $this->role('b-role'));
        $second = $this->user(['full_name' => 'Bara'], $this->role('a-role'));

        $byRole = $this->getJson('/api/core/users?sort_by=role_name&sort_direction=asc&no_pagination=true')->assertOk()->json();
        $this->assertSame([$second->id, $first->id], array_slice(array_column($byRole, 'id'), 0, 2));

        $this->getJson('/api/core/users?sort_by=users.full_name&sort_direction=asc')
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.1.id', $second->id);

        $this->getJson('/api/core/users?sort_by=full_name&sort_direction=bogus')
            ->assertJsonPath('data.0.full_name', 'Zed');
    }

    /**
     * @description no_pagination returns the full list (export) and writes an audit entry.
     * @input 2 accounts, GET ?no_pagination=true.
     * @output 200 plain array with both accounts incl. roles/permissions; core log 'export'.
     */
    public function test_index_export(): void
    {
        $viewer = $this->signIn($this->userWith(['core-administrators-view']));

        $this->getJson('/api/core/users?no_pagination=true')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $viewer->id)
            ->assertJsonPath('0.permissions', ['core-administrators-view']);

        $this->assertCoreLog('export', 'Bulk export of users.');
    }

    /**
     * @description The detail validates the id and includes trashed accounts.
     * @input GET /api/core/users/abc and /api/core/users/{deleted id}.
     * @output 422 for the invalid id; 200 with deleted_at for the trashed account.
     */
    public function test_show(): void
    {
        $this->signIn($this->userWith(['core-administrators-view']));
        $deleted = $this->user();
        $deleted->delete();

        $this->getJson('/api/core/users/abc')->assertStatus(422);
        $this->getJson("/api/core/users/{$deleted->id}")
            ->assertOk()
            ->assertJsonPath('id', $deleted->id)
            ->assertJsonPath('deleted_at', fn ($v) => $v !== null);
    }

    /**
     * @description Everyone may read their own account even without the view permission
     *   (route parameter self-match in CheckPermission).
     * @input Account without permissions, GET /api/core/users/{own id}.
     * @output 200.
     */
    public function test_show_own_account_without_permission(): void
    {
        $me = $this->signIn($this->user());

        $this->getJson("/api/core/users/{$me->id}")->assertOk()->assertJsonPath('id', $me->id);
    }
}
