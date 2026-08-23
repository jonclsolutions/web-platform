<?php
/**
 * @file ImportPermissionChecker.php
 * @path app/Services/Import/ImportPermissionChecker.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Ověří, že přihlášený uživatel smí importovat do daného resource - STEJNÁ
 * logika jako `App\Http\Middleware\CheckPermission` (sysadmin bypass + průnik s
 * permissions, podpora OR syntaxe `klic1|klic2`), ale volaná RUČNĚ z `ImportController`,
 * ne přes middleware na routě. Důvod: permission klíč se liší podle resource (viz
 * `importable_resources.php` -> `permission`), což je runtime hodnota přišlá v těle
 * requestu - `->middleware('permission:...')` na routě umí jen STATICKÝ řetězec
 * napsaný přímo v `routes/api.php`, ne hodnotu závislou na datech requestu.
 *
 * @security Musí zůstat funkčně identická s `CheckPermission` (stejný sysadmin klíč,
 * stejná OR syntaxe) - jde o bezpečnostní kontrolu, ne kosmetickou duplicitu.
 */

namespace App\Services\Import;

use Illuminate\Http\Request;

class ImportPermissionChecker
{
    /** @description Musí být identické s `CheckPermission::SYSADMIN_ROLE_NAME`. */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * @param Request $request
     * @param string $permission Jeden nebo více (oddělených `|`) permission klíčů - OR.
     * @return bool True, pokud uživatel smí importovat.
     */
    public function check(Request $request, string $permission): bool
    {
        $user = $request->user();
        if (!$user) {
            return false;
        }

        $isSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
        if ($isSysadmin) {
            return true;
        }

        $requiredPermissions = explode('|', $permission);
        $userPermissions = $user->permissions ?? [];

        return (bool) array_intersect($requiredPermissions, $userPermissions);
    }
}