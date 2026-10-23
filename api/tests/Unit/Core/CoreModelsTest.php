<?php

/**
 * @file CoreModelsTest.php
 * @path api/tests/Unit/Core/CoreModelsTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the Core / Auth models: relations, effective permissions,
 *   2FA requirement, token validity, the e-mail access policy and the security setting
 *   singleton.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Unit\Core;

use App\Models\AccountActivationToken;
use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CoreExternalLink;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreRole;
use App\Models\Core\CoreSecurityEvent;
use App\Models\Core\CoreSecuritySetting;
use App\Models\PasswordResetToken;
use App\Models\RefreshToken;
use App\Models\TwoFactorCode;
use App\Models\User;
use Tests\TestCase;

/**
 * @description App\Models\User, App\Models\Core\*, token models.
 */
class CoreModelsTest extends TestCase
{
    /**
     * @description The belongs-to relations resolve to their owner account.
     * @input One account; a log row, external link, security event, refresh, reset and 2FA token of it.
     * @output Every ->user is that account.
     */
    public function test_belongs_to_user_relations(): void
    {
        $user = $this->user();
        $now = now();
        $models = [
            CoreLog::create(['event_type' => 'x', 'module' => 'm', 'description' => 'd', 'user_id' => $user->id]),
            CoreExternalLink::create(['user_id' => $user->id, 'name' => 'n', 'url' => 'https://x.cz']),
            CoreSecurityEvent::create(['fingerprint' => str_repeat('f', 64), 'event_type' => 'x', 'user_id' => $user->id, 'first_seen_at' => $now, 'last_seen_at' => $now]),
            RefreshToken::create(['user_id' => $user->id, 'token' => 'a', 'expires_at' => $now]),
            PasswordResetToken::create(['user_id' => $user->id, 'token_hash' => 'b', 'expires_at' => $now]),
            TwoFactorCode::create(['user_id' => $user->id, 'login_token_hash' => 'c', 'code_hash' => 'd', 'expires_at' => $now, 'last_sent_at' => $now]),
        ];

        foreach ($models as $model) {
            $this->assertTrue($model->user->is($user), get_class($model) . '::user()');
        }
    }

    /**
     * @description Roles and permissions are linked both ways; only 'sysadmin' is protected.
     * @input Role 'editor' with permission p, one account with the role; role 'SysAdmin'.
     * @output editor->users / ->permissions, p->roles; isProtected false / true (case-insensitive).
     */
    public function test_role_permission_relations_and_protection(): void
    {
        $editor = $this->role('editor', ['p-key']);
        $user = $this->user([], $editor);

        $this->assertTrue($editor->users->first()->is($user));
        $this->assertSame(['p-key'], $editor->permissions->pluck('permission_key')->all());
        $this->assertSame('editor', $this->permission('p-key')->roles->first()->role_name);
        $this->assertFalse($editor->isProtected());
        $this->assertTrue((new CoreRole(['role_name' => 'SysAdmin']))->isProtected());
    }

    /**
     * @description Effective permissions = role permissions ∪ explicit grants (unique), with
     *   or without the relations preloaded; user_permissions lists the explicit grants only.
     * @input Role grants a, b; explicit grants b, c.
     * @output permissions [a, b, c] both ways; user_permissions [{id, b}, {id, c}];
     *   getAuthPassword = the hash column.
     */
    public function test_effective_permissions(): void
    {
        $user = $this->user([], $this->role('r', ['a', 'b']));
        $user->explicitPermissions()->attach([$this->permission('b')->id, $this->permission('c')->id]);

        $fresh = User::find($user->id);
        $this->assertEqualsCanonicalizing(['a', 'b', 'c'], $fresh->permissions);
        $loaded = User::with(['roles.permissions', 'explicitPermissions'])->find($user->id);
        $this->assertEqualsCanonicalizing(['a', 'b', 'c'], $loaded->permissions);
        $this->assertEqualsCanonicalizing(['b', 'c'], array_column($loaded->user_permissions, 'permission_key'));
        $this->assertEqualsCanonicalizing(['b', 'c'], array_column($fresh->user_permissions, 'permission_key'));
        $this->assertSame($user->user_password_hash, $fresh->getAuthPassword());
    }

    /**
     * @description 2FA is required by the sysadmin role, a forcing role, the own choice or
     *   the sysadmin override - otherwise not.
     * @input Accounts: sysadmin; role with forces_2fa; enable_2fa; two_fa_forced_by_admin; plain.
     * @output requiresTwoFactor true, true, true, true, false (also with roles preloaded).
     */
    public function test_requires_two_factor(): void
    {
        $this->assertTrue($this->sysadmin()->requiresTwoFactor());
        $this->assertTrue($this->user([], $this->role('secure', [], ['forces_2fa' => true]))->load('roles')->requiresTwoFactor());
        $this->assertTrue($this->user(['enable_2fa' => true])->requiresTwoFactor());
        $this->assertTrue($this->user(['two_fa_forced_by_admin' => true])->requiresTwoFactor());
        $this->assertFalse($this->user([], $this->role('plain'))->requiresTwoFactor());
    }

