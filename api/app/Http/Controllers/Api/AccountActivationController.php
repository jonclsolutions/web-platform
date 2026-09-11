<?php
/**
 * @file AccountActivationController.php
 * @path app/Http/Controllers/Api/AccountActivationController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Public (unauthenticated) endpoints for activating an account created by an admin -
 * verification of link validity (`show`) and setting the initial password (`activate`). An account that
 * is blocked (`is_blocked`) CANNOT be activated, even with a valid token.
 * @note Upon successful activation, the user is NOT automatically logged in - the frontend redirects
 * to login (decided in backlog: "redirect to login").
 * @dependencies
 * - AccountActivationToken: token model, hashed in DB, see its header.
 * - LogsActivity: shared audit trait, same call as the rest of admin controllers.
 * - CoreSecurityEvent: security monitoring, see refactor-note below.
 *
 * @bugfix-note (2026-08-24) BACKLOG "security_events must cover ALL attack types":
 * invalid/expired activation token and attempt to activate a blocked account previously
 * were not logged at all - neither to `core_logs` nor to `core_security_events`. The token is
 * a 64-character random string, so guessing one specific token is practically
 * impossible, BUT the endpoint gives an attacker the ability to SET A PASSWORD on a foreign account if the
 * token is guessed or leaked (log leak, accidental shared link) - hence defense
 * in depth applies here as well. Two writes added:
 * - `account_activation_token_invalid` (warning) in `findValidToken()` - token
 *   does not exist or has expired. Shared by both public methods (`show()`/`activate()`).
 * - `account_activation_blocked_account` (warning) in `activate()` - token is valid,
 *   but the account was blocked in the meantime. Signals that someone holds a link to an account that
 *   the admin intentionally blocked in the meantime (e.g., employee left before setting
 *   a password).
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountActivationToken;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreSecurityEvent;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AccountActivationController extends Controller
{
    use LogsActivity;

    /**
     * @description Verifies the validity of the activation link WITHOUT consuming it - the frontend
     * displays either the password form or an error message based on the result. The token is
     * not invalidated here, only read.
     */
    public function show(Request $request, string $token): JsonResponse
    {
        $record = $this->findValidToken($request, $token);
        if ($record instanceof JsonResponse) {
            return $record;
        }

        $user = User::find($record->user_id);
        if (!$user || $user->is_blocked) {
            return response()->json(['message' => 'The account is blocked or does not exist.'], 403);
        }

        return response()->json([
            'email'     => $user->user_email,
            'full_name' => $user->full_name,
        ]);
    }

    /**
     * @description Sets the password, activates the account (`activated_at`), and consumes the token
     * (deletes ALL activation tokens of the user, not just the used one - safety against
     * concurrent issuance of a second token, which theoretically should not happen, see
     * `AccountActivationToken::issueFor()`, but it is a cheap additional safeguard).
     */
    public function activate(Request $request, string $token): JsonResponse
    {
        $record = $this->findValidToken($request, $token);
        if ($record instanceof JsonResponse) {
            return $record;
        }

        $user = User::find($record->user_id);
        if (!$user) {
            $record->delete();
            return response()->json(['message' => 'Account not found.'], 404);
        }

        if ($user->is_blocked) {
            CoreSecurityEvent::record(
                'account_activation_blocked_account',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['user_id' => $user->id])
            );

            return response()->json(['message' => 'The account has been blocked. Please contact the administrator.'], 403);
        }

        $validated = $request->validate([
            'password'              => ['required', 'string', 'max:16', Password::min(8)->letters()->numbers()->symbols()],
            'password_confirmation' => ['required', 'same:password'],
        ], [
            'password.required'          => 'Password is required.',
            'password_confirmation.same' => 'Passwords do not match.',
        ]);

        $user->update([
            'user_password_hash' => Hash::make($validated['password']),
            'activated_at'       => now(),
        ]);

        AccountActivationToken::where('user_id', $user->id)->delete();

        $this->logAction($request, CoreLog::class, 'account_activated', 'User', "Account activated: {$user->user_email}", $user->id, 'User');

        return response()->json(['message' => 'Password has been set. You can now log in.']);
    }

    /**
     * @description Shared token verification for show()/activate() - must exist and
     * must not be expired. Returns either a valid model or a ready error JsonResponse
     * (union return type - caller checks `instanceof JsonResponse`). Invalid/
     * expired token logs a security event - see bugfix-note in file header.
     */
    private function findValidToken(Request $request, string $token): AccountActivationToken|JsonResponse
    {
        $record = AccountActivationToken::where('token_hash', hash('sha256', $token))->first();

        if (!$record || !$record->isValid()) {
            CoreSecurityEvent::record(
                'account_activation_token_invalid',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, [
                    'reason' => $record ? 'expired' : 'not_found',
                ])
            );

            return response()->json(['message' => 'The link is invalid or has expired.'], 410);
        }

        return $record;
    }
}