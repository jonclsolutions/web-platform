<?php

/**
 * @file EmailAccessPolicyTest.php
 * @path api/tests/Feature/Core/EmailAccessPolicyTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the e-mail access policy administration
 *   (CoreEmailAccessPolicyController): sysadmin only, primary domain, whitelist rules, no self
 *   lock-out of the acting sysadmin, sessions of excluded accounts ended at once - also of
 *   sysadmins (2026-10-24 security fix), and the emergency command security:email-policy-allow.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core;

use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CoreSecuritySetting;
use App\Models\RefreshToken;
use App\Models\TwoFactorCode;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * @description /api/core/email-access-policy.
 */
class EmailAccessPolicyTest extends TestCase
{
    /**
     * @description Every action requires the sysadmin role.
     * @input Account with core-security-* permissions (not sysadmin): show, put, post, delete.
     * @output 403 "This action requires the sysadmin role." for all.
     */
    public function test_sysadmin_only(): void
    {
        $rule = CoreEmailAccessRule::create(['type' => 'domain', 'value' => 'x.cz']);
        $this->signIn($this->userWith(['core-security-view', 'core-security-update']));

        foreach ([
            $this->getJson('/api/core/email-access-policy'),
            $this->putJson('/api/core/email-access-policy/primary-domain', ['primary_email_domain' => 'a.cz']),
            $this->postJson('/api/core/email-access-policy/rules', ['type' => 'domain', 'value' => 'b.cz']),
            $this->deleteJson("/api/core/email-access-policy/rules/{$rule->id}"),
        ] as $response) {
            $response->assertStatus(403)->assertJson(['message' => 'This action requires the sysadmin role.']);
        }
    }

    /**
     * @description Show returns the primary domain and the rules ordered by type, value.
     * @input Primary domain company.cz; rules email z@x.cz, domain b.cz, domain a.cz.
     * @output 200 {primary_email_domain, rules: [domain a.cz, domain b.cz, email z@x.cz]}.
     */
    public function test_show(): void
    {
        $this->signIn($this->sysadmin());
        CoreSecuritySetting::current()->update(['primary_email_domain' => 'company.cz']);
        CoreEmailAccessRule::create(['type' => 'email', 'value' => 'z@x.cz']);
        CoreEmailAccessRule::create(['type' => 'domain', 'value' => 'b.cz']);
        CoreEmailAccessRule::create(['type' => 'domain', 'value' => 'a.cz']);

        $this->getJson('/api/core/email-access-policy')
            ->assertOk()
            ->assertJsonPath('data.primary_email_domain', 'company.cz')
            ->assertJsonPath('data.rules.*.value', ['a.cz', 'b.cz', 'z@x.cz']);
    }

    /**
     * @description The primary domain is validated, normalized to lower case, can be cleared.
     * @input PUT 'Company.CZ', PUT 'not a domain', PUT null.
     * @output 200 {data.primary_email_domain:'company.cz'} + log; 422; 200 with null + log "(no restriction)".
     */
    public function test_update_primary_domain(): void
    {
        $this->signIn($this->sysadmin(['user_email' => 'admin@company.cz']));

        $this->putJson('/api/core/email-access-policy/primary-domain', ['primary_email_domain' => 'Company.CZ'])
            ->assertOk()->assertJsonPath('data.primary_email_domain', 'company.cz');
        $this->assertCoreLog('email_access_primary_domain_updated', 'from (no restriction) to company.cz');

        $this->putJson('/api/core/email-access-policy/primary-domain', ['primary_email_domain' => 'not a domain'])
            ->assertStatus(422)
            ->assertJsonPath('errors.primary_email_domain.0', 'Please enter a valid domain (e.g. rpsw.cz), without "@" or path.');

        $this->putJson('/api/core/email-access-policy/primary-domain', ['primary_email_domain' => null])
            ->assertOk()->assertJsonPath('data.primary_email_domain', null);
        $this->assertCoreLog('email_access_primary_domain_updated', 'from company.cz to (no restriction)');
    }

    /**
     * @description Rules: a domain is normalized (lower case, no leading @), an e-mail must be
     *   valid, duplicates are refused, the answer is wrapped in {data}.
     * @input POST domain ' @Partner.CZ '; POST email 'bad'; POST email 'Jo@X.cz'; POST domain 'partner.cz' again.
     * @output 201 value 'partner.cz'; 422; 201 value 'jo@x.cz'; 422 "already on the whitelist".
     */
    public function test_store_rule(): void
    {
        $this->signIn($this->sysadmin());

        $this->postJson('/api/core/email-access-policy/rules', ['type' => 'domain', 'value' => ' @Partner.CZ '])
            ->assertCreated()->assertJsonPath('data.value', 'partner.cz');
        $this->assertCoreLog('email_access_rule_created', '(domain): partner.cz');

        $this->postJson('/api/core/email-access-policy/rules', ['type' => 'email', 'value' => 'bad'])->assertStatus(422);
        $this->postJson('/api/core/email-access-policy/rules', ['type' => 'email', 'value' => 'Jo@X.cz'])
            ->assertCreated()->assertJsonPath('data.value', 'jo@x.cz');
        $this->postJson('/api/core/email-access-policy/rules', ['type' => 'domain', 'value' => 'partner.cz'])
            ->assertStatus(422)->assertJson(['message' => 'This item is already on the whitelist.']);
        $this->postJson('/api/core/email-access-policy/rules', ['type' => 'other', 'value' => 'x'])->assertStatus(422);
    }

    /**
     * @description A rule can be deleted; an unknown id is 404.
     * @input DELETE an existing rule and /999.
     * @output 200 + log; 404.
     */
    public function test_destroy_rule(): void
    {
        $this->signIn($this->sysadmin());
        $rule = CoreEmailAccessRule::create(['type' => 'domain', 'value' => 'gone.cz']);

        $this->deleteJson("/api/core/email-access-policy/rules/{$rule->id}")->assertOk();
        $this->assertNull($rule->fresh());
        $this->assertCoreLog('email_access_rule_deleted', '(domain): gone.cz');

        $this->deleteJson('/api/core/email-access-policy/rules/999')->assertStatus(404);
    }

    /**
     * @description The reported scenario (2026-10-24): a domain is allowed, accounts of it are
     *   created and logged in - a regular one AND a sysadmin; another sysadmin removes the domain.
     *   Both are out at once: their sessions are ended (meta.sessions_revoked), login and refresh
     *   are refused - the sysadmin role is no exception any more.
     * @input Primary domain company.cz, rule domain partner.cz; editor@partner.cz and sysadmin
     *   boss@partner.cz with access + refresh tokens and a pending 2FA; acting sysadmin
     *   admin@company.cz deletes the rule.
     * @output 200 meta.sessions_revoked 2 + log email_access_sessions_revoked; no tokens / 2FA left
     *   for both; POST /api/login 403 and POST /api/refresh 401 (token revoked) for both.
     */
    public function test_removed_domain_ends_access_of_every_role(): void
    {
        CoreSecuritySetting::current()->update(['primary_email_domain' => 'company.cz']);
        $rule = CoreEmailAccessRule::create(['type' => 'domain', 'value' => 'partner.cz']);
        $regular = $this->user(['user_email' => 'editor@partner.cz']);
        $partnerSysadmin = $this->sysadmin(['user_email' => 'boss@partner.cz']);
        foreach ([$regular, $partnerSysadmin] as $i => $account) {
            $account->createToken('access-token');
            RefreshToken::create(['user_id' => $account->id, 'token' => hash('sha256', "raw-{$i}"), 'expires_at' => now()->addDay()]);
            TwoFactorCode::create(['user_id' => $account->id, 'login_token_hash' => hash('sha256', "lt-{$i}"), 'code_hash' => str_repeat('b', 64),
                'expires_at' => now()->addMinutes(5), 'last_sent_at' => now()]);
        }

        $actor = $this->signIn($this->sysadmin(['user_email' => 'admin@company.cz']));
        $this->deleteJson("/api/core/email-access-policy/rules/{$rule->id}")
            ->assertOk()->assertJsonPath('meta.sessions_revoked', 2);
        $this->assertCoreLog('email_access_sessions_revoked', '2 account(s)');

        foreach ([$regular, $partnerSysadmin] as $i => $account) {
            $this->assertSame(0, PersonalAccessToken::where('tokenable_id', $account->id)->count());
            $this->assertSame(0, RefreshToken::where('user_id', $account->id)->count());
            $this->assertSame(0, TwoFactorCode::where('user_id', $account->id)->count());
            $this->app['auth']->forgetGuards();
            $this->app['auth']->shouldUse('web');  // the test signed in through Sanctum - login uses the session guard
            $this->postJson('/api/login', ['email' => $account->user_email, 'password' => $this->defaultPassword])->assertStatus(403);
            $this->postJson('/api/refresh', ['refreshToken' => "raw-{$i}"])->assertStatus(401);
        }
        $this->assertTrue(CoreEmailAccessRule::isEmailAllowed($actor->user_email));
    }

