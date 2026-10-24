<?php

/**
 * @file EmailAccessPolicyTest.php
 * @path api/tests/Feature/Core/EmailAccessPolicyTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the e-mail access policy administration
 *   (CoreEmailAccessPolicyController): sysadmin only, primary domain, whitelist rules.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core;

use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CoreSecuritySetting;
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
        $this->signIn($this->sysadmin());

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
}
