<?php

/**
 * @file UserAccountActionsTest.php
 * @path api/tests/Feature/Core/Users/UserAccountActionsTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the account actions of UserController: password change,
 *   restore, delete (soft / hard), emptying the trash and resending the activation e-mail.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core\Users;

use App\Mail\Auth\AccountActivationMail;
use App\Mail\Auth\PasswordChangedNotification;
use App\Models\AccountActivationToken;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * @description PUT change-password, POST restore, DELETE, DELETE force-delete-all, POST resend-activation.
 */
class UserAccountActionsTest extends TestCase
{
    /** @var string A password that satisfies the policy. */
    private const NEW_PASSWORD = 'Changed1!';

    /**
     * @description Request body of a password change.
     * @param string|null $oldPassword Confirmation password (default: the test default).
     * @return array<string, string>
     */
    private function passwordPayload(?string $oldPassword = null): array
    {
        return [
            'old_password' => $oldPassword ?? $this->defaultPassword,
            'new_password' => self::NEW_PASSWORD,
            'new_password_confirmation' => self::NEW_PASSWORD,
        ];
    }

    /**
     * @description Makes every mail send fail (unknown transport).
     * @return void
     */
    private function breakMailer(): void
    {
        config(['mail.default' => 'broken', 'mail.mailers.broken' => ['transport' => 'does-not-exist']]);
    }

    /**
     * @description The password change validates the id, the account and the new password.
     * @input Own account: PUT /abc, PUT /999 (sysadmin), PUT own with a weak password.
     * @output 422, 404, 422 with new_password error.
     */
    public function test_change_password_validation(): void
    {
        $me = $this->signIn($this->sysadmin());

        $this->putJson('/api/core/users/abc/change-password', $this->passwordPayload())->assertStatus(422);
        $this->putJson('/api/core/users/999/change-password', $this->passwordPayload())->assertStatus(404);
        $this->putJson("/api/core/users/{$me->id}/change-password", ['old_password' => 'x', 'new_password' => 'weak'])
            ->assertStatus(422)->assertJsonValidationErrors(['new_password']);
    }

    /**
     * @description Everyone may change their own password (confirmed with the current one);
     *   a notification is mailed.
     * @input Account without permissions, PUT own change-password.
     * @output 200; new password works; PasswordChangedNotification sent; 'PasswordChanged' log.
     */
    public function test_change_own_password(): void
    {
        Mail::fake();
        $me = $this->signIn($this->user());

        $this->putJson("/api/core/users/{$me->id}/change-password", $this->passwordPayload())->assertOk();

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $me->fresh()->user_password_hash));
        Mail::assertSent(PasswordChangedNotification::class, fn ($mail) => $mail->hasTo($me->user_email));
        $this->assertCoreLog('PasswordChanged', $me->user_email);
    }

    /**
     * @description A wrong confirmation password is refused.
     * @input Own account, old_password wrong.
     * @output 403 "Your confirmation (current) password is incorrect."
     */
    public function test_change_password_requires_current_password(): void
    {
        $me = $this->signIn($this->user());

        $this->putJson("/api/core/users/{$me->id}/change-password", $this->passwordPayload('wrong'))
            ->assertStatus(403)->assertJson(['message' => 'Your confirmation (current) password is incorrect.']);
    }

    /**
     * @description Someone else's password: only a sysadmin, confirmed with the sysadmin's password.
     * @input Editor (update permission) and sysadmin change another account's password.
     * @output 403 for the editor (password_change_denied log); 200 for the sysadmin
     *   (log "performed by sysadmin").
     */
    public function test_only_sysadmin_changes_other_password(): void
    {
        Mail::fake();
        $target = $this->user();

        $this->signIn($this->userWith(['core-administrators-update']));
        $this->putJson("/api/core/users/{$target->id}/change-password", $this->passwordPayload())->assertStatus(403);
        $this->assertCoreLog('password_change_denied', $target->user_email);

        $this->signIn($this->sysadmin());
        $this->putJson("/api/core/users/{$target->id}/change-password", $this->passwordPayload())->assertOk();
        $this->assertCoreLog('PasswordChanged', 'performed by sysadmin');
    }

    /**
     * @description The notification is rate limited per account (no mail flood).
     * @input 5 counted notifications for the account, then a password change.
     * @output 200; no mail; password_notification_rate_limited log.
     */
    public function test_password_notification_is_rate_limited(): void
    {
        Mail::fake();
        $me = $this->signIn($this->user());
        foreach (range(1, 5) as $i) {
            RateLimiter::hit('password-change-notify:' . $me->id, 3600);
        }

        $this->putJson("/api/core/users/{$me->id}/change-password", $this->passwordPayload())->assertOk();

        Mail::assertNothingSent();
        $this->assertCoreLog('password_notification_rate_limited');
    }

    /**
     * @description A mail outage does not fail the password change - it is only logged.
     * @input Mailer broken, own password change.
     * @output 200; Log::error "Password changed notification failed".
     */
    public function test_password_notification_mail_failure_is_logged(): void
    {
        $this->breakMailer();
        Log::spy();
        $me = $this->signIn($this->user());

        $this->putJson("/api/core/users/{$me->id}/change-password", $this->passwordPayload())->assertOk();

        Log::shouldHaveReceived('error')->withArgs(fn ($message) => str_contains($message, 'Password changed notification failed'));
    }

    /**
     * @description A database error while saving the password answers 500.
     * @input Own account, users UPDATE fails.
     * @output 500 "Password change failed."; error log.
     */
    public function test_change_password_database_error(): void
    {
        $me = $this->signIn($this->user());
        $this->failOn('users', 'UPDATE');

        $this->putJson("/api/core/users/{$me->id}/change-password", $this->passwordPayload())
            ->assertStatus(500)->assertJson(['message' => 'Password change failed.']);
        $this->assertCoreLog('error', 'Error changing password');
    }

    /**
     * @description Restore brings a soft-deleted account back; invalid / unknown ids fail.
     * @input Deleter (core-administrators-delete): restore /abc, /999, /{deleted}.
     * @output 422, 404, 200 with deleted_at null; 'restore' log.
     */
    public function test_restore(): void
    {
        $this->signIn($this->userWith(['core-administrators-delete']));
        $deleted = $this->user();
        $deleted->delete();

        $this->postJson('/api/core/users/abc/restore')->assertStatus(422);
        $this->postJson('/api/core/users/999/restore')->assertStatus(404);
        $this->postJson("/api/core/users/{$deleted->id}/restore")->assertOk()->assertJsonPath('deleted_at', null);
        $this->assertCoreLog('restore', $deleted->user_email);
    }

    /**
     * @description A database error during restore answers 500.
     * @input Deleted account, users UPDATE fails.
     * @output 500 "Restoring user failed."
     */
    public function test_restore_database_error(): void
    {
        $this->signIn($this->sysadmin());
        $deleted = $this->user();
        $deleted->delete();
        $this->failOn('users', 'UPDATE');

        $this->postJson("/api/core/users/{$deleted->id}/restore")->assertStatus(500)->assertJson(['message' => 'Restoring user failed.']);
    }

    /**
     * @description Delete: invalid id, unknown id, own account, sysadmin protection.
     * @input Deleter: DELETE /abc, /999, own id, a sysadmin account.
     * @output 422, 404, 403 own, 403 sysadmin (delete_denied log).
     */
    public function test_destroy_guards(): void
    {
        $admin = $this->sysadmin();
        $me = $this->signIn($this->userWith(['core-administrators-delete']));

        $this->deleteJson('/api/core/users/abc')->assertStatus(422);
        $this->deleteJson('/api/core/users/999')->assertStatus(404);
        $this->deleteJson("/api/core/users/{$me->id}")->assertStatus(403)->assertJson(['message' => 'You cannot delete your own account.']);
        $this->deleteJson("/api/core/users/{$admin->id}")->assertStatus(403);
        $this->assertCoreLog('delete_denied', $admin->user_email);
    }

    /**
     * @description Soft delete moves the account to the trash, force_delete removes it.
     * @input Sysadmin: DELETE target A, DELETE target B ?force_delete=true.
     * @output 204 both; A trashed, B gone; soft_delete / hard_delete logs.
     */
    public function test_destroy_soft_and_hard(): void
    {
        $this->signIn($this->sysadmin());
        $a = $this->user();
        $b = $this->user();

        $this->deleteJson("/api/core/users/{$a->id}")->assertNoContent();
        $this->deleteJson("/api/core/users/{$b->id}?force_delete=true")->assertNoContent();

        $this->assertSoftDeleted($a);
        $this->assertNull(User::withTrashed()->find($b->id));
        $this->assertCoreLog('soft_delete');
        $this->assertCoreLog('hard_delete');
    }

    /**
     * @description A database error while deleting answers 500.
     * @input Sysadmin, users UPDATE fails (soft delete is an UPDATE).
     * @output 500 "Deleting user failed."
     */
    public function test_destroy_database_error(): void
    {
        $this->signIn($this->sysadmin());
        $target = $this->user();
        $this->failOn('users', 'UPDATE');

        $this->deleteJson("/api/core/users/{$target->id}")->assertStatus(500)->assertJson(['message' => 'Deleting user failed.']);
    }

    /**
     * @description Emptying the trash by a non-sysadmin spares trashed sysadmin accounts;
     *   a sysadmin empties everything - after confirming its password (the trash holds a
     *   sysadmin, 2026-10-26).
     * @input Trashed plain account + trashed sysadmin; deleter empties; sysadmin empties without,
     *   then with confirmation 'users:trash'.
     * @output 204 (only the sysadmin remains trashed); 403 PASSWORD_CONFIRMATION_REQUIRED; 204 nothing left.
     */
    public function test_force_delete_all_trashed(): void
    {
        $plain = $this->user();
        $plain->delete();
        $root = $this->sysadmin();
        $root->delete();

        $this->signIn($this->userWith(['core-administrators-delete']));
        $this->deleteJson('/api/core/users/force-delete-all')->assertNoContent();
        $this->assertSame([$root->id], User::onlyTrashed()->pluck('id')->all());
        $this->assertCoreLog('force_delete_all', 'Deleted: 1');

        // The trash holds a sysadmin: emptying it needs the password confirmation (2026-10-26).
        $this->signIn($this->sysadmin());
        $this->deleteJson('/api/core/users/force-delete-all')->assertStatus(403)
            ->assertJsonPath('error_code', 'PASSWORD_CONFIRMATION_REQUIRED')->assertJsonPath('scope', 'users:trash');
        $this->assertSame(1, User::onlyTrashed()->count());
        $this->confirmPassword('users:trash');
        $this->deleteJson('/api/core/users/force-delete-all')->assertNoContent();
        $this->assertSame(0, User::onlyTrashed()->count());
    }

    /**
     * @description A database error while emptying the trash answers 500.
     * @input Trashed account, users DELETE fails.
     * @output 500 "Emptying trash failed."
     */
    public function test_force_delete_all_database_error(): void
    {
        $this->signIn($this->sysadmin());
        $this->user()->delete();
        $this->failOn('users', 'DELETE');

        $this->deleteJson('/api/core/users/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Emptying trash failed.']);
    }

    /**
     * @description Resend activation: invalid id, already activated account.
     * @input Editor (update): POST /abc/resend-activation, POST for an activated account.
     * @output 422 and 422 "already activated".
     */
    public function test_resend_activation_guards(): void
    {
        $this->signIn($this->userWith(['core-administrators-update']));
        $active = $this->user();

        $this->postJson('/api/core/users/abc/resend-activation')->assertStatus(422);
        $this->postJson("/api/core/users/{$active->id}/resend-activation")
            ->assertStatus(422)->assertJson(['message' => 'This account is already activated.']);
    }

    /**
     * @description Resend issues a new token (old link invalid) and mails it.
     * @input Pending account with a token, POST resend-activation.
     * @output 200; exactly one new token; AccountActivationMail sent; resend_activation log.
     */
    public function test_resend_activation_sends_new_link(): void
    {
        Mail::fake();
        $this->signIn($this->userWith(['core-administrators-update']));
        $pending = $this->user(['user_password_hash' => null, 'activated_at' => null]);
        $old = AccountActivationToken::issueFor($pending);

        $this->postJson("/api/core/users/{$pending->id}/resend-activation")->assertOk();

        $this->assertNotSame(hash('sha256', $old), AccountActivationToken::sole()->token_hash);
        Mail::assertSent(AccountActivationMail::class);
        $this->assertCoreLog('resend_activation', $pending->user_email);
    }

    /**
     * @description When the e-mail cannot be sent the admin gets an error, not a fake success.
     * @input Pending account, mailer broken, POST resend-activation.
     * @output 500; resend_activation_failed log.
     */
    public function test_resend_activation_mail_failure(): void
    {
        $this->breakMailer();
        $this->signIn($this->userWith(['core-administrators-update']));
        $pending = $this->user(['user_password_hash' => null, 'activated_at' => null]);

        $this->postJson("/api/core/users/{$pending->id}/resend-activation")->assertStatus(500);

        $this->assertCoreLog('resend_activation_failed', $pending->user_email);
    }
}
