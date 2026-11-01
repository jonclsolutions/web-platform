<?php
/**
 * @file CoreEmailAccessRule.php
 * @path app/Models/Core/CoreEmailAccessRule.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One whitelist entry of the e-mail access policy: an allowed DOMAIN (anyone of it)
 * or a single E-MAIL (an exception, e.g. an external collaborator). The company domain
 * (`primary_email_domain`) lives on `CoreSecuritySetting`; this table holds only the FURTHER
 * allowed domains / e-mails.
 * @note Managed by the sysadmin only (`CoreEmailAccessPolicyController`). The value is
 * normalized (lower case, trimmed) BEFORE saving (`booted()`), so one domain / e-mail cannot be
 * stored in two spellings and the unique key (`type`, `value`) holds.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

class CoreEmailAccessRule extends Model
{
    protected $fillable = [
        'type',
        'value',
    ];

    /**
     * @description Normalizes `value` before every save - lower case, trimmed; for a domain a
     * leading `@` is removed too (an e-mail typed into the domain field).
     */
    protected static function booted(): void
    {
        static::saving(function (self $rule) {
            $value = strtolower(trim((string) $rule->value));

            if ($rule->type === 'domain') {
                $value = ltrim($value, '@');
            }

            $rule->value = $value;
        });
    }
    /**
     * @description Whether an e-mail may hold an account under the current e-mail
     * access policy. An empty `primary_email_domain` means "no restriction". Otherwise
     * allowed when ANY of these matches:
     * 1) the domain equals the company's primary domain,
     * 2) the domain is whitelisted (rule of type `domain`),
     * 3) the whole e-mail is whitelisted as an exception (rule of type `email`).
     * Single source of the policy for account creation, login e-mail change
     * (UserController), login / 2FA / token refresh (AuthController) and the session
     * clean-up after a policy change (CoreEmailAccessPolicyController). It applies to EVERY
     * role, sysadmin included (2026-10-24, see AuthController).
     * @param string $email The e-mail to check (case and surrounding spaces ignored).
     * @return bool True when the e-mail is allowed.
     */
    public static function isEmailAllowed(string $email): bool
    {
        return static::policyChecker()($email);
    }

    /**
     * @description The current policy as a reusable check: the primary domain and all rules
     * are loaded ONCE, so checking many e-mails (every account after a policy change) costs
     * two queries instead of two per account.
     * @return \Closure(string): bool Same answer as isEmailAllowed() for the loaded policy.
     */
    public static function policyChecker(): \Closure
    {
        $primaryDomain = strtolower(trim((string) CoreSecuritySetting::current()->primary_email_domain));
        if ($primaryDomain === '') {
            return static fn (string $email): bool => true;
        }

        $rules = static::query()->get(['type', 'value']);
        $domains = $rules->where('type', 'domain')->pluck('value')->flip()->all();
        $emails = $rules->where('type', 'email')->pluck('value')->flip()->all();

        return static function (string $email) use ($primaryDomain, $domains, $emails): bool {
            $emailLower = strtolower(trim($email));
            $atPosition = strrpos($emailLower, '@');
            $domain = $atPosition !== false ? substr($emailLower, $atPosition + 1) : '';

            return ($domain !== '' && ($domain === $primaryDomain || isset($domains[$domain])))
                || isset($emails[$emailLower]);
        };
    }
}
