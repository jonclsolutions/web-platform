<?php
/**
 * @file CheckPermission.php
 * @path app/Http/Middleware/CheckPermission.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Globální backendové vynucení permission systému, který dosud existoval jen
 * jako Angular route metadata (`data: { permission: '...' }` v admin-routing.module.ts /
 * `*appHasPermission` direktiva). Laravel tyhle klíče nikdy nekontroloval - jakýkoliv
 * přihlášený uživatel mohl zavolat libovolný chráněný endpoint přímo (Postman/curl) a
 * zcela obejít frontendové UI. Tento middleware vyžaduje STEJNÝ permission klíč i na
 * backendu.
 *
 * @note Sysadmin obchází každou permission kontrolu bezpodmínečně - je to nejvyšší
 * autorita v appce (viz UserController::SYSADMIN_ROLE_NAME / CoreRoleController) a nesmí
 * ho zablokovat chybějící/špatně nastavené přiřazení oprávnění jeho roli.
 *
 * @note Volitelný druhý parametr `$selfParam` umožňuje routě propustit buď požadovaný
 * permission, NEBO vlastnictví záznamu (route parametr odpovídá ID přihlášeného
 * uživatele) - použito u `core/users/{id}` endpointů, které musí zůstat dostupné i
 * běžnému uživateli prohlížejícímu/editujícímu VLASTNÍ účet (stránka personal-info), i
 * když nemá `web-manage-administrators`.
 *
 * @refactor-note (2026-08) `$permission` nyní podporuje více klíčů oddělených `|`
 * (logika OR - stačí mít KTERÝKOLIV z nich), např.
 * `permission:web-view-web-settings|shop-set-maitanance-mode` na `core/settings` -
 * tenhle endpoint obsluhuje jak plný formulář firemních údajů (web-view-web-settings),
 * tak rychlý přepínač údržby e-shopu v headeru (shop-set-maitanance-mode), a jsou to
 * dvě různé skupiny uživatelů, které se nemusí překrývat.
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * @description Role name, která obchází každou permission kontrolu - viz doc bloku výše.
     * Musí sedět s `UserController::SYSADMIN_ROLE_NAME` / `CoreRoleController`.
     */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * @param Request $request
     * @param Closure $next
     * @param string $permission Jeden nebo více (oddělených `|`) požadovaných permission
     * klíčů - stejné klíče jako `data.permission` na frontendu. Pro průchod stačí mít
     * KTERÝKOLIV z nich (OR).
     * @param string|null $selfParam Název route parametru (např. 'id'), jehož shoda s ID
     * přihlášeného uživatele propustí request i bez permission - viz doc bloku výše.
     * @return Response
     */
    public function handle(Request $request, Closure $next, string $permission, ?string $selfParam = null): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Nepřihlášeno.'], 401);
        }

        $isSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
        if ($isSysadmin) {
            return $next($request);
        }

        if ($selfParam !== null) {
            $routeValue = $request->route($selfParam);
            $routeId = is_object($routeValue) ? $routeValue->id : $routeValue;
            if ($routeId !== null && (int) $routeId === (int) $user->id) {
                return $next($request);
            }
        }

        $requiredPermissions = explode('|', $permission);
        $userPermissions = $user->permissions ?? [];

        if (array_intersect($requiredPermissions, $userPermissions)) {
            return $next($request);
        }

        return response()->json(['message' => 'Nedostatečná oprávnění.'], 403);
    }
}