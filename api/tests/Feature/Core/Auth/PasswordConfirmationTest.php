<?php

/**
 * @file PasswordConfirmationTest.php
 * @path api/tests/Feature/Core/Auth/PasswordConfirmationTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-26
 * @description Feature tests of the step-up password confirmation (POST /api/confirm-password,
 *   App\Traits\RequiresPasswordConfirmation) and of every sysadmin operation guarded by it:
 *   creating, promoting, editing (also the own account), demoting, deleting and restoring a
 *   sysadmin. A confirmation is single use, bound to its scope, the access token and 10 minutes;
 *   operations on regular accounts need none; the password never lands in the audit log.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers, array cache).
 */

namespace Tests\Feature\Core\Auth;

use App\Mail\Auth\AccountActivationMail;
use App\Models\Core\CoreLog;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * @description /api/confirm-password and the sysadmin operations of /api/core/users.
 */
class PasswordConfirmationTest extends TestCase
{
    /**
     * @description The confirmation endpoint: validated input, a wrong password is refused and
     *   recorded (security event + core log), the right one answers 204 and is logged - without
     *   the password in the log.
     * @input Sysadmin: POST {} ; scope 'User 1!'; wrong password; correct password for 'user:new'.
     * @output 422 (password, scope); 422 scope; 403 PASSWORD_INCORRECT + password_confirmation_failed
     *   event + log; 204 + password_confirmed log; no log row contains the password.
     */
    public function test_confirm_endpoint(): void
    {
        $this->signIn($this->sysadmin());

        $this->postJson('/api/confirm-password', [])->assertStatus(422)->assertJsonValidationErrors(['password', 'scope']);
        $this->postJson('/api/confirm-password', ['password' => 'x', 'scope' => 'User 1!'])->assertStatus(422)->assertJsonValidationErrors(['scope']);

        $this->postJson('/api/confirm-password', ['password' => 'wrong', 'scope' => 'user:new'])
            ->assertStatus(403)->assertJson(['message' => 'The password is incorrect.', 'error_code' => 'PASSWORD_INCORRECT']);
        $this->assertSecurityEvent('password_confirmation_failed', 'warning');
        $this->assertCoreLog('password_confirmation_failed', "'user:new'");

        $this->confirmPassword('user:new');
        $this->assertCoreLog('password_confirmed', "'user:new'");
        foreach (CoreLog::all() as $log) {
            $this->assertStringNotContainsString($this->defaultPassword, (string) json_encode($log->context_data));
            $this->assertStringNotContainsString('wrong', (string) json_encode($log->context_data));
        }
    }

    /**
     * @description After 5 wrong passwords the account cannot confirm for 15 minutes (a stolen
     *   session cannot guess the password) - not even with the right one; a success resets the
     *   counter, so several legitimate confirmations in a row are never blocked.
     * @input 4 wrong + 1 right (reset); 5 wrong; the right one; 16 minutes later the right one.
     * @output 403 ×4, 204; 403 ×5; 429 with retry_after; 204.
     */
    public function test_wrong_passwords_lock_the_confirmation(): void
    {
        $this->signIn($this->sysadmin());
        foreach (range(1, 4) as $i) {
            $this->postJson('/api/confirm-password', ['password' => "wrong{$i}", 'scope' => 'user:new'])->assertStatus(403);
        }
        $this->confirmPassword('user:new');

        foreach (range(1, 5) as $i) {
            $this->postJson('/api/confirm-password', ['password' => "bad{$i}", 'scope' => 'user:new'])->assertStatus(403);
        }
        $this->postJson('/api/confirm-password', ['password' => $this->defaultPassword, 'scope' => 'user:new'])
            ->assertStatus(429)->assertJson(['message' => 'Too many wrong passwords. Please try again later.'])
            ->assertJsonPath('retry_after', fn ($v) => $v > 0);

        $this->travel(16)->minutes();
        $this->confirmPassword('user:new');
    }

    /**
     * @description Editing another sysadmin: refused without confirmation (403 with the scope),
     *   a confirmation of another scope does not help, the right one works ONCE.
     * @input Sysadmin A edits sysadmin B: PUT; confirm 'user:999' + PUT; confirm 'user:B' + PUT; PUT again.
     * @output 403 PASSWORD_CONFIRMATION_REQUIRED scope user:B ×2; 200 renamed; 403 (consumed).
     */
    public function test_editing_a_sysadmin_needs_a_single_use_confirmation(): void
    {
        $this->signIn($this->sysadmin());
        $other = $this->sysadmin();

        $this->putJson("/api/core/users/{$other->id}", ['full_name' => 'Renamed'])
            ->assertStatus(403)
            ->assertJson(['error_code' => 'PASSWORD_CONFIRMATION_REQUIRED', 'scope' => "user:{$other->id}",
                'message' => 'Confirm this operation with your password.']);

        $this->confirmPassword('user:999');
        $this->putJson("/api/core/users/{$other->id}", ['full_name' => 'Renamed'])->assertStatus(403);

        $this->confirmPassword("user:{$other->id}");
        $this->putJson("/api/core/users/{$other->id}", ['full_name' => 'Renamed'])->assertOk()->assertJsonPath('data.full_name', 'Renamed');
        $this->putJson("/api/core/users/{$other->id}", ['full_name' => 'Again'])->assertStatus(403);
        $this->assertSame('Renamed', $other->fresh()->full_name);
    }

