<?php
/**
 * @file RequiresPasswordConfirmation.php
 * @path app/Traits/RequiresPasswordConfirmation.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-26
 * @description Step-up authentication for operations on sysadmin accounts and on the e-mail
 *   access policy (re-authentication for sensitive operations, OWASP ASVS V2/V3). A stolen
 *   access token or an unattended browser of a sysadmin must not be enough to create / promote /
 *   edit / demote / delete / restore a sysadmin or to change who may log in.
 *
 *   Flow: the client confirms its password at POST /api/confirm-password for one SCOPE
 *   (e.g. `user:25`, `user:new`, `email-policy`); the API stores a confirmation for that
 *   scope, bound to the user AND the access token, valid CONFIRMATION_TTL_MINUTES. The guarded
 *   operation consumes it (single use) - every operation needs its own confirmation. Without
 *   one the operation answers 403 `PASSWORD_CONFIRMATION_REQUIRED` with the scope, the admin
 *   frontend then asks for the password and repeats the request.
 * @note The password itself never reaches the guarded endpoint (no password in DELETE bodies,
 *   query strings or audit logs) and is not kept in the browser between the dialog and the save.
 * @dependencies
 * - Illuminate\Support\Facades\Cache (application cache store).
 */

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

trait RequiresPasswordConfirmation
{
    /** Validity of a confirmation (minutes) - long enough to fill in an edit form. */
    public const CONFIRMATION_TTL_MINUTES = 10;

    /** Allowed shape of a scope: `name` or `name:id` (lower case, digits, dashes). */
    public const CONFIRMATION_SCOPE_PATTERN = '/^[a-z][a-z-]*(:[a-z0-9-]+)?$/';

    /**
     * @description Cache key of a confirmation - bound to the user, its current access token
     *   (another session of the same user cannot use it) and the scope.
     * @param Request $request Authenticated request.
     * @param string $scope Operation scope.
     * @return string
     */
    protected function passwordConfirmationKey(Request $request, string $scope): string
    {
        $user = $request->user();
        $tokenId = $user?->currentAccessToken()?->getKey() ?? 'none';

        return "password-confirmation:{$user?->getKey()}:{$tokenId}:{$scope}";
    }

    /**
     * @description Stores a confirmation for the scope (called after the password matched).
     * @param Request $request Authenticated request.
     * @param string $scope Operation scope.
     * @return void
     */
    protected function grantPasswordConfirmation(Request $request, string $scope): void
    {
        Cache::put($this->passwordConfirmationKey($request, $scope), true, now()->addMinutes(self::CONFIRMATION_TTL_MINUTES));
    }

    /**
     * @description Consumes the confirmation of the scope, or answers why the operation is refused.
     * @param Request $request Authenticated request.
     * @param string $scope Operation scope.
     * @return JsonResponse|null null = confirmed (and consumed); 403 PASSWORD_CONFIRMATION_REQUIRED otherwise.
     */
    protected function requirePasswordConfirmation(Request $request, string $scope): ?JsonResponse
    {
        if (Cache::pull($this->passwordConfirmationKey($request, $scope))) {
            return null;
        }

        return response()->json([
            'message'    => 'Confirm this operation with your password.',
            'error_code' => 'PASSWORD_CONFIRMATION_REQUIRED',
            'scope'      => $scope,
        ], 403);
    }
}
