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
 * `permission:web-view-web-settings|shop-set-maintenance-mode` na `core/settings` -
 * tenhle endpoint obsluhuje jak plný formulář firemních údajů (web-view-web-settings),
 * tak rychlý přepínač údržby e-shopu v headeru (shop-set-maintenance-mode), a jsou to
 * dvě různé skupiny uživatelů, které se nemusí překrývat.
 *
 * @bugfix-note (2026-08-24) KRITICKÁ MEZERA V BEZPEČNOSTNÍM MONITORINGU: tento middleware
 * chrání VŠECHNY permission-gated endpointy v aplikaci (desítky routes napříč core/web/
 * shop sekcemi), ale zamítnuté pokusy (401 chybějící auth, 403 nedostatečné oprávnění)
 * se NIKDY nezapisovaly do `core_security_events` - jen se tiše vrátila chybová
 * odpověď. To znamená, že klasický vzorec privilege-escalation pokusu (přihlášený, ale
 * nízko-privilegovaný účet zkoušející endpointy, na které nemá právo - ať už omylem,
 * zvědavostí, nebo protože byl účet kompromitován) byl pro administrátora zcela
 * neviditelný, přestože jde přesně o typ hrozby, který má bezpečnostní monitoring
 * odhalovat.
 *
 * ŘEŠENÍ: přidány dva zápisy do `CoreSecurityEvent::record()`:
 * - `unauthenticated_access_attempt` (severity `info`) - request bez platného
 *   přihlášení dorazil až sem. V praxi vzácné (routa je navíc uvnitř
 *   `auth:sanctum` middleware skupiny, který neautentizované requesty typicky odmítne
 *   ještě DŘÍV, než se dostanou k `CheckPermission` - viz globální
 *   `AuthenticationException` handler v `bootstrap/app.php`, plánovaný jako
 *   doplňkový zápis v další vlně). `info`, ne `warning` - samotný `auth:sanctum` handler
 *   je primární místo pro tenhle scénář, tady jde jen o obranu do hloubky.
 * - `permission_denied` (severity `warning`) - PŘIHLÁŠENÝ uživatel nemá požadované
 *   oprávnění. Kontext obsahuje `required_permission`, ať je z monitoringu hned vidět,
 *   o co se uživatel pokoušel, ne jen že "něco" bylo zamítnuto.
 * Sysadmin a legitimní `$selfParam` průchod (vlastní účet) logování NESPOUŠTÍ - nejde
 * o odepřený pokus, ale o platný, očekávaný scénář.
 */

namespace App\Http\Middleware;

use App\Models\Core\CoreSecurityEvent;
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
            CoreSecurityEvent::record(
                'unauthenticated_access_attempt',
                'info',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['required_permission' => $permission])
            );

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

        CoreSecurityEvent::record(
            'permission_denied',
            'warning',
            $request->ip(),
            CoreSecurityEvent::contextFromRequest($request, ['required_permission' => $permission])
        );

        return response()->json(['message' => 'Nedostatečná oprávnění.'], 403);
    }
}