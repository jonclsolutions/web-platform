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
 *   (Historical - since finding #6, 2026-10-24, every answer is the envelope `{data, meta?}`
 *   and DataHandler always reads `data`; the per-method convention above no longer applies.)
 * @refactor-note (2026-10-24) Open finding #6: success answers go through `respond()` /
 *   `respondPaginated()` - one envelope `{data, meta?}` (App\Traits\RespondsWithData).
 * @bugfix-note (2026-10-24) SECURITY: the policy now applies to every role, sysadmin included
 *   (AuthController). Two consequences are handled here:
 *   1) NO SELF LOCK-OUT - a primary-domain change or a deleted rule that would exclude the
 *      ACTING sysadmin's own e-mail is refused (422, `EMAIL_POLICY_SELF_LOCKOUT`). So at least
 *      the sysadmin who edits the policy can always log in again and fix it.
 *   2) IMMEDIATE EFFECT - after a change that may exclude accounts (primary domain changed,
 *      rule deleted) the sessions of every account the policy no longer allows are ended at
 *      once (access + refresh tokens, pending 2FA logins); before, an open session lived on
 *      until its access token expired (60 min). The count is returned in
 *      `meta.sessions_revoked` and written to the core log.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreSecuritySetting;
use App\Models\RefreshToken;
use App\Models\TwoFactorCode;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CoreEmailAccessPolicyController extends Controller
{
    use LogsActivity;

    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /** Refusal of a change that would lock the acting sysadmin out (see the file header). */
    private const SELF_LOCKOUT_MESSAGE = 'This change would block your own login: your e-mail would no longer be allowed. Add an exception for it first.';

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

        return $this->respond([
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

        $refusal = $this->applyUnlessSelfLockout($request, fn () => $setting->update(['primary_email_domain' => $normalized]));
        if ($refusal) {
            return $refusal;
        }

        $this->logAction(
            $request,
            CoreLog::class,
            'email_access_primary_domain_updated',
            'Core',
            "Primary email domain changed from " . ($previous ?: '(no restriction)') . " to " . ($normalized ?: '(no restriction)') . ".",
            $setting->id,
            'CoreSecuritySetting'
        );

        return $this->respond($setting, 200, ['sessions_revoked' => $this->revokeSessionsOutsidePolicy($request)]);
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

        return $this->respond($rule, 201);
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

        $refusal = $this->applyUnlessSelfLockout($request, fn () => $rule->delete());
        if ($refusal) {
            return $refusal;
        }

        $this->logAction($request, CoreLog::class, 'email_access_rule_deleted', 'Core', $description, (int) $id, 'CoreEmailAccessRule');

        return $this->respond(null, 200, ['sessions_revoked' => $this->revokeSessionsOutsidePolicy($request)], 'Item has been deleted.');
    }

    /**
     * @description Applies a policy change in a transaction and keeps it only when the acting
     *   sysadmin's own e-mail is still allowed afterwards (no self lock-out, see the header).
     * @param Request $request Request of the acting sysadmin.
     * @param \Closure $change The write (update / delete) to apply.
     * @return JsonResponse|null The 422 refusal (change rolled back), or null when kept.
     */
    private function applyUnlessSelfLockout(Request $request, \Closure $change): ?JsonResponse
    {
        $actorEmail = (string) $request->user()->user_email;

        DB::beginTransaction();
        try {
            $change();
            $keepsActorIn = CoreEmailAccessRule::isEmailAllowed($actorEmail);
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        if (!$keepsActorIn) {
            DB::rollBack();
            $this->logAction($request, CoreLog::class, 'email_access_change_refused', 'Core', 'Refused an e-mail policy change that would lock out the acting sysadmin.', null, 'CoreEmailAccessRule');

            return response()->json(['message' => self::SELF_LOCKOUT_MESSAGE, 'error_code' => 'EMAIL_POLICY_SELF_LOCKOUT'], 422);
        }

        DB::commit();
        return null;
    }

    /**
     * @description Ends the sessions of every account the (changed) policy no longer allows:
     *   Sanctum access tokens, refresh tokens and pending 2FA logins. Every role counts, the
     *   acting sysadmin is always allowed (applyUnlessSelfLockout()).
     * @param Request $request Request of the acting sysadmin (for the log).
     * @return int Number of accounts whose sessions were ended.
     */
    private function revokeSessionsOutsidePolicy(Request $request): int
    {
        $allowed = CoreEmailAccessRule::policyChecker();
        $revoked = 0;

        User::query()->select(['id', 'user_email'])->chunkById(200, function ($users) use ($allowed, &$revoked) {
            foreach ($users as $user) {
                if ($allowed((string) $user->user_email)) {
                    continue;
                }
                $ended = $user->tokens()->delete()
                    + RefreshToken::where('user_id', $user->id)->delete()
                    + TwoFactorCode::where('user_id', $user->id)->delete();
                if ($ended > 0) {
                    $revoked++;
                }
            }
        });

        if ($revoked > 0) {
            $this->logAction($request, CoreLog::class, 'email_access_sessions_revoked', 'Core', "Ended the sessions of {$revoked} account(s) no longer allowed by the e-mail access policy.", null, 'User');
        }

        return $revoked;
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