<?php

/**
 * @file UserUpdateTest.php
 * @path api/tests/Feature/Core/Users/UserUpdateTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of editing an administrator account (UserController::update):
 *   sysadmin protection, sysadmin-only changes on other accounts (login e-mail, blocking,
 *   2FA override), e-mail access policy, own role, role assignment limits, enforced 2FA,
 *   explicit permissions, blocking side effects and error handling.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core\Users;

use App\Models\Core\CoreSecuritySetting;
use App\Models\RefreshToken;
use App\Models\User;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * @description PUT /api/core/users/{id}.
 */
class UserUpdateTest extends TestCase
{
    /**
     * @description An editor: role with core-administrators-update (+ extra permissions).
     * @param string[] $extra Additional permission keys.
     * @return User The signed-in editor.
     */
    private function editor(array $extra = []): User
    {
        return $this->signIn($this->userWith(array_merge(['core-administrators-update'], $extra)));
    }

    /**
     * @description A non-numeric id is refused; an unknown id is 404.
     * @input PUT /api/core/users/abc and /api/core/users/999 as sysadmin.
     * @output 422 and 404.
     */
    public function test_update_validates_id(): void
    {
        $this->signIn($this->sysadmin());

        $this->putJson('/api/core/users/abc', [])->assertStatus(422);
        $this->putJson('/api/core/users/999', [])->assertStatus(404);
    }

    /**
     * @description A plain edit saves the fields and answers with the updated account.
     * @input Editor, PUT {full_name, internal_note, dpp_hours_spent} on another account.
     * @output 200 with the new values; 'update' core log.
     */
    public function test_editor_updates_basic_fields(): void
    {
        $this->editor();
        $target = $this->user();

        $this->putJson("/api/core/users/{$target->id}", ['full_name' => 'Renamed', 'internal_note' => 'n', 'dpp_hours_spent' => 4])
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Renamed')
            ->assertJsonPath('data.dpp_hours_spent', 4);

        $this->assertCoreLog('update', 'User updated: ' . $target->user_email);
    }

    /**
     * @description A non-sysadmin cannot edit a sysadmin account.
     * @input Editor, PUT on a sysadmin account.
     * @output 403; update_denied log "Denied edit of sysadmin account".
     */
    public function test_cannot_edit_sysadmin_account(): void
    {
        $admin = $this->sysadmin();
        $this->editor();

        $this->putJson("/api/core/users/{$admin->id}", ['full_name' => 'X'])->assertStatus(403);

        $this->assertCoreLog('update_denied', 'Denied edit of sysadmin account');
    }

    /**
     * @description A non-sysadmin cannot promote an account to sysadmin.
     * @input Editor, sysadmin role exists, PUT {role_id: sysadmin} on another account.
     * @output 403; update_denied log "promote".
     */
    public function test_cannot_promote_to_sysadmin(): void
    {
        $role = $this->role('sysadmin');
        $this->editor();
        $target = $this->user();

        $this->putJson("/api/core/users/{$target->id}", ['role_id' => $role->id])->assertStatus(403);

        $this->assertCoreLog('update_denied', 'promote account to sysadmin');
    }

    /**
     * @description Only a sysadmin may change another account's login e-mail; sending the
     *   stored e-mail back unchanged is fine.
     * @input Editor, PUT {user_email: new} and PUT {user_email: same} on another account.
     * @output 403 for the change, 200 for the unchanged value.
     */
    public function test_only_sysadmin_changes_other_login_email(): void
    {
        $this->editor();
        $target = $this->user();

        $this->putJson("/api/core/users/{$target->id}", ['user_email' => 'new@example.com'])->assertStatus(403);
        $this->assertCoreLog('update_denied', "login e-mail");
        $this->putJson("/api/core/users/{$target->id}", ['user_email' => $target->user_email])->assertOk();
    }

    /**
     * @description Everyone may change their own login e-mail.
     * @input Editor, PUT {user_email: new} on the own account.
     * @output 200 with the new e-mail.
     */
    public function test_own_login_email_can_change(): void
    {
        $me = $this->editor();

        $this->putJson("/api/core/users/{$me->id}", ['user_email' => 'mine@example.com'])
            ->assertOk()->assertJsonPath('data.user_email', 'mine@example.com');
    }

    /**
     * @description Only a sysadmin may block or unblock; sending the current state is fine.
     * @input Editor, PUT {is_blocked:true} and {is_blocked:false} on an unblocked account.
     * @output 403 for blocking, 200 for the unchanged value.
     */
    public function test_only_sysadmin_blocks(): void
    {
        $this->editor();
        $target = $this->user();

        $this->putJson("/api/core/users/{$target->id}", ['is_blocked' => true])->assertStatus(403);
        $this->assertCoreLog('update_denied', 'block or unblock');
        $this->putJson("/api/core/users/{$target->id}", ['is_blocked' => false])->assertOk();
    }

    /**
     * @description A new login e-mail must pass the e-mail access policy - also for a sysadmin;
     *   a case-only difference is not a change.
     * @input Primary domain company.cz, sysadmin, target a@company.cz: PUT x@other.cz, then A@Company.cz.
     * @output 422 naming the domain + user_update_domain_not_whitelisted event; then 200.
     */
    public function test_new_login_email_must_pass_policy(): void
    {
        $this->signIn($this->sysadmin(['user_email' => 'root@company.cz']));
        $target = $this->user(['user_email' => 'a@company.cz']);
        CoreSecuritySetting::current()->update(['primary_email_domain' => 'company.cz']);

        $this->putJson("/api/core/users/{$target->id}", ['user_email' => 'x@other.cz'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'The e-mail domain "other.cz" is not allowed as a login e-mail. Contact sysadmin to add an exception.');
        $this->assertSecurityEvent('user_update_domain_not_whitelisted');
        $this->assertCoreLog('update_denied', 'non-whitelisted domain: x@other.cz');

        $this->putJson("/api/core/users/{$target->id}", ['user_email' => 'A@Company.cz'])->assertOk();
    }

    /**
     * @description Nobody may change their own role; sending the current role back is fine.
     * @input Editor with role R1, PUT {role_id: R2} then {role_id: R1} on the own account.
     * @output 422 "You cannot change your own role."; then 200.
     */
    public function test_cannot_change_own_role(): void
    {
        $me = $this->editor();
        $other = $this->role('other');

        $this->putJson("/api/core/users/{$me->id}", ['role_id' => $other->id])
            ->assertStatus(422)->assertJson(['message' => 'You cannot change your own role.']);
        $this->putJson("/api/core/users/{$me->id}", ['role_id' => $me->roles->first()->id])->assertOk();
    }

    /**
     * @description A role change to a role with more permissions than the editor holds is refused.
     * @input Editor (update only), role granting core-security-delete, PUT {role_id} on another account.
     * @output 403; update_denied log.
     */
    public function test_cannot_assign_more_powerful_role(): void
    {
        $this->editor();
        $target = $this->user([], $this->role('plain'));
        $powerful = $this->role('powerful', ['core-security-delete']);

        $this->putJson("/api/core/users/{$target->id}", ['role_id' => $powerful->id])->assertStatus(403);

        $this->assertCoreLog('update_denied', "more than the actor's own permissions");
    }

    /**
     * @description A real role change syncs the role and wipes all explicit grants before
     *   the requested ones are applied.
     * @input Editor with web-news-view; target with explicit grant web-news-view and role 'a';
     *        PUT {role_id: 'b'} (no permissions).
     * @output 200 with role 'b'; no explicit grants left; core log about the reset.
     */
    public function test_role_change_resets_explicit_permissions(): void
    {
        $this->editor(['web-news-view']);
        $target = $this->user([], $this->role('a'));
        $target->explicitPermissions()->attach($this->permission('web-news-view')->id);
        $b = $this->role('b');

        $this->putJson("/api/core/users/{$target->id}", ['role_id' => $b->id])
            ->assertOk()
            ->assertJsonPath('data.roles.0.role_name', 'b')
            ->assertJsonPath('data.user_permissions', []);

        $this->assertCoreLog('update', 'all explicit permission grants were reset to zero');
    }

    /**
     * @description Explicit permissions: the editor can only add/remove what it holds itself;
     *   grants outside its authority stay, grants covered by the role are not stored.
     * @input Editor with web-news-view + web-news-update; target role grants web-news-view and
     *        has an explicit core-security-view (granted by a sysadmin earlier);
     *        PUT {permission_ids: [web-news-view, web-news-update]}.
     * @output 200; explicit grants = core-security-view + web-news-update.
     */
    public function test_explicit_permissions_within_authority(): void
    {
        $this->editor(['web-news-view', 'web-news-update']);
        $target = $this->user([], $this->role('reader', ['web-news-view']));
        $target->explicitPermissions()->attach($this->permission('core-security-view')->id);

        $response = $this->putJson("/api/core/users/{$target->id}", [
            'permission_ids' => [$this->permission('web-news-view')->id, $this->permission('web-news-update')->id],
        ])->assertOk();

        $this->assertEqualsCanonicalizing(['core-security-view', 'web-news-update'], $response->json('data.user_permissions'));
    }

    /**
     * @description Enforced 2FA (role or sysadmin override) cannot be switched off.
     * @input Target whose role has forces_2fa; editor PUT {enable_2fa:false}.
     * @output 422 "cannot be disabled"; update_denied log.
     */
    public function test_cannot_disable_enforced_2fa(): void
    {
        $this->editor();
        $target = $this->user(['enable_2fa' => true], $this->role('secure', [], ['forces_2fa' => true]));

        $this->putJson("/api/core/users/{$target->id}", ['enable_2fa' => false])->assertStatus(422);

        $this->assertCoreLog('update_denied', 'disable 2FA');
    }

    /**
     * @description When 2FA is enforced, saving without enable_2fa keeps/sets it on.
     * @input Target with two_fa_forced_by_admin and enable_2fa false; editor PUT {full_name}.
     * @output 200 with enable_2fa true.
     */
    public function test_enforced_2fa_is_switched_on(): void
    {
        $this->editor();
        $target = $this->user(['two_fa_forced_by_admin' => true, 'enable_2fa' => false]);

        $this->putJson("/api/core/users/{$target->id}", ['full_name' => 'Kept'])->assertOk()->assertJsonPath('data.enable_2fa', true);
    }

    /**
     * @description Only a sysadmin may change the 2FA override.
     * @input Editor, PUT {two_fa_forced_by_admin:true} on another account.
     * @output 403 "Only sysadmin may change 2FA enforcement."
     */
    public function test_only_sysadmin_changes_2fa_override(): void
    {
        $this->editor();
        $target = $this->user();

        $this->putJson("/api/core/users/{$target->id}", ['two_fa_forced_by_admin' => true])
            ->assertStatus(403)->assertJson(['message' => 'Only sysadmin may change 2FA enforcement.']);
    }

    /**
     * @description The override is refused when the role already forces 2FA; otherwise a
     *   sysadmin can set it.
     * @input Sysadmin; target A with a forcing role, target B without; PUT {two_fa_forced_by_admin:true}.
     * @output 422 for A; 200 with two_fa_forced_by_admin and enable_2fa true for B.
     */
    public function test_sysadmin_sets_2fa_override(): void
    {
        $this->signIn($this->sysadmin());
        $a = $this->user([], $this->role('secure', [], ['forces_2fa' => true]));
        $b = $this->user();

        $this->putJson("/api/core/users/{$a->id}", ['two_fa_forced_by_admin' => true])->assertStatus(422);
        $this->putJson("/api/core/users/{$b->id}", ['two_fa_forced_by_admin' => true])
            ->assertOk()
            ->assertJsonPath('data.two_fa_forced_by_admin', true)
            ->assertJsonPath('data.enable_2fa', true);
    }

    /**
     * @description A sysadmin cannot block its own account.
     * @input Sysadmin, PUT {is_blocked:true} on itself.
     * @output 422 "You cannot block your own account."
     */
    public function test_cannot_block_self(): void
    {
        $me = $this->signIn($this->sysadmin());

        $this->putJson("/api/core/users/{$me->id}", ['is_blocked' => true])
            ->assertStatus(422)->assertJson(['message' => 'You cannot block your own account.']);
    }

    /**
     * @description Sysadmin accounts can never be blocked - neither one that has the role
     *   nor one that is being moved onto it in the same request.
     * @input Sysadmin; target 1 sysadmin; target 2 plain account with role_id sysadmin + is_blocked.
     * @output 422 for both; update_denied log "protected account".
     */
    public function test_sysadmin_accounts_cannot_be_blocked(): void
    {
        $this->signIn($this->sysadmin());
        $other = $this->sysadmin();
        $plain = $this->user();
        $sysadminRoleId = $other->roles->first()->id;

        $this->putJson("/api/core/users/{$other->id}", ['is_blocked' => true])->assertStatus(422);
        $this->putJson("/api/core/users/{$plain->id}", ['is_blocked' => true, 'role_id' => $sysadminRoleId])->assertStatus(422);

        $this->assertCoreLog('update_denied', 'protected account');
    }

    /**
     * @description Blocking revokes every access and refresh token of the account at once.
     * @input Sysadmin, target (no role) with an access + refresh token, PUT {is_blocked:true}.
     * @output 200 is_blocked true; no tokens left; account_blocked log.
     */
    public function test_blocking_revokes_tokens(): void
    {
        $this->signIn($this->sysadmin());
        $target = $this->user();
        $target->createToken('access-token');
        RefreshToken::create(['user_id' => $target->id, 'token' => hash('sha256', 'r'), 'expires_at' => now()->addDay()]);

        $this->putJson("/api/core/users/{$target->id}", ['is_blocked' => true])->assertOk()->assertJsonPath('data.is_blocked', true);

        $this->assertSame(0, PersonalAccessToken::where('tokenable_id', $target->id)->count());
        $this->assertSame(0, RefreshToken::count());
        $this->assertCoreLog('account_blocked', $target->user_email);
    }

    /**
     * @description A sysadmin moves an account onto another role (any role allowed).
     * @input Sysadmin, target with role 'a', PUT {role_id: 'b' granting core-security-delete}.
     * @output 200 with role 'b'.
     */
    public function test_sysadmin_changes_role(): void
    {
        $this->signIn($this->sysadmin());
        $target = $this->user([], $this->role('a'));
        $b = $this->role('b', ['core-security-delete']);

        $this->putJson("/api/core/users/{$target->id}", ['role_id' => $b->id])->assertOk()->assertJsonPath('data.roles.0.role_name', 'b');
    }

    /**
     * @description A database error while saving rolls back and answers 500.
     * @input Sysadmin, users UPDATE fails, PUT {full_name}.
     * @output 500 "Server error while saving."; error log.
     */
    public function test_update_database_error(): void
    {
        $this->signIn($this->sysadmin());
        $target = $this->user();
        $this->failOn('users', 'UPDATE');

        $this->putJson("/api/core/users/{$target->id}", ['full_name' => 'Boom'])
            ->assertStatus(500)->assertJson(['message' => 'Server error while saving.']);

        $this->assertCoreLog('error', "Error updating user ID {$target->id}");
    }
}