    /**
     * @description No self lock-out: a change that would exclude the ACTING sysadmin is refused
     *   and rolled back; the same change by a sysadmin who stays allowed goes through; adding an
     *   exception first makes it possible.
     * @input Acting sysadmin me@partner.cz (allowed through rule partner.cz, primary company.cz):
     *   DELETE that rule; acting sysadmin boss@company.cz (allowed through the primary domain): PUT
     *   primary domain other.cz; then me@partner.cz adds exception me@partner.cz and DELETEs again.
     * @output 422 EMAIL_POLICY_SELF_LOCKOUT ×2, rule and primary domain unchanged, log
     *   email_access_change_refused; after the exception 200 and sessions_revoked 0.
     */
    public function test_change_that_locks_out_the_actor_is_refused(): void
    {
        CoreSecuritySetting::current()->update(['primary_email_domain' => 'company.cz']);
        $rule = CoreEmailAccessRule::create(['type' => 'domain', 'value' => 'partner.cz']);
        $this->signIn($this->sysadmin(['user_email' => 'me@partner.cz']));

        $this->deleteJson("/api/core/email-access-policy/rules/{$rule->id}")
            ->assertStatus(422)->assertJsonPath('error_code', 'EMAIL_POLICY_SELF_LOCKOUT')
            ->assertJsonPath('message', 'This change would block your own login: your e-mail would no longer be allowed. Add an exception for it first.');
        $this->assertNotNull($rule->fresh());
        $this->assertCoreLog('email_access_change_refused');

        $me = $this->app['auth']->user();
        $this->signIn($this->sysadmin(['user_email' => 'boss@company.cz']));
        $this->putJson('/api/core/email-access-policy/primary-domain', ['primary_email_domain' => 'other.cz'])
            ->assertStatus(422)->assertJsonPath('error_code', 'EMAIL_POLICY_SELF_LOCKOUT');
        $this->assertSame('company.cz', CoreSecuritySetting::current()->primary_email_domain);

        $this->signIn($me);

        $this->postJson('/api/core/email-access-policy/rules', ['type' => 'email', 'value' => 'me@partner.cz'])->assertCreated();
        $this->deleteJson("/api/core/email-access-policy/rules/{$rule->id}")
            ->assertOk()->assertJsonPath('meta.sessions_revoked', 0)->assertJsonPath('message', 'Item has been deleted.');
        $this->assertNull($rule->fresh());
    }

    /**
     * @description A failing write inside the guarded change is rolled back and rethrown (500),
     *   nothing is kept.
     * @input core_email_access_rules DELETE fails.
     * @output 500; the rule still exists.
     */
    public function test_failed_change_is_rolled_back(): void
    {
        $rule = CoreEmailAccessRule::create(['type' => 'domain', 'value' => 'partner.cz']);
        $this->signIn($this->sysadmin());
        $this->failOn('core_email_access_rules', 'DELETE');

        $this->deleteJson("/api/core/email-access-policy/rules/{$rule->id}")->assertStatus(500);
        $this->assertNotNull(CoreEmailAccessRule::find($rule->id));
    }

    /**
     * @description Emergency access from the server: the command adds an e-mail exception
     *   (normalized, logged), is idempotent and refuses an invalid e-mail.
     * @input security:email-policy-allow ' Admin@Partner.CZ ' twice; 'not-an-email'.
     * @output exit 0 + rule email admin@partner.cz + core log; exit 0 "already allowed"; exit 1.
     */
    public function test_emergency_command_allows_an_email(): void
    {
        $this->artisan('security:email-policy-allow', ['email' => ' Admin@Partner.CZ '])
            ->expectsOutput('admin@partner.cz is allowed now (e-mail exception added).')->assertExitCode(0);
        $this->assertTrue(CoreEmailAccessRule::where('type', 'email')->where('value', 'admin@partner.cz')->exists());
        $this->assertCoreLog('email_access_rule_created', 'from the server console: admin@partner.cz');

        $this->artisan('security:email-policy-allow', ['email' => 'admin@partner.cz'])
            ->expectsOutput('admin@partner.cz is already allowed (e-mail exception exists).')->assertExitCode(0);
        $this->artisan('security:email-policy-allow', ['email' => 'not-an-email'])
            ->expectsOutput('Not a valid e-mail: not-an-email')->assertExitCode(1);
    }
}
