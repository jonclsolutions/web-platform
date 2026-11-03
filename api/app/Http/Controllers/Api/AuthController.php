<?php
/**
 * @file AuthController.php
 * @path app/Http/Controllers/Api/AuthController.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages user authentication, token-based session lifecycle (Access/Refresh
 * tokens), CAPTCHA-gated brute-force protection, and mandatory/optional 2FA verification.
 * @security The access token (60 min) is returned in the body and kept by the admin only in
 * memory. The refresh token (7 days, rotated on every use) is NEVER in a body: it travels only in
 * the HttpOnly / Secure / SameSite=Strict cookie of AuthCookies, limited to POST /api/refresh, so
 * a script (XSS) can neither read it nor keep the account beyond the access token's lifetime.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\VerifyTwoFactorRequest;
use App\Http\Requests\Auth\ResendTwoFactorRequest;
use App\Mail\Auth\TwoFactorCodeMail;
use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CoreSecurityEvent;
use App\Services\Security\CaptchaVerificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use App\Models\{User, RefreshToken, TwoFactorCode};
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use Illuminate\Support\Str;
use App\Http\Resources\UserResource;
use App\Support\Auth\AuthCookies;
use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    use LogsActivity;

    /** Failed attempts (per e-mail) after which the captcha is required. */
    private const CAPTCHA_THRESHOLD = 3;

    /** Window for counting failed attempts per e-mail (seconds). */
    private const FAILED_ATTEMPTS_DECAY_SECONDS = 900; // 15 min

    /**
     * Same message for every account the e-mail access policy refuses. It names neither
     * the domain nor the policy, so it tells nothing about which domains are allowed.
     */
    private const LOGIN_NOT_ALLOWED_MESSAGE = 'Login is not allowed for this account. Please contact the administrator.';

    public function __construct(
        private readonly CaptchaVerificationService $captcha
    ) {}

    /**
     * @description Login step 1: checks the password (+ captcha from the 3rd failed attempt).
     * Blocked and not yet activated accounts are refused BEFORE the password check. When the
     * user needs 2FA, no tokens are issued: a pending-login session is created and the OTP is
     * e-mailed. Otherwise the user is logged in directly.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'         => 'required|string',
            'password'      => 'required',
            'captcha_token' => 'nullable|string',
        ]);

        $request->merge(['user_agent' => $request->userAgent()]);

        $email = User::normalizeEmail((string) $request->input('email'));
        $failedAttemptsKey = 'login-fail:' . $email;
        $attemptsBefore = RateLimiter::attempts($failedAttemptsKey);
        $captchaRequired = $attemptsBefore >= self::CAPTCHA_THRESHOLD;

        if ($captchaRequired) {
            $captchaToken = (string) $request->input('captcha_token');
            $context = CoreSecurityEvent::contextFromRequest($request, ['email' => $email]);

            if (!$this->captcha->verify($captchaToken, $request->ip(), $context)) {
                // A captcha failure is recorded by CaptchaVerificationService::verify() itself.
                $this->logAction($request, CoreLog::class, 'login_captcha_failed', 'Auth', "Invalid or missing captcha for: {$email}", null, 'User');

                return response()->json([
                    'message'          => 'Captcha verification failed. Please try again.',
                    'captcha_required' => true,
                ], 422);
            }
        }


        // ── Blocked / not activated account - MUST be checked BEFORE Auth::attempt() ──────────
        // (an account without a password would reach Hash::check() with an invalid argument
        // instead of a clean JSON answer).
        $targetUser = User::where('user_email', $email)->first();

        if ($targetUser) {
            if ($targetUser->is_blocked) {
                CoreSecurityEvent::record(
                    'login_blocked_account',
                    'warning',
                    $request->ip(),
                    CoreSecurityEvent::contextFromRequest($request, ['email' => $email])
                );
                $this->logAction($request, CoreLog::class, 'login_blocked', 'Auth', "Login attempt on a blocked account: {$email}", $targetUser->id, 'User');

                return response()->json(['message' => 'This account has been blocked. Please contact the administrator.'], 403);
            }

            if (is_null($targetUser->user_password_hash)) {
                return response()->json([
                    'message' => 'The account is not yet activated. Please check your email or ask the administrator to send a new activation link.',
                ], 403);
            }
        }

        if (Auth::attempt(['user_email' => $email, 'password' => $request->password])) {
            /** @var User $user */
            $user = Auth::user();

            // Successful attempt - reset the failure counter of this e-mail.
            RateLimiter::clear($failedAttemptsKey);

            $user->load('roles.permissions');

            // E-mail access policy - checked only now, AFTER the password matched: before
            // it, the answer would let anyone probe which domains are allowed. No tokens
            // and no 2FA code are issued; the message is generic (see the constant).
            if (!$this->emailPolicyAllowsLogin($user)) {
                CoreSecurityEvent::record(
                    'login_email_not_allowed',
                    'warning',
                    $request->ip(),
                    CoreSecurityEvent::contextFromRequest($request, ['email' => $email])
                );
                $this->logAction($request, CoreLog::class, 'login_denied', 'Auth', "Login refused, e-mail not allowed by the e-mail access policy: {$email}", $user->id, 'User');

                return response()->json(['message' => self::LOGIN_NOT_ALLOWED_MESSAGE], 403);
            }

            if ($user->requiresTwoFactor()) {
                return $this->beginTwoFactorChallenge($request, $user);
            }

            return $this->issueTokens($request, $user);
        }

        // Wrong password - increase the counter, log out any partial auth session.
        RateLimiter::hit($failedAttemptsKey, self::FAILED_ATTEMPTS_DECAY_SECONDS);
        $attemptsAfter = RateLimiter::attempts($failedAttemptsKey);

        $securityContext = CoreSecurityEvent::contextFromRequest($request, ['email' => $email]);
        CoreSecurityEvent::record('login_failed', 'warning', $request->ip(), $securityContext);

        // The captcha threshold was crossed right NOW (by this attempt) - a real brute-force
        // suspicion, not a single typo. Recorded as 'critical' to stand out from ordinary
        // login_failed events in the admin.
        if ($attemptsBefore < self::CAPTCHA_THRESHOLD && $attemptsAfter >= self::CAPTCHA_THRESHOLD) {
            CoreSecurityEvent::record('login_brute_force_suspected', 'critical', $request->ip(), $securityContext);
        }

        $this->logAction($request, CoreLog::class, 'login_failed', 'Auth', "Failed login attempt for: {$email}", null, 'User');

        return response()->json([
            'message'          => 'Invalid credentials.',
            'captcha_required' => $attemptsAfter >= self::CAPTCHA_THRESHOLD,
        ], 401);
    }

        /**
     * @description Returns the profile, roles and effective permissions of the signed-in user
     * (the owner of the access token). Same shape as the login response, without tokens.
     * @param Request $request Authenticated request (auth:sanctum).
     * @return JsonResponse
     * @note Exposes only the caller's own account, so no permission check is needed.
     */
    public function user(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->load('roles.permissions');

        return $this->respond($this->sessionPayload($user), 200);
    }

    /**
     * @description Profile, roles and effective permissions of the user - the part of the login,
     * refresh and /user answers the admin builds its session state from.
     * @param User $user User with loaded `roles.permissions`.
     * @return array<string, mixed>
     */
    private function sessionPayload(User $user): array
    {
        return [
            'user'             => new UserResource($user),
            'user_roles'       => $user->roles->pluck('role_name'),
            'user_permissions' => method_exists($user, 'getPermissionsAttribute') ? $user->getPermissionsAttribute() : [],
        ];
    }

    /**
     * @description Creates a pending-login 2FA session: a 6-digit code, stored as a SHA-256 hash
     * (never raw), sent by e-mail (queued). Returns an opaque `login_token` (raw to the client,
     * its hash in the database) for verifyTwoFactor / resendTwoFactor.
     */
    private function beginTwoFactorChallenge(Request $request, User $user): JsonResponse
    {
        // Invalidate earlier unfinished pending-login sessions of this user - only the newest
        // is valid (same principle as password reset tokens).
        TwoFactorCode::where('user_id', $user->id)->whereNull('used_at')->delete();

        $rawLoginToken = Str::random(64);
        $code = (string) random_int(100000, 999999);

        TwoFactorCode::create([
            'user_id'          => $user->id,
            'login_token_hash' => hash('sha256', $rawLoginToken),
            'code_hash'        => hash('sha256', $code),
            'attempts'         => 0,
            'resend_count'     => 0,
            'expires_at'       => now()->addMinutes(TwoFactorCode::CODE_TTL_MINUTES),
            'last_sent_at'     => now(),
            'ip_address'       => $request->ip(),
        ]);

        Mail::to($user->user_email)->send(
            new TwoFactorCodeMail($user, $code, TwoFactorCode::CODE_TTL_MINUTES)
        );

        $this->logAction($request, CoreLog::class, 'login_2fa_challenge_sent', 'Auth', "2FA code sent: {$user->user_email}", $user->id, 'User');

        return $this->respond([
            'requires_2fa' => true,
            'login_token'  => $rawLoginToken,
            'expires_in'   => TwoFactorCode::CODE_TTL_MINUTES * 60,
        ], 200, [], 'Enter the verification code sent to your email.');
    }

    /**
     * @description Login step 2 (users with forced 2FA): checks the OTP code and only then issues
     * the access / refresh tokens.
     */
    public function verifyTwoFactor(VerifyTwoFactorRequest $request): JsonResponse
    {
        $data = $request->validated();
        $tokenHash = hash('sha256', $data['login_token']);

        $pending = TwoFactorCode::where('login_token_hash', $tokenHash)->first();

        if (!$pending || !$pending->isValid()) {
            // Invalid / expired / exhausted pending-login session. Guessing the login_token would
            // (unlike guessing the 6-digit OTP, reported as login_2fa_invalid) mean skipping the
            // password check entirely. Severity 'info' - usually a legitimately expired session;
            // a high volume from one IP still shows through occurrences.
            CoreSecurityEvent::record(
                'login_2fa_session_invalid',
                'info',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request)
            );

            return response()->json([
                'message' => 'The login session has expired or is invalid. Please log in again.',
            ], 401);
        }

        if (!hash_equals($pending->code_hash, hash('sha256', $data['code']))) {
            $pending->increment('attempts');

            $securityContext = CoreSecurityEvent::contextFromRequest($request, ['user_id' => $pending->user_id]);
            CoreSecurityEvent::record('login_2fa_invalid', 'warning', $request->ip(), $securityContext);

            $this->logAction($request, CoreLog::class, 'login_2fa_code_invalid', 'Auth', "Invalid 2FA code (user_id: {$pending->user_id})", $pending->user_id, 'User');

            if ($pending->attempts >= TwoFactorCode::MAX_ATTEMPTS) {
                CoreSecurityEvent::record('login_2fa_exhausted', 'critical', $request->ip(), $securityContext);

                $pending->delete();
                return response()->json([
                    'message' => 'Too many attempts. Please log in again.',
                ], 401);
            }

            return response()->json(['message' => 'Invalid verification code.'], 422);
        }

        $user = User::with('roles.permissions')->find($pending->user_id);
        if (!$user) {
            $pending->delete();
            return response()->json(['message' => 'Account not found.'], 401);
        }

        // Extra safeguard: when the account was blocked BETWEEN sending the OTP and its check
        // (an admin acted during the pending login), the tokens must not be issued.
        if ($user->is_blocked) {
            $pending->delete();
            return response()->json(['message' => 'This account has been blocked. Please contact the administrator.'], 403);
        }

        // Same for the e-mail access policy: it may have changed while the code was on its way.
        if (!$this->emailPolicyAllowsLogin($user)) {
            $pending->delete();
            CoreSecurityEvent::record(
                'login_email_not_allowed',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['user_id' => $user->id])
            );
            return response()->json(['message' => self::LOGIN_NOT_ALLOWED_MESSAGE], 403);
        }

        $pending->used_at = now();
        $pending->save();
        $pending->delete();

        return $this->issueTokens($request, $user);
    }

    /**
     * @description Sends the OTP code again for an existing pending-login session. Protected by a
     * 60 s cooldown and a hard cap of resends per session (TwoFactorCode constants) and the
     * 'login-2fa-resend' rate limiter of the route (AppServiceProvider).
     */
    public function resendTwoFactor(ResendTwoFactorRequest $request): JsonResponse
    {
        $tokenHash = hash('sha256', $request->validated()['login_token']);
        $pending = TwoFactorCode::where('login_token_hash', $tokenHash)->first();

        if (!$pending || is_null($pending->expires_at) || $pending->used_at) {
            // Same event_type as in verifyTwoFactor() - the same situation (invalid / expired / used
            // login_token), only in another step of the 2FA flow.
            CoreSecurityEvent::record(
                'login_2fa_session_invalid',
                'info',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request)
            );

            return response()->json(['message' => 'The login session has expired or is invalid.'], 401);
        }

        if ($pending->isInCooldown()) {
            $waitSeconds = TwoFactorCode::RESEND_COOLDOWN_SECONDS - $pending->last_sent_at->diffInSeconds(now());
            return response()->json([
                'message'      => 'A new code can be requested only after the cooldown period has passed.',
                'retry_after'  => max(1, $waitSeconds),
            ], 429);
        }

        if ($pending->resend_count >= TwoFactorCode::MAX_RESENDS) {
            CoreSecurityEvent::record(
                'login_2fa_resend_exhausted',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['user_id' => $pending->user_id])
            );

            $pending->delete();
            return response()->json([
                'message' => 'Too many code requests. Please log in again.',
            ], 429);
        }

        $user = User::find($pending->user_id);
        if (!$user) {
            $pending->delete();
            return response()->json(['message' => 'Account not found.'], 401);
        }

        $code = (string) random_int(100000, 999999);

        $pending->code_hash = hash('sha256', $code);
        $pending->expires_at = now()->addMinutes(TwoFactorCode::CODE_TTL_MINUTES);
        $pending->last_sent_at = now();
        $pending->resend_count += 1;
        $pending->attempts = 0; // New code = attempts reset.
        $pending->save();

        Mail::to($user->user_email)->send(
            new TwoFactorCodeMail($user, $code, TwoFactorCode::CODE_TTL_MINUTES)
        );

        $this->logAction($request, CoreLog::class, 'login_2fa_code_resent', 'Auth', "2FA code resent (user_id: {$user->id})", $user->id, 'User');

        return $this->respond([
            'expires_in' => TwoFactorCode::CODE_TTL_MINUTES * 60,
        ], 200, [], 'A new code has been sent.');
    }

    /**
     * @description Issues the access + refresh token to the authenticated user. Shared by the
     * direct login (no 2FA) and the finished 2FA verification. The access token is in the body,
     * the refresh token only in its HttpOnly cookie.
     */
    private function issueTokens(Request $request, User $user): JsonResponse
    {
        $user->update(['last_login_at' => now()]);

        $accessToken = $user->createToken('access-token', ['*'], now()->addMinutes(60))->plainTextToken;
        $refreshToken = Str::random(60);

        RefreshToken::where('user_id', $user->id)->delete();
        RefreshToken::create([
            'user_id'    => $user->id,
            'token'      => hash('sha256', $refreshToken),
            'expires_at' => now()->addDays(AuthCookies::REFRESH_TTL_DAYS),
        ]);

        $this->logAction($request, CoreLog::class, 'login_success', 'Auth', "User logged in: {$user->user_email}", $user->id, 'User');

        return $this->respond($this->sessionPayload($user) + ['token' => $accessToken], 200, [], 'Login successful!')
            ->withCookie(AuthCookies::refresh($request, $refreshToken));
    }

    /**
     * @description Refreshes the session with the refresh token of the HttpOnly cookie: rotates it
     * (new cookie) and returns a new access token together with the profile, roles and permissions
     * - the admin also uses this call to restore its session after a page reload.
     * @note Checks `is_blocked` again: an account blocked between issuing the refresh token and
     * using it must not get a new access token. Every refusal deletes the cookie.
     * @note Only the access token sent with the request (and the expired ones) is revoked, not
     * every token of the user - several tabs of the same browser share the cookie and each keeps
     * its own access token in memory; revoking all of them would log the tabs out in turn.
     */
    public function refresh(Request $request): JsonResponse
    {
        $refreshToken = (string) $request->cookie(AuthCookies::REFRESH);
        if ($refreshToken === '') {
            return response()->json(['message' => 'Refresh token is missing.'], 401)
                ->withCookie(AuthCookies::forgetRefresh($request));
        }

        $hashedRefreshToken = hash('sha256', $refreshToken);
        $dbRefreshToken = RefreshToken::with('user')
                                     ->where('token', $hashedRefreshToken)
                                     ->where('expires_at', '>', now())
                                     ->first();

        if (!$dbRefreshToken || !$dbRefreshToken->user) {
            // 'info', not 'warning' - an expired refresh token is normal (the user was away for a long
            // time), not a sign of an attack. A high volume from one IP still shows through
            // `occurrences` in the admin.
            CoreSecurityEvent::record(
                'refresh_token_invalid',
                'info',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request)
            );

            return response()->json(['message' => 'Invalid or expired token.'], 401)
                ->withCookie(AuthCookies::forgetRefresh($request));
        }

        $user = $dbRefreshToken->user;

        if ($user->is_blocked) {
            $dbRefreshToken->delete();
            CoreSecurityEvent::record(
                'refresh_blocked_account',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['user_id' => $user->id])
            );
            return response()->json(['message' => 'This account has been blocked. Please contact the administrator.'], 403)
                ->withCookie(AuthCookies::forgetRefresh($request));
        }

        // E-mail access policy.
        if (!$this->emailPolicyAllowsLogin($user)) {
            $dbRefreshToken->delete();
            $user->tokens()->delete();
            CoreSecurityEvent::record(
                'refresh_email_not_allowed',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['user_id' => $user->id])
            );
            return response()->json(['message' => self::LOGIN_NOT_ALLOWED_MESSAGE], 403)
                ->withCookie(AuthCookies::forgetRefresh($request));
        }

        $dbRefreshToken->delete();
        $this->revokeReplacedAccessTokens($request, $user);

        $newAccessToken = $user->createToken('access-token', ['*'], now()->addMinutes(60))->plainTextToken;
        $newRefreshToken = Str::random(60);

        RefreshToken::create([
            'user_id'    => $user->id,
            'token'      => hash('sha256', $newRefreshToken),
            'expires_at' => now()->addDays(AuthCookies::REFRESH_TTL_DAYS),
        ]);

        $user->load('roles.permissions');

        return $this->respond($this->sessionPayload($user) + ['token' => $newAccessToken], 200)
            ->withCookie(AuthCookies::refresh($request, $newRefreshToken));
    }

    /**
     * @description Revokes the access token the refreshing tab sent (it is being replaced) and
     * every expired access token of the user.
     * @param Request $request Refresh request (optional `Authorization: Bearer` of the old token).
     * @param User $user Owner of the refresh token.
     * @return void
     */
    private function revokeReplacedAccessTokens(Request $request, User $user): void
    {
        $bearer = $request->bearerToken();
        if ($bearer) {
            $old = PersonalAccessToken::findToken($bearer);
            if ($old && $old->tokenable_type === $user->getMorphClass() && (int) $old->tokenable_id === (int) $user->id) {
                $old->delete();
            }
        }

        $user->tokens()->where('expires_at', '<=', now())->delete();
    }

    /**
     * @description Whether the account may log in under the e-mail access policy
     * (`CoreEmailAccessRule::isEmailAllowed()`) - the same rule for EVERY role.
     * @param User $user The account that has just proved its credentials (or refresh token / 2FA code).
     * @return bool True when the login may continue.
     */
    private function emailPolicyAllowsLogin(User $user): bool
    {
        return CoreEmailAccessRule::isEmailAllowed((string) $user->user_email);
    }

    /**
     * @description Ends the session of the user: revokes every access token and the refresh token
     * and deletes the refresh cookie.
     * @note The refresh cookie is not sent to this route (its Path is the refresh route), so the
     * refresh token is revoked by its owner - there is one refresh session per user anyway
     * (issueTokens() replaces the previous one). All access tokens go too: the other tabs of the
     * browser shared that session.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            $request->merge(['user_agent' => $request->userAgent()]);
            $this->logAction($request, CoreLog::class, 'logout', 'Auth', "User logged out: {$user->user_email}", $user->id, 'User');
            $user->tokens()->delete();
            RefreshToken::where('user_id', $user->id)->delete();
        }

        return response()->json(['message' => 'Logout successful!'], 200)
            ->withCookie(AuthCookies::forgetRefresh($request));
    }
}