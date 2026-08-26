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
}