<?php
/**
 * @file CoreEmailAccessPolicyController.php
 * @path app/Http/Controllers/Api/Core/CoreEmailAccessPolicyController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description E-mail access policy of admin accounts: the company domain
 * (`CoreSecuritySetting.primary_email_domain`) + a whitelist of further domains / single
 * e-mails (`CoreEmailAccessRule`).
 * @note SYSADMIN ONLY (a security policy, not ordinary administration): no `permission:`
 * middleware on the routes, the sysadmin role is checked in every method (same pattern as
 * CoreRoleController). This controller manages the policy DATA; it is enforced when an account
 * is created (UserController) and at every login / request.
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
use App\Traits\RequiresPasswordConfirmation;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CoreEmailAccessPolicyController extends Controller
{
    use LogsActivity, RequiresPasswordConfirmation;

    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /** Refusal of a change that would lock the acting sysadmin out (see the file header). */
    private const SELF_LOCKOUT_MESSAGE = 'This change would block your own login: your e-mail would no longer be allowed. Add an exception for it first.';

    /**
     * @description Returns the company domain and the whole whitelist (domains and e-mails).
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
     * @description Sets the company e-mail domain (or clears it - `null` = no restriction).
     */
    public function updatePrimaryDomain(Request $request): JsonResponse
    {
        if (!$this->actorIsSysadmin($request)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'primary_email_domain' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i'],
        ], [
            'primary_email_domain.regex' => 'Please enter a valid domain (e.g. example.com), without "@" or path.',
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
     * @description Adds a whitelist entry (a domain or a single e-mail).
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
     * @description Deletes a whitelist entry (permanently - a short configuration list, no trash).
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
     *   sysadmin's own e-mail is still allowed afterwards (no self lock-out, see the header) and
     *   the change is confirmed with the password (scope `email-policy`, 2026-10-26).
     * @param Request $request Request of the acting sysadmin.
     * @param \Closure $change The write (update / delete) to apply.
     * @return JsonResponse|null The 422 / 403 refusal (change rolled back), or null when kept.
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

        // Step-up confirmation (2026-10-26) - checked last, so a change refused for the lock-out
        // does not use up the password confirmation.
        if ($refusal = $this->requirePasswordConfirmation($request, 'email-policy')) {
            DB::rollBack();
            return $refusal;
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