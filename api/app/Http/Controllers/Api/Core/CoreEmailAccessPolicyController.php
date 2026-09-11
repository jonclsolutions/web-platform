<?php
/**
 * @file CoreEmailAccessPolicyController.php
 * @path app/Http/Controllers/Api/Core/CoreEmailAccessPolicyController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Správa politiky povolených e-mailových domén pro vytváření admin účtů
 * (BACKLOG "core-admin-email-domain-restriction") - hlavní doména firmy
 * (`CoreSecuritySetting.primary_email_domain`) + whitelist dalších domén/konkrétních
 * e-mailů (`CoreEmailAccessRule`).
 * @note VÝHRADNĚ SYSADMIN - jde o bezpečnostní politiku, ne běžnou administrátorskou
 * operaci (rozhodnutí zadavatele: "tato featura bude jak UI tak backend dostupná jen
 * pro sysadmina"). Stejný vzor jako `CoreRoleController` - ŽÁDNÉ `permission:`
 * middleware na routách, kontrola role `sysadmin` přímo v každé metodě. Skutečné
 * vynucení domény při vytváření účtu je v `UserController::store()`
 * (`assertEmailDomainAllowed()`) - tenhle kontroler jen spravuje DATA politiky.
 *
 * @bugfix-note (2026-08-25) KONVENCE ODBALOVÁNÍ ODPOVĚDI - `DataHandler` na frontendu
 * (viz data-handler.service.ts) se chová TAKHLE a MUSÍ se přesně dodržet u KAŽDÉ
 * metody, jinak frontend dostane `undefined` bez jakékoliv chyby na backendu:
 * - `get<T>()`   -> NEODBALUJE nic, vrací celé tělo odpovědi tak, jak přišlo.
 * - `post<T>()`  -> VŽDY odbaluje `response.data` (`map(response => response.data)`).
 * - `put<T>()`   -> VŽDY odbaluje `response.data` (u JSON payloadu).
 * - `delete()`   -> vrací `Observable<void>`, tělo odpovědi se nečte vůbec.
 * `show()` proto vrací PLAIN JSON (žádný obal), `updatePrimaryDomain()` a `storeRule()`
 * MUSÍ obalovat do `{data: ...}`, jinak dojde přesně k bugu, který se stal při prvním
 * nasazení: `storeRule()` vracelo neobalený `$rule`, `post()` z něj udělalo
 * `response.data` (tedy `undefined`), frontend přidal do seznamu `undefined` a šablona
 * spadla na `{{ rule.value }}` - záznam se přitom do DB zapsal správně, chyba byla
 * čistě v přenosu odpovědi zpět.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreSecuritySetting;
use App\Traits\LogsActivity;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Validation\Rule;

class CoreEmailAccessPolicyController extends Controller
{
    use LogsActivity;

    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * @description Vrátí aktuální hlavní doménu a celý whitelist (domény i e-maily).
     * NEobalené v `{data: ...}` - konzumováno přes `DataHandler.get()`, který
     * neodbaluje (stejná konvence jako `CoreSecuritySettingController::show()`).
     */
    public function show(Request $request): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            return $this->forbidden();
        }

        return response()->json([
            'primary_email_domain' => CoreSecuritySetting::current()->primary_email_domain,
            'rules' => CoreEmailAccessRule::orderBy('type')->orderBy('value')->get(['id', 'type', 'value']),
        ]);
    }

    /**
     * @description Nastaví hlavní e-mailovou doménu (nebo ji vynuluje na `null` =
     * "bez omezení"). Obalené v `{data: ...}` - konzumováno přes `DataHandler.put()`,
     * který `response.data` automaticky odbaluje (stejná konvence jako
     * `CoreSecuritySettingController::update()`).
     */
    public function updatePrimaryDomain(Request $request): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'primary_email_domain' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i'],
        ], [
            'primary_email_domain.regex' => 'Please enter a valid domain (e.g. rpsw.cz), without "@" or path.',
        ]);

        $normalized = $validated['primary_email_domain'] ?? null;
        $normalized = $normalized !== null ? strtolower(trim($normalized)) : null;

        $setting = CoreSecuritySetting::current();
        $previous = $setting->primary_email_domain;

        $setting->update(['primary_email_domain' => $normalized]);

        $this->logAction(
            $request,
            CoreLog::class,
            'email_access_primary_domain_updated',
            'Core',
            "Primary email domain changed from " . ($previous ?: '(no restriction)') . " to " . ($normalized ?: '(no restriction)') . ".",
            $setting->id,
            'CoreSecuritySetting'
        );

        return response()->json(['data' => $setting]);
    }

    /**
     * @description Přidá novou položku do whitelistu (doménu nebo konkrétní e-mail).
     * Obalené v `{data: ...}` - konzumováno přes `DataHandler.post()`, který
     * `response.data` VŽDY automaticky odbaluje (viz data-handler.service.ts).
     * @bugfix-note (2026-08-25) KRITICKÝ BUG: dřív vracelo neobalený `$rule` přímo -
     * `DataHandler.post()` z něj udělal `response.data`, což bylo `undefined` (žádné
     * `.data` pole v neobalené odpovědi), takže frontend přidal do seznamu `undefined`
     * a šablona spadla na `{{ rule.value }}`. Záznam se přitom do DB zapsal správně -
     * chyba byla čistě v přenosu odpovědi zpět.
     */
    public function storeRule(Request $request): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'type'  => ['required', Rule::in(['domain', 'email'])],
            'value' => ['required', 'string', 'max:255'],
        ]);

        if ($validated['type'] === 'email') {
            $request->validate(['value' => ['email']]);
        }

        $normalizedValue = strtolower(trim($validated['value']));
        if ($validated['type'] === 'domain') {
            $normalizedValue = ltrim($normalizedValue, '@');
        }

        $exists = CoreEmailAccessRule::where('type', $validated['type'])
            ->where('value', $normalizedValue)
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'This item is already on the whitelist.'], 422);
        }

        $rule = CoreEmailAccessRule::create([
            'type'  => $validated['type'],
            'value' => $normalizedValue,
        ]);

        $this->logAction(
            $request,
            CoreLog::class,
            'email_access_rule_created',
            'Core',
            "Added whitelist item (" . $validated['type'] . "): {$rule->value}",
            $rule->id,
            'CoreEmailAccessRule'
        );

        return response()->json(['data' => $rule], 201);
    }

    /**
     * @description Smaže položku z whitelistu (trvale - žádný koš, jde o krátký
     * konfigurační seznam, ne byznys entitu).
     */
    public function destroyRule(Request $request, string $id): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            return $this->forbidden();
        }

        $rule = CoreEmailAccessRule::findOrFail($id);
        $description = "Deleted whitelist item ({$rule->type}): {$rule->value}";
        $rule->delete();

        $this->logAction($request, CoreLog::class, 'email_access_rule_deleted', 'Core', $description, (int) $id, 'CoreEmailAccessRule');

        return response()->json(['message' => 'Item has been deleted.']);
    }

    private function actorIsSysadmin(Request $request): bool
    {
        return $request->user()
            ?->roles()
            ->where('role_name', self::SYSADMIN_ROLE_NAME)
            ->exists() ?? false;
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'This action requires the sysadmin role.'], 403);
    }
}