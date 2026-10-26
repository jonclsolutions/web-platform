<?php
/**
 * @file PasswordConfirmationController.php
 * @path app/Http/Controllers/Api/Auth/PasswordConfirmationController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-26
 * @description POST /api/confirm-password - the signed-in user confirms its password for ONE
 *   sensitive operation (scope), see App\Traits\RequiresPasswordConfirmation. A wrong password
 *   is a security event (a stolen session trying to escalate); after MAX_FAILURES wrong passwords
 *   the account may not try again for FAILURE_DECAY_SECONDS (429) - guessing is not possible,
 *   while a legitimate sysadmin doing several operations in a row is not slowed down.
 * @dependencies
 * - RequiresPasswordConfirmation (storing the confirmation), CoreSecurityEvent, CoreLog.
 */

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreSecurityEvent;
use App\Traits\LogsActivity;
use App\Traits\RequiresPasswordConfirmation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class PasswordConfirmationController extends Controller
{
    use LogsActivity;
    use RequiresPasswordConfirmation;

    /** Wrong passwords allowed per account before the confirmation is locked. */
    private const MAX_FAILURES = 5;

    /** Lock window after MAX_FAILURES wrong passwords (seconds). */
    private const FAILURE_DECAY_SECONDS = 900;

    /**
     * @description Checks the password and stores a single-use confirmation for the scope.
     * @param Request $request {password, scope} of the signed-in user.
     * @return JsonResponse 204 confirmed; 403 PASSWORD_INCORRECT; 422 invalid input; 429 locked.
     */
    public function confirm(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'max:255'],
            'scope'    => ['required', 'string', 'max:64', 'regex:' . self::CONFIRMATION_SCOPE_PATTERN],
        ]);

        $user = $request->user();
        $failuresKey = "password-confirmation-failed:{$user->id}";

        if (RateLimiter::tooManyAttempts($failuresKey, self::MAX_FAILURES)) {
            return response()->json([
                'message'     => 'Too many wrong passwords. Please try again later.',
                'retry_after' => RateLimiter::availableIn($failuresKey),
            ], 429);
        }

        if (!$user->user_password_hash || !Hash::check($validated['password'], $user->user_password_hash)) {
            RateLimiter::hit($failuresKey, self::FAILURE_DECAY_SECONDS);
            CoreSecurityEvent::record(
                'password_confirmation_failed',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['user_id' => $user->id, 'scope' => $validated['scope']])
            );
            $this->logAction($request, CoreLog::class, 'password_confirmation_failed', 'Auth', "Wrong password when confirming '{$validated['scope']}': {$user->user_email}", $user->id, 'User');

            return response()->json(['message' => 'The password is incorrect.', 'error_code' => 'PASSWORD_INCORRECT'], 403);
        }

        RateLimiter::clear($failuresKey);
        $this->grantPasswordConfirmation($request, $validated['scope']);
        $this->logAction($request, CoreLog::class, 'password_confirmed', 'Auth', "Password confirmed for '{$validated['scope']}': {$user->user_email}", $user->id, 'User');

        return response()->json(null, 204);
    }
}
