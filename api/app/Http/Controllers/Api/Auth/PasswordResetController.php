<?php

/**
 * @file PasswordResetController.php
 * @path app/Http/Controllers/Api/Auth/PasswordResetController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Password reset of an admin account:
 *              1) POST /forgot-password - request a reset (always the same answer - no account enumeration)
 *              2) POST /reset-password  - finish it (token check, new password stored)
 * @dependencies
 * - App\Models\User: admin account (login = user_email)
 * - App\Models\PasswordResetToken: one-time token with expiry
 * - App\Models\Core\CoreLog / App\Traits\LogsActivity: shared auth audit log (core_logs, the same
 *   table AuthController writes login_success / login_failed / logout to)
 * - App\Models\Core\CoreSecurityEvent: security monitoring (separate from the audit log)
 * - App\Mail\Auth\PasswordResetRequested / PasswordChangedNotification: e-mail notifications
 */

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Mail\Auth\PasswordChangedNotification;
use App\Mail\Auth\PasswordResetRequested;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreSecurityEvent;
use App\Models\PasswordResetToken;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    use LogsActivity;

    /** Validity of the reset link in minutes. */
    private const TOKEN_TTL_MINUTES = 15;

    /**
     * Maximum reset requests for ONE e-mail within the window (regardless of the IP) - protects
     * the mailbox from flooding even when the attacker rotates IP addresses (the IP throttle of
     * the route does not cover that).
     */
    private const EMAIL_MAX_ATTEMPTS = 3;

    /** Window of the per-e-mail limit in seconds (15 minutes - same as the token validity). */
    private const EMAIL_DECAY_SECONDS = 900;

    /**
     * @description Accepts an e-mail; when the account exists, creates a token and sends the link.
     *              The answer is ALWAYS the same - whether the account exists or the per-e-mail
     *              limit refused the request (no user enumeration).
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $email = mb_strtolower(trim($request->validated()['email']));

        $genericResponse = response()->json([
            'message' => 'If an account with this email exists, a password reset link has been sent to it.',
        ]);

        // ── Per-e-mail rate limit (independent of the IP throttle of the route) ──────────
        // Checked BEFORE the account lookup and with the SAME answer in both cases, so the
        // behaviour does not reveal whether the account exists.
        $emailLimiterKey = 'password-reset-email:' . $email;

        if (RateLimiter::tooManyAttempts($emailLimiterKey, self::EMAIL_MAX_ATTEMPTS)) {
            $this->logAttempt('password_reset_email_rate_limited', $request, null, [
                'email_requested' => $email,
            ]);

            // A dedicated per-e-mail limiter (the IP throttle of the route reports 'throttle_exceeded'
            // through the global handler).
            CoreSecurityEvent::record(
                'password_reset_email_rate_limited',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['email_requested' => $email])
            );

            // Silent refusal - the same generic answer, no e-mail, the attacker cannot tell
            // that the limit was hit.
            return $genericResponse;
        }

        // Every attempt counts (also for unknown e-mails), otherwise the limit could be bypassed
        // by "testing" unknown addresses first.
        RateLimiter::hit($emailLimiterKey, self::EMAIL_DECAY_SECONDS);

        $user = User::whereRaw('LOWER(user_email) = ?', [$email])->first();

        $this->logAttempt('password_reset_requested', $request, $user?->id, [
            'email_requested' => $email,
        ]);

        if (!$user) {
            // Unknown account - same answer, no e-mail.
            return $genericResponse;
        }

        // Delete all earlier unused tokens of the user - only the newest link is valid.
        PasswordResetToken::where('user_id', $user->id)->delete();

        $rawToken  = Str::random(64);
        $tokenHash = hash('sha256', $rawToken);

        PasswordResetToken::create([
            'user_id'    => $user->id,
            'token_hash' => $tokenHash,
            'expires_at' => now()->addMinutes(self::TOKEN_TTL_MINUTES),
        ]);

        $frontendUrl = rtrim(config('app.frontend_url'), '/');
        // The frontend route is a public page next to the login: 'auth/login' -> 'auth/reset-password'
        // (app.routes.ts, outside AdminRoutingModule / AuthGuard).
        $resetUrl = "{$frontendUrl}/auth/reset-password?token={$rawToken}";

        Mail::to($user->user_email)->queue(
            new PasswordResetRequested($user, $resetUrl, self::TOKEN_TTL_MINUTES)
        );

        return $genericResponse;
    }

    /**
     * @description Checks the token (hash, expiry, use), stores the new password, invalidates the
     *              token and every session / refresh token of the user and sends a notification.
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $data      = $request->validated();
        $tokenHash = hash('sha256', $data['token']);

        $resetToken = PasswordResetToken::where('token_hash', $tokenHash)->first();

        if (!$resetToken || !$resetToken->isValid()) {
            $reason = $resetToken ? 'expired_or_used' : 'invalid_token';

            $this->logAttempt('password_reset_failed', $request, $resetToken?->user_id, [
                'reason' => $reason,
            ]);

            // Guessing / enumerating tokens = possible account takeover - recorded as a security event.
            CoreSecurityEvent::record(
                'password_reset_token_invalid',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['reason' => $reason])
            );

            return response()->json([
                'message' => 'The password reset link is invalid or has expired. Please request a new one.',
            ], 400);
        }

        $user = User::find($resetToken->user_id);

        if (!$user) {
            return response()->json([
                'message' => 'The password reset link is invalid or has expired. Please request a new one.',
            ], 400);
        }

        DB::transaction(function () use ($user, $resetToken, $data) {
            $user->user_password_hash = Hash::make($data['password']);
            $user->save();

            // One-time token - mark it as used.
            $resetToken->used_at = now();
            $resetToken->save();

            // Invalidate every existing login of the user.
            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $user->id)
                ->delete();

            DB::table('refresh_tokens')
                ->where('user_id', $user->id)
                ->delete();
        });

        // Successful reset - clear the per-e-mail limiter too, so the user can request another
        // reset right away if needed.
        RateLimiter::clear('password-reset-email:' . mb_strtolower($user->user_email));

        $this->logAttempt('password_reset_completed', $request, $user->id, []);

        Mail::to($user->user_email)->queue(
            new PasswordChangedNotification($user, now()->format('d.m.Y H:i'))
        );

        return $this->respond([
            // The e-mail is returned only for the confirmation on the frontend ("password changed for: x@y.cz"),
            // so the user knows which account was changed.
            'email' => $user->user_email,
        ], 200, [], 'Password has been successfully changed. You can now log in with your new password.');
    }

    /**
     * @description Writes a password reset attempt to the shared auth audit log (`core_logs`,
     * module 'Auth') through `LogsActivity::logAction()`, which never throws - logging must not
     * break the flow.
     * @param string $eventType password_reset_requested / password_reset_email_rate_limited
     *   / password_reset_failed / password_reset_completed.
     * @param Request $request Current request (a FormRequest is an Illuminate\Http\Request).
     * @param int|null $userId Target user of the reset (the route is public - no logged-in actor);
     *   used for `affected_entity_id` / `description`.
     * @param array $context Details of the event (`email_requested`, `reason`) for the readable
     *   `description`; request fields also reach `context_data` through `logAction()`
     *   (LogsActivity::safeContextData()).
     */
    private function logAttempt(string $eventType, $request, ?int $userId, array $context): void
    {
        $description = match ($eventType) {
            'password_reset_requested'          => "Password reset requested for email: {$context['email_requested']}",
            'password_reset_email_rate_limited' => "Password reset attempt limit exceeded for email: {$context['email_requested']}",
            'password_reset_failed'             => ($context['reason'] ?? null) === 'expired_or_used'
                ? 'Password reset failed - the link has already been used or expired'
                : 'Password reset failed - invalid link',
            'password_reset_completed'          => 'Password has been successfully changed',
        };

        $this->logAction(
            $request,
            CoreLog::class,
            $eventType,
            'Auth',
            $description,
            $userId,
            $userId ? 'User' : null
        );
    }
}