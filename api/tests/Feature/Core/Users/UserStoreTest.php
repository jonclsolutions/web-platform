<?php

/**
 * @file UserStoreTest.php
 * @path api/tests/Feature/Core/Users/UserStoreTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of creating an administrator account (UserController::store):
 *   e-mail access policy, sysadmin-only sysadmin role, no privilege escalation through the
 *   role or explicit permissions, 2FA forced by the role, activation e-mail and errors.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core\Users;

use App\Mail\Auth\AccountActivationMail;
use App\Models\AccountActivationToken;
use App\Models\Core\CoreSecuritySetting;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * @description POST /api/core/users.
 */
class UserStoreTest extends TestCase
{
    /**
     * @description Makes every mail send fail (unknown transport) - activation e-mail outage.
     * @return void
     */
    private function breakMailer(): void
    {
        config(['mail.default' => 'broken', 'mail.mailers.broken' => ['transport' => 'does-not-exist']]);
    }

    /**
     * @description The request is validated (required fields, unique e-mail, existing role).
     * @input Creator with core-administrators-create, POST with an existing e-mail and an unknown role.
     * @output 422 with the custom messages.
     */
    public function test_store_validates_input(): void
    {
        $creator = $this->signIn($this->userWith(['core-administrators-create']));

        $this->postJson('/api/core/users', ['user_email' => $creator->user_email, 'role_id' => 999])
            ->assertStatus(422)
            ->assertJsonPath('errors.user_email.0', 'An account with this e-mail already exists.')
            ->assertJsonPath('errors.full_name.0', 'Full name is required.')
            ->assertJsonPath('errors.role_id.0', 'The selected role does not exist.');
    }

    /**
     * @description A soft-deleted (trashed) role cannot be assigned on create or update (finding #4).
     * @input Sysadmin; role 'old' moved to the trash; POST and PUT with its id.
     * @output 422 'The selected role does not exist.' both times.
     */
    public function test_trashed_role_cannot_be_assigned(): void
    {
        $this->signIn($this->sysadmin());
        $trashed = $this->role('old');
        $trashed->delete();
        $target = $this->user();

        $this->postJson('/api/core/users', ['user_email' => 'x@example.com', 'full_name' => 'X', 'role_id' => $trashed->id])
            ->assertStatus(422)->assertJsonPath('errors.role_id.0', 'The selected role does not exist.');
        $this->putJson("/api/core/users/{$target->id}", ['role_id' => $trashed->id])
            ->assertStatus(422)->assertJsonPath('errors.role_id.0', 'The selected role does not exist.');
    }

    /**
     * @description A sysadmin creates an account without a password: activation token
     *   issued, activation e-mail sent with the frontend link, role attached, audit logged.
     * @input Sysadmin, POST {user_email, full_name, role_id}.
     * @output 201 {activation_email_sent:true}; password NULL; AccountActivationMail sent.
     */
    public function test_sysadmin_creates_account_and_sends_activation(): void
    {
        Mail::fake();
        config(['app.frontend_url' => 'https://admin.example.com']);
        $this->signIn($this->sysadmin());
        $role = $this->role('editor', ['web-news-view']);

        $response = $this->postJson('/api/core/users', [
            'user_email' => 'new@example.com', 'full_name' => 'New Person', 'role_id' => $role->id, 'dpp_hours_spent' => 3,
        ])->assertCreated()
            ->assertJsonPath('meta.activation_email_sent', true)
            ->assertJsonPath('data.roles.0.role_name', 'editor')
            ->assertJsonPath('data.enable_2fa', false);

        $user = User::where('user_email', 'new@example.com')->sole();
        $this->assertNull($user->user_password_hash);
        $this->assertNull($user->activated_at);
        $this->assertSame(1, AccountActivationToken::where('user_id', $user->id)->count());
        Mail::assertSent(AccountActivationMail::class, fn (AccountActivationMail $mail) => $mail->hasTo('new@example.com')
            && hash('sha256', $mail->rawToken) === AccountActivationToken::sole()->token_hash);
        $this->assertCoreLog('create', 'new@example.com');
        $this->assertSame($user->id, $response->json('data.id'));
    }

    /**
     * @description A role with forces_2fa turns 2FA on for the new account.
     * @input Sysadmin, role with forces_2fa, POST with enable_2fa false.
     * @output 201 with enable_2fa true.
     */
    public function test_role_forcing_2fa_enables_it(): void
    {
        Mail::fake();
        $this->signIn($this->sysadmin());
        $role = $this->role('secure', [], ['forces_2fa' => true]);

        $this->postJson('/api/core/users', [
            'user_email' => 'secure@example.com', 'full_name' => 'Secure', 'role_id' => $role->id, 'enable_2fa' => false,
        ])->assertCreated()->assertJsonPath('data.enable_2fa', true);
    }

    /**
     * @description An e-mail outside the e-mail access policy is refused and recorded.
     * @input Primary domain company.cz, POST user_email x@other.cz.
     * @output 422 naming the domain; user_create_domain_not_whitelisted event; create_denied log.
     */
    public function test_store_enforces_email_policy(): void
    {
        $this->signIn($this->sysadmin());
        CoreSecuritySetting::current()->update(['primary_email_domain' => 'company.cz']);

        $this->postJson('/api/core/users', ['user_email' => 'X@Other.cz', 'full_name' => 'X'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'The e-mail domain "other.cz" is not allowed for creating new accounts. Contact sysadmin to add an exception.');

        $this->assertSecurityEvent('user_create_domain_not_whitelisted');
        $this->assertCoreLog('create_denied', 'x@other.cz');
        $this->assertFalse(User::where('user_email', 'X@Other.cz')->exists());
    }

    /**
     * @description Only a sysadmin may create a sysadmin account.
     * @input Creator with core-administrators-create (not sysadmin), POST with the sysadmin role.
     * @output 403; create_denied log; no account.
     */
    public function test_only_sysadmin_creates_sysadmin(): void
    {
        $sysadminRole = $this->role('sysadmin');
        $this->signIn($this->userWith(['core-administrators-create']));

        $this->postJson('/api/core/users', ['user_email' => 'evil@example.com', 'full_name' => 'E', 'role_id' => $sysadminRole->id])
            ->assertStatus(403);

        $this->assertCoreLog('create_denied', 'sysadmin');
        $this->assertFalse(User::where('user_email', 'evil@example.com')->exists());
    }

    /**
     * @description A creator cannot hand out a role that grants more than the creator has.
     * @input Creator with only core-administrators-create, role granting core-security-delete.
     * @output 403 "You cannot assign a role…"; no account.
     */
    public function test_cannot_assign_more_powerful_role(): void
    {
        $this->signIn($this->userWith(['core-administrators-create']));
        $role = $this->role('powerful', ['core-security-delete']);

        $this->postJson('/api/core/users', ['user_email' => 'p@example.com', 'full_name' => 'P', 'role_id' => $role->id])
            ->assertStatus(403)
            ->assertJsonPath('message', 'You cannot assign a role that grants permissions you do not yourself have.');
    }

    /**
     * @description A role within the creator's own permissions may be assigned; a
     *   soft-deleted role counts as unknown and is refused by the validation (finding #4).
     * @input Creator with create + web-news-view; role 'reader' (web-news-view); trashed role.
     * @output 201 for 'reader'; 422 for the trashed role.
     */
    public function test_can_assign_role_within_own_permissions(): void
    {
        Mail::fake();
        $this->signIn($this->userWith(['core-administrators-create', 'web-news-view']));
        $reader = $this->role('reader', ['web-news-view']);
        $trashed = $this->role('old-role');
        $trashed->delete();

        $this->postJson('/api/core/users', ['user_email' => 'r@example.com', 'full_name' => 'R', 'role_id' => $reader->id])
            ->assertCreated();
        $this->postJson('/api/core/users', ['user_email' => 't@example.com', 'full_name' => 'T', 'role_id' => $trashed->id])
            ->assertStatus(422)->assertJsonPath('errors.role_id.0', 'The selected role does not exist.');
    }

    /**
     * @description An account whose role was moved to the trash later keeps no 2FA enforcement
     *   from it - the trashed role is treated as an unknown role for the 2FA decision (it can no
     *   longer be ASSIGNED, finding #4, but existing accounts may still reference it).
     * @input Account with role 'retired' (forces_2fa) + 2FA on; role trashed; sysadmin PUT enable_2fa false.
     * @output 200 with enable_2fa false.
     */
    public function test_trashed_role_does_not_force_2fa(): void
    {
        $this->signIn($this->sysadmin());
        $role = $this->role('retired', [], ['forces_2fa' => true]);
        $account = $this->user(['enable_2fa' => true], $role);
        $role->delete();

        $this->putJson("/api/core/users/{$account->id}", ['enable_2fa' => false])
            ->assertOk()->assertJsonPath('data.enable_2fa', false);
    }

    /**
     * @description Explicit permissions are limited to what the creator holds and are not
     *   stored when the role already grants them; ids are normalized (non-numeric dropped).
     * @input Creator with create + web-news-view + web-news-update; role grants web-news-view;
     *        permission_ids [view, update, core-security-delete, 'x'].
     * @output 201; only web-news-update stored as explicit grant (granted_by = creator).
     */
    public function test_explicit_permissions_are_bounded(): void
    {
        Mail::fake();
        $creator = $this->signIn($this->userWith(['core-administrators-create', 'web-news-view', 'web-news-update']));
        $role = $this->role('reader', ['web-news-view']);
        $foreign = $this->permission('core-security-delete');

        $this->postJson('/api/core/users', [
            'user_email' => 'e@example.com', 'full_name' => 'E', 'role_id' => $role->id,
            'permission_ids' => [$this->permission('web-news-view')->id, (string) $this->permission('web-news-update')->id, $foreign->id, 'x'],
        ])->assertCreated()->assertJsonPath('data.user_permissions', ['web-news-update']);

        $user = User::where('user_email', 'e@example.com')->sole();
        $this->assertSame($creator->id, (int) $user->explicitPermissions()->sole()->pivot->granted_by);
        $this->assertCoreLog('update', 'Explicit permissions updated for: e@example.com (1 active grant(s))');
    }

    /**
     * @description A sysadmin may grant any permission to an account without a role.
     * @input Sysadmin, POST without role_id, permission_ids [core-security-delete].
     * @output 201 with user_permissions [core-security-delete].
     */
    public function test_sysadmin_grants_any_permission_without_role(): void
    {
        Mail::fake();
        $this->signIn($this->sysadmin());

        $this->postJson('/api/core/users', [
            'user_email' => 'n@example.com', 'full_name' => 'N', 'permission_ids' => [$this->permission('core-security-delete')->id],
        ])->assertCreated()->assertJsonPath('data.user_permissions', ['core-security-delete']);
    }

    /**
     * @description When the activation e-mail cannot be sent the account still exists; the
     *   answer and the audit log say the e-mail failed.
     * @input Sysadmin, mailer broken, POST a valid account.
     * @output 201 {activation_email_sent:false}; log mentions the failed e-mail.
     */
    public function test_activation_mail_failure_is_reported(): void
    {
        $this->breakMailer();
        $this->signIn($this->sysadmin());

        $this->postJson('/api/core/users', ['user_email' => 'm@example.com', 'full_name' => 'M'])
            ->assertCreated()
            ->assertJsonPath('meta.activation_email_sent', false);

        $this->assertCoreLog('create', 'ACTIVATION E-MAIL FAILED TO SEND');
    }

    /**
     * @description A database error while creating rolls back and answers 500.
     * @input Sysadmin, role attach fails (user_roles INSERT error), POST with a role.
     * @output 500 "Error creating user."; no account; error log.
     */
    public function test_store_database_error_rolls_back(): void
    {
        $this->signIn($this->sysadmin());
        $role = $this->role('editor');
        $this->failOn('user_roles', 'INSERT');

        $this->postJson('/api/core/users', ['user_email' => 'f@example.com', 'full_name' => 'F', 'role_id' => $role->id])
            ->assertStatus(500)
            ->assertJson(['message' => 'Error creating user.']);

        $this->assertFalse(User::where('user_email', 'f@example.com')->exists());
        $this->assertCoreLog('error', 'Error creating user');
    }
}