    /**
     * @description Every sysadmin operation is guarded: create a sysadmin, promote, demote, edit
     *   the own sysadmin account, delete and restore a sysadmin - each refused without and done
     *   with its confirmation; the same operations on regular accounts need none.
     * @input Sysadmin actor; sysadmin role; regular target; second sysadmin target.
     * @output 403 then 201/200/204 for each guarded operation; regular create / edit / delete 2xx at once.
     */
    public function test_every_sysadmin_operation_is_guarded(): void
    {
        Mail::fake();
        $me = $this->signIn($this->sysadmin());
        $sysadminRoleId = $me->roles->first()->id;
        $regularRole = $this->role('editor');
        $plain = $this->user([], $regularRole);
        $other = $this->sysadmin();

        // create a sysadmin
        $create = ['user_email' => 'root2@example.com', 'full_name' => 'Root 2', 'role_id' => $sysadminRoleId];
        $this->postJson('/api/core/users', $create)->assertStatus(403)->assertJsonPath('scope', 'user:new');
        $this->confirmPassword('user:new');
        $this->postJson('/api/core/users', $create)->assertCreated();
        Mail::assertSent(AccountActivationMail::class);

        // promote a regular account
        $this->putJson("/api/core/users/{$plain->id}", ['role_id' => $sysadminRoleId])->assertStatus(403);
        $this->confirmPassword("user:{$plain->id}");
        $this->putJson("/api/core/users/{$plain->id}", ['role_id' => $sysadminRoleId])->assertOk();
        $this->assertTrue($plain->fresh()->roles()->where('role_name', 'sysadmin')->exists());

        // demote it again
        $this->putJson("/api/core/users/{$plain->id}", ['role_id' => $regularRole->id])->assertStatus(403);
        $this->confirmPassword("user:{$plain->id}");
        $this->putJson("/api/core/users/{$plain->id}", ['role_id' => $regularRole->id])->assertOk();

        // own sysadmin account
        $this->putJson("/api/core/users/{$me->id}", ['full_name' => 'Me'])->assertStatus(403);
        $this->confirmPassword("user:{$me->id}");
        $this->putJson("/api/core/users/{$me->id}", ['full_name' => 'Me'])->assertOk();

        // delete + restore a sysadmin
        $this->deleteJson("/api/core/users/{$other->id}")->assertStatus(403);
        $this->confirmPassword("user:{$other->id}");
        $this->deleteJson("/api/core/users/{$other->id}")->assertNoContent();
        $this->postJson("/api/core/users/{$other->id}/restore")->assertStatus(403);
        $this->confirmPassword("user:{$other->id}");
        $this->postJson("/api/core/users/{$other->id}/restore")->assertOk();

        // regular accounts: no confirmation
        $this->postJson('/api/core/users', ['user_email' => 'plain2@example.com', 'full_name' => 'P', 'role_id' => $regularRole->id])->assertCreated();
        $this->putJson("/api/core/users/{$plain->id}", ['full_name' => 'Plain'])->assertOk();
        $this->deleteJson("/api/core/users/{$plain->id}")->assertNoContent();
    }

    /**
     * @description A non-sysadmin still gets its own reason first (no password prompt for an
     *   operation it may not do at all); a request refused for another reason does not use up
     *   the confirmation.
     * @input Editor PUT on a sysadmin; sysadmin confirms 'user:B', PUT is_blocked on sysadmin B, then PUT a name.
     * @output 403 "Only another sysadmin…" (no error_code); 422 cannot be blocked; 200 (confirmation still there).
     */
    public function test_other_refusals_come_first(): void
    {
        $other = $this->sysadmin();
        $this->signIn($this->userWith(['core-administrators-update']));
        $this->putJson("/api/core/users/{$other->id}", ['full_name' => 'X'])
            ->assertStatus(403)->assertJsonMissingPath('error_code')
            ->assertJson(['message' => 'Only another sysadmin may edit, or promote an account to, the sysadmin role.']);

        $this->signIn($this->sysadmin());
        $this->confirmPassword("user:{$other->id}");
        $this->putJson("/api/core/users/{$other->id}", ['is_blocked' => true])->assertStatus(422);
        $this->putJson("/api/core/users/{$other->id}", ['full_name' => 'Kept'])->assertOk();
    }

    /**
     * @description A confirmation lives 10 minutes.
     * @input Confirm 'user:B'; travel 11 minutes; PUT.
     * @output 403 PASSWORD_CONFIRMATION_REQUIRED.
     */
    public function test_confirmation_expires(): void
    {
        $this->signIn($this->sysadmin());
        $other = $this->sysadmin();
        $this->confirmPassword("user:{$other->id}");

        $this->travel(11)->minutes();
        $this->putJson("/api/core/users/{$other->id}", ['full_name' => 'Late'])
            ->assertStatus(403)->assertJsonPath('error_code', 'PASSWORD_CONFIRMATION_REQUIRED');
    }

    /**
     * @description A confirmation belongs to the access token it was made with - another
     *   session (e.g. a stolen second token) of the same account cannot use it.
     * @input Sysadmin with two real tokens; confirm with token 1; PUT with token 2; PUT with token 1.
     * @output 403 with token 2; 200 with token 1.
     */
    public function test_confirmation_is_bound_to_the_token(): void
    {
        $me = $this->sysadmin();
        $other = $this->sysadmin();
        $first = $this->bearer($me);
        $second = $this->bearer($me);

        $this->withHeaders($first)->postJson('/api/confirm-password', ['password' => $this->defaultPassword, 'scope' => "user:{$other->id}"])->assertNoContent();
        $this->app['auth']->forgetGuards();
        $this->withHeaders($second)->putJson("/api/core/users/{$other->id}", ['full_name' => 'Stolen'])->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->withHeaders($first)->putJson("/api/core/users/{$other->id}", ['full_name' => 'Mine'])->assertOk();
        $this->assertSame('Mine', User::find($other->id)->full_name);
    }
}
