<?php
/**
 * @file CoreEmailAccessRule.php
 * @path app/Models/Core/CoreEmailAccessRule.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Jedna položka whitelistu pro vytváření admin účtů (BACKLOG
 * "core-admin-email-domain-restriction") - buď povolená DOMÉNA (kdokoliv z ní smí
 * založit účet), nebo konkrétní jednotlivý E-MAIL (výjimka pro externího
 * spolupracovníka bez ohledu na jeho doménu). Hlavní doména firmy (`primary_email_domain`)
 * žije samostatně na `CoreSecuritySetting` - tahle tabulka drží jen DALŠÍ povolené
 * domény/e-maily nad rámec ní.
 * @note Správa (přidání/smazání) je VÝHRADNĚ sysadmin - viz
 * `CoreEmailAccessPolicyController`. Hodnota se vždy normalizuje na lowercase/trim
 * PŘED uložením (`booted()`), ať se stejná doména/e-mail nedostane do tabulky ve dvou
 * různě napsaných variantách (`RPSW.cz` vs `rpsw.cz`) a unikátní klíč
 * (`type`, `value`) fungoval spolehlivě.
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
     * @description Normalizuje `value` PŘED každým uložením - lowercase, trim, a u
     * domény navíc odstraní případné `@` na začátku (pro případ, že admin omylem
     * vloží e-mail do pole pro doménu).
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
     * @refactor-note (2026-10-09) Moved here from UserController::assertEmailDomainAllowed()
     * so the login check uses exactly the same rules.
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
