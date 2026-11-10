<?php

/**
 * @file CredentialChangeSessionsTest.php
 * @path tests/Feature/Core/Users/CredentialChangeSessionsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of who may change the own account and what a changed login e-mail /
 *   password does to the sessions: own change = all other sessions end, the current one stays;
 *   change by a sysadmin = all sessions of the account end; a changed e-mail is announced to the
 *   previous and the new address; access tokens carry the session (refresh family) in their name.
 * @dependencies
 * - Tests\TestCase (RefreshDatabase + InteractsWithAccounts).
 * - App\Support\Auth\UserSessions, App\Mail\Auth\EmailChangedNotification.
 */

namespace Tests\Feature\Core\Users;

use App\Mail\Auth\EmailChangedNotification;
use App\Models\RefreshToken;
use App\Models\User;
use App\Support\Auth\UserSessions;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * @description PUT /api/core/users/{id}, PUT /api/core/users/{id}/change-password, POST /api/login.
 */
class CredentialChangeSessionsTest extends TestCase
{
    /**
     * @description Two sessions of one account: "here" (the requests of the test) and "elsewhere"
     *   (another browser) - each an access token named by its family and a refresh token.
     * @param User $user Account.
     * @return array{0: array<string, string>, 1: int, 2: int} [headers of "here", token id here, token id elsewhere]
     */
    private function twoSessions(User $user): array
    {
        $here = $user->createToken(UserSessions::accessTokenName('fam-here'));
        $elsewhere = $user->createToken(UserSessions::accessTokenName('fam-elsewhere'));
        foreach (['fam-here', 'fam-elsewhere'] as $family) {
            RefreshToken::create(['user_id' => $user->id, 'token' => hash('sha256', $family . $user->id), 'family' => $family, 'expires_at' => now()->addDay()]);
        }

        return [['Authorization' => 'Bearer ' . $here->plainTextToken], $here->accessToken->id, $elsewhere->accessToken->id];
    }

    /**
     * @description Families of the refresh tokens left for the account.
     * @param User $user Account.
     * @return string[]
     */
    private function families(User $user): array
    {
        return RefreshToken::where('user_id', $user->id)->pluck('family')->all();
    }

    /**
     * @description Own login e-mail (account with core-administrators-update): after the step-up the
     *   e-mail changes, the other session ends, this one stays; both addresses are told.
     * @input Editor with sessions "here" / "elsewhere"; PUT own e-mail (403 step-up), confirm, PUT.
     * @output 200 new e-mail; tokens: only "here"; refresh families: only 'fam-here';
     *   EmailChangedNotification to the old and the new address; log 'email_changed'.
     */
    public function test_own_email_change_keeps_only_the_current_session(): void
    {
        Mail::fake();
        $me = $this->userWith(['core-administrators-update']);
        $old = $me->user_email;
        [$headers, $hereId] = $this->twoSessions($me);

        $this->withHeaders($headers)->putJson("/api/core/users/{$me->id}", ['user_email' => 'moved@example.com'])
            ->assertStatus(403)->assertJsonPath('error_code', 'PASSWORD_CONFIRMATION_REQUIRED');
        $this->withHeaders($headers)->postJson('/api/confirm-password', ['password' => $this->defaultPassword, 'scope' => "user:{$me->id}"])->assertNoContent();
        $this->withHeaders($headers)->putJson("/api/core/users/{$me->id}", ['user_email' => 'moved@example.com'])
            ->assertOk()->assertJsonPath('data.user_email', 'moved@example.com');

        $this->assertSame([$hereId], PersonalAccessToken::where('tokenable_id', $me->id)->pluck('id')->all());
        $this->assertSame(['fam-here'], $this->families($me));
        foreach ([$old, 'moved@example.com'] as $address) {
            Mail::assertSent(EmailChangedNotification::class, fn ($mail) => $mail->hasTo($address) && $mail->previousEmail === $old);
        }
        $this->assertCoreLog('email_changed', 'other sessions ended');
    }

    /**
     * @description A sysadmin changes the e-mail of another account: all its sessions end.
     * @input Target with two sessions; sysadmin PUT {user_email}.
     * @output 200; no access / refresh token of the target left; both addresses told.
     */
    public function test_email_changed_by_sysadmin_ends_all_sessions(): void
    {
        Mail::fake();
        $target = $this->user();
        $this->twoSessions($target);
        $this->signIn($this->sysadmin());

        $this->putJson("/api/core/users/{$target->id}", ['user_email' => 'renamed@example.com'])->assertOk();

        $this->assertSame(0, PersonalAccessToken::where('tokenable_id', $target->id)->count());
        $this->assertSame([], $this->families($target));
        Mail::assertSent(EmailChangedNotification::class, 2);
    }

    /**
     * @description An unchanged e-mail sent back ends nothing and tells nobody.
     * @input Target with two sessions; sysadmin PUT {user_email: same, full_name: new}.
     * @output 200; both sessions kept; no EmailChangedNotification.
     */
    public function test_unchanged_email_keeps_the_sessions(): void
    {
        Mail::fake();
        $target = $this->user();
        $this->twoSessions($target);
        $this->signIn($this->sysadmin());

        $this->putJson("/api/core/users/{$target->id}", ['user_email' => $target->user_email, 'full_name' => 'New Name'])->assertOk();

        $this->assertSame(2, PersonalAccessToken::where('tokenable_id', $target->id)->count());
        Mail::assertNotSent(EmailChangedNotification::class);
    }

    /**
     * @description Own account without core-administrators-update: only 2FA may change; name,
     *   e-mail and admin fields are refused (values sent back unchanged are fine).
     * @input Account without permissions; PUT {user_email}, {full_name}, {internal_note},
     *   {dpp_hours_spent}, {permission_ids}, {enable_2fa}, {full_name: same}.
     * @output 403 ×5 (log 'update_denied'); 200 for 2FA and the unchanged name.
     */
    public function test_own_account_without_permission_changes_only_2fa(): void
    {
        $me = $this->signIn($this->user(['full_name' => 'Plain User']));

        foreach ([['user_email' => 'x@example.com'], ['full_name' => 'Other'], ['internal_note' => 'note'], ['dpp_hours_spent' => 5], ['permission_ids' => []]] as $payload) {
            $this->putJson("/api/core/users/{$me->id}", $payload)->assertStatus(403);
        }
        $this->assertCoreLog('update_denied', 'self-service');

        $this->putJson("/api/core/users/{$me->id}", ['enable_2fa' => true])->assertOk()->assertJsonPath('data.enable_2fa', true);
        $this->putJson("/api/core/users/{$me->id}", ['full_name' => 'Plain User'])->assertOk();
        $this->assertSame($me->user_email, $me->fresh()->user_email);
    }

    /**
     * @description Own password: the other session ends, this one stays. A sysadmin's change of
     *   another account's password ends all its sessions.
     * @input Account with two sessions changes its password (bearer "here"); target with two
     *   sessions, sysadmin changes its password.
     * @output Own: tokens [here], families ['fam-here']; target: no tokens, no refresh tokens.
     */
    public function test_password_change_ends_the_other_sessions(): void
    {
        Mail::fake();
        $me = $this->user();
        [$headers, $hereId] = $this->twoSessions($me);
        $payload = ['old_password' => $this->defaultPassword, 'new_password' => 'Nove-Heslo1', 'new_password_confirmation' => 'Nove-Heslo1'];

        $this->withHeaders($headers)->putJson("/api/core/users/{$me->id}/change-password", $payload)->assertOk();
        $this->assertSame([$hereId], PersonalAccessToken::where('tokenable_id', $me->id)->pluck('id')->all());
        $this->assertSame(['fam-here'], $this->families($me));

        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        $target = $this->user();
        $this->twoSessions($target);
        $this->signIn($this->sysadmin());
        $this->putJson("/api/core/users/{$target->id}/change-password", $payload)->assertOk();
        $this->assertSame(0, PersonalAccessToken::where('tokenable_id', $target->id)->count());
        $this->assertSame([], $this->families($target));
    }

    /**
     * @description A login names its access token by the session's refresh family.
     * @input POST /api/login.
     * @output Token name 'access-token:{family}' of the one refresh family.
     */
    public function test_access_tokens_carry_their_session(): void
    {
        $user = $this->user();
        $this->postJson('/api/login', ['email' => $user->user_email, 'password' => $this->defaultPassword])->assertOk();
        $family = RefreshToken::where('user_id', $user->id)->value('family');
        $this->assertSame([UserSessions::accessTokenName($family)], PersonalAccessToken::where('tokenable_id', $user->id)->pluck('name')->all());
    }
}