    /**
     * @description Token validity: 2FA session (unused, not expired, under the attempt
     *   limit), resend cooldown, reset token (unused, not expired), activation token (not expired).
     * @input Tokens in valid and invalid states.
     * @output isValid / isInCooldown as expected.
     */
    public function test_token_validity(): void
    {
        $code = new TwoFactorCode(['expires_at' => now()->addMinute(), 'attempts' => 0, 'last_sent_at' => now()->subSeconds(10)]);
        $this->assertTrue($code->isValid());
        $this->assertTrue($code->isInCooldown());
        $this->assertFalse((new TwoFactorCode(['expires_at' => now()->addMinute(), 'attempts' => TwoFactorCode::MAX_ATTEMPTS]))->isValid());
        $this->assertFalse((new TwoFactorCode(['expires_at' => now()->subMinute(), 'attempts' => 0]))->isValid());
        $this->assertFalse((new TwoFactorCode(['last_sent_at' => now()->subMinutes(2)]))->isInCooldown());

        $this->assertTrue((new PasswordResetToken(['expires_at' => now()->addMinute()]))->isValid());
        $this->assertFalse((new PasswordResetToken(['expires_at' => now()->addMinute(), 'used_at' => now()]))->isValid());
        $this->assertFalse((new PasswordResetToken(['expires_at' => now()->subMinute()]))->isValid());

        $this->assertTrue((new AccountActivationToken(['expires_at' => now()->addMinute()]))->isValid());
        $this->assertFalse((new AccountActivationToken(['expires_at' => now()->subMinute()]))->isValid());
    }

    /**
     * @description issueFor() replaces every older activation token, stores only the hash and
     *   sets a 48 h expiry.
     * @input Account with an older token; issueFor twice.
     * @output One row; token_hash = sha256(last raw token); expires in 48 h.
     */
    public function test_activation_token_issue(): void
    {
        $user = $this->user();
        AccountActivationToken::issueFor($user);
        $raw = AccountActivationToken::issueFor($user);

        $token = AccountActivationToken::sole();
        $this->assertSame(64, strlen($raw));
        $this->assertSame(hash('sha256', $raw), $token->token_hash);
        $this->assertEqualsWithDelta(48 * 3600, now()->diffInSeconds($token->expires_at), 5);
    }

    /**
     * @description Rule values are normalized before saving (lower case, trimmed, no leading
     *   @ for domains).
     * @input Rules domain ' @Firm.CZ ', email ' Jo@Firm.CZ '.
     * @output 'firm.cz' and 'jo@firm.cz'.
     */
    public function test_email_rule_normalization(): void
    {
        $this->assertSame('firm.cz', CoreEmailAccessRule::create(['type' => 'domain', 'value' => ' @Firm.CZ '])->value);
        $this->assertSame('jo@firm.cz', CoreEmailAccessRule::create(['type' => 'email', 'value' => ' Jo@Firm.CZ '])->value);
    }

    /**
     * @description The e-mail access policy: no primary domain = anything; otherwise the
     *   primary domain, a whitelisted domain or a whitelisted e-mail.
     * @input No primary domain; then primary company.cz with rules domain partner.cz, email jo@gmail.com.
     * @output Allowed: anything / a@company.cz, b@partner.cz, JO@gmail.com; refused: x@gmail.com, 'no-at-sign'.
     */
    public function test_email_policy(): void
    {
        $this->assertTrue(CoreEmailAccessRule::isEmailAllowed('anyone@anywhere.org'));

        CoreSecuritySetting::current()->update(['primary_email_domain' => 'Company.cz']);
        CoreEmailAccessRule::create(['type' => 'domain', 'value' => 'partner.cz']);
        CoreEmailAccessRule::create(['type' => 'email', 'value' => 'jo@gmail.com']);

        $this->assertTrue(CoreEmailAccessRule::isEmailAllowed('a@company.cz'));
        $this->assertTrue(CoreEmailAccessRule::isEmailAllowed('b@partner.cz'));
        $this->assertTrue(CoreEmailAccessRule::isEmailAllowed(' JO@gmail.com '));
        $this->assertFalse(CoreEmailAccessRule::isEmailAllowed('x@gmail.com'));
        $this->assertFalse(CoreEmailAccessRule::isEmailAllowed('no-at-sign'));
    }

    /**
     * @description The security settings row is a singleton created on first use with 90 days.
     * @input current() twice.
     * @output Same row id 1, retention 90, one row in the table.
     */
    public function test_security_setting_singleton(): void
    {
        $first = CoreSecuritySetting::current();
        $second = CoreSecuritySetting::current();

        $this->assertSame(CoreSecuritySetting::SINGLETON_ID, $first->id);
        $this->assertSame(90, $second->retention_days);
        $this->assertSame(1, CoreSecuritySetting::count());
    }
}
