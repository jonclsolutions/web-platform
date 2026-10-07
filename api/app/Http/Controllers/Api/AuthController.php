<?php
/**
 * @file AuthController.php
 * @path app/Http/Controllers/Api/AuthController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages user authentication, token-based session lifecycle (Access/Refresh
 * tokens), CAPTCHA-gated brute-force protection, and mandatory/optional 2FA verification.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\VerifyTwoFactorRequest;
use App\Http\Requests\Auth\ResendTwoFactorRequest;
use App\Mail\Auth\TwoFactorCodeMail;
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
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    use LogsActivity;

    /** Práh počtu neúspěšných pokusů (per e-mail), od kterého se vyžaduje captcha. */
    private const CAPTCHA_THRESHOLD = 3;

    /** Okno pro počítání neúspěšných pokusů per e-mail (sekundy). */
    private const FAILED_ATTEMPTS_DECAY_SECONDS = 900; // 15 min

    public function __construct(
        private readonly CaptchaVerificationService $captcha
    ) {}

    /**
     * @description Krok 1 loginu: ověří heslo (+ captcha od 3. neúspěšného pokusu).
     * PŘED ověřením hesla zamítne zablokované a dosud neaktivované účty (viz
     * refactor-note v hlavičce souboru). Pokud uživatel vyžaduje 2FA, NEVYDÁ tokeny,
     * ale založí pending-login session a pošle OTP e-mailem. Jinak přihlásí rovnou
     * (stávající chování).
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'         => 'required|string',
            'password'      => 'required',
            'captcha_token' => 'nullable|string',
        ]);

        $request->merge(['user_agent' => $request->userAgent()]);

        $email = mb_strtolower(trim($request->input('email')));
        $failedAttemptsKey = 'login-fail:' . $email;
        $attemptsBefore = RateLimiter::attempts($failedAttemptsKey);
        $captchaRequired = $attemptsBefore >= self::CAPTCHA_THRESHOLD;

        if ($captchaRequired) {
            $captchaToken = (string) $request->input('captcha_token');
            $context = CoreSecurityEvent::contextFromRequest($request, ['email' => $email]);

            if (!$this->captcha->verify($captchaToken, $request->ip(), $context)) {
                // Captcha selhání samo zapisuje CaptchaVerificationService::verify().
                $this->logAction($request, CoreLog::class, 'login_captcha_failed', 'Auth', "Neplatná/chybějící captcha pro: {$email}", null, 'User');

                return response()->json([
                    'message'          => 'Captcha verification failed. Please try again.',
                    'captcha_required' => true,
                ], 422);
            }
        }
        

        // ── Blokace / neaktivovaný účet - MUSÍ se ověřit PŘED Auth::attempt() ──────────
        // (viz refactor-note v hlavičce souboru - Auth::attempt by s NULL heslem mohlo
        // spadnout do Hash::check() s neplatným argumentem místo hezké JSON odpovědi).
        $targetUser = User::where('user_email', $request->input('email'))->first();

        if ($targetUser) {
            if ($targetUser->is_blocked) {
                CoreSecurityEvent::record(
                    'login_blocked_account',
                    'warning',
                    $request->ip(),
                    CoreSecurityEvent::contextFromRequest($request, ['email' => $email])
                );
                $this->logAction($request, CoreLog::class, 'login_blocked', 'Auth', "Pokus o přihlášení na zablokovaný účet: {$email}", $targetUser->id, 'User');

                return response()->json(['message' => 'This account has been blocked. Please contact the administrator.'], 403);
            }

            if (is_null($targetUser->user_password_hash)) {
                return response()->json([
                    'message' => 'The account is not yet activated. Please check your email or ask the administrator to send a new activation link.',
                ], 403);
            }
        }

        if (Auth::attempt(['user_email' => $request->email, 'password' => $request->password])) {
            /** @var User $user */
            $user = Auth::user();

            // Přihlašovací pokus byl úspěšný - vyčistit počítadlo neúspěchů pro tento e-mail.
            RateLimiter::clear($failedAttemptsKey);

            $user->load('roles.permissions');

            if ($user->requiresTwoFactor()) {
                return $this->beginTwoFactorChallenge($request, $user);
            }

            return $this->issueTokens($request, $user);
        }

        // Špatné heslo - zvýšit počítadlo, ihned odhlásit případnou částečnou auth session.
        RateLimiter::hit($failedAttemptsKey, self::FAILED_ATTEMPTS_DECAY_SECONDS);
        $attemptsAfter = RateLimiter::attempts($failedAttemptsKey);

        $securityContext = CoreSecurityEvent::contextFromRequest($request, ['email' => $email]);
        CoreSecurityEvent::record('login_failed', 'warning', $request->ip(), $securityContext);

        // Práh pro captchu byl PRÁVĚ TEĎ (tímto pokusem) poprvé překročen - signalizuje
        // reálné brute-force podezření, ne jen jeden překlep v heslu. Zaznamenáno jako
        // 'critical', aby se v adminu odlišilo od běžných jednotlivých login_failed.
        if ($attemptsBefore < self::CAPTCHA_THRESHOLD && $attemptsAfter >= self::CAPTCHA_THRESHOLD) {
            CoreSecurityEvent::record('login_brute_force_suspected', 'critical', $request->ip(), $securityContext);
        }

        $this->logAction($request, CoreLog::class, 'login_failed', 'Auth', "Neúspěšný pokus o přihlášení na login: {$email}", null, 'User');

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

        return response()->json([
            'user'             => new UserResource($user),
            'user_roles'       => $user->roles->pluck('role_name'),
            'user_permissions' => method_exists($user, 'getPermissionsAttribute') ? $user->getPermissionsAttribute() : [],
        ], 200);
    }

    /**
     * @description Založí pending-login 2FA session: vygeneruje 6místný kód, uloží jeho
     * SHA-256 hash (nikdy raw), a odešle ho e-mailem (queued). Vrátí klientovi opaque
     * `login_token` (raw, jeho hash jde do DB), který se použije ve verifyTwoFactor/resendTwoFactor.
     */
    private function beginTwoFactorChallenge(Request $request, User $user): JsonResponse
    {
        // Předchozí nedokončené pending-login session tohoto uživatele zneplatnit -
        // platí jen ta nejnovější (stejný princip jako u password reset tokenů).
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

        $this->logAction($request, CoreLog::class, 'login_2fa_challenge_sent', 'Auth', "2FA kód odeslán: {$user->user_email}", $user->id, 'User');

        return response()->json([
            'message'      => 'Enter the verification code sent to your email.',
            'requires_2fa' => true,
            'login_token'  => $rawLoginToken,
            'expires_in'   => TwoFactorCode::CODE_TTL_MINUTES * 60,
        ], 200);
    }

    /**
     * @description Krok 2 loginu (jen pro uživatele s vynucenou 2FA): ověří OTP kód a
     * teprve poté vydá access/refresh tokeny.
     */
    public function verifyTwoFactor(VerifyTwoFactorRequest $request): JsonResponse
    {
        $data = $request->validated();
        $tokenHash = hash('sha256', $data['login_token']);

        $pending = TwoFactorCode::where('login_token_hash', $tokenHash)->first();

        if (!$pending || !$pending->isValid()) {
            // Neplatná/expirovaná/vyčerpaná pending-login session - hádání login_token
            // by (na rozdíl od hádání 6místného OTP kódu, což už hlásí login_2fa_invalid)
            // znamenalo přeskočení ověření hesla úplně. Severity 'info' - běžně jde o
            // legitimně vypršelou session (uživatel neklikl včas), ne o útok; opakovaný
            // vysoký objem ze stejné IP je i tak vidět přes occurrences.
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

            $this->logAction($request, CoreLog::class, 'login_2fa_code_invalid', 'Auth', "Neplatný 2FA kód (user_id: {$pending->user_id})", $pending->user_id, 'User');

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

        // Dodatečná pojistka: kdyby byl účet zablokován MEZI odesláním OTP kódu a jeho
        // ověřením (admin zasáhl uprostřed pending-login session), tokeny se přesto
        // nesmí vydat.
        if ($user->is_blocked) {
            $pending->delete();
            return response()->json(['message' => 'This account has been blocked. Please contact the administrator.'], 403);
        }

        $pending->used_at = now();
        $pending->save();
        $pending->delete();

        return $this->issueTokens($request, $user);
    }

    /**
     * @description Znovu odešle OTP kód pro existující pending-login session. Chráněno
     * cooldownem (60s) a tvrdým stropem počtu resendů na session - viz TwoFactorCode
     * konstanty. Route navíc nese throttle limiter 'login-2fa-resend' (viz AppServiceProvider).
     */
    public function resendTwoFactor(ResendTwoFactorRequest $request): JsonResponse
    {
        $tokenHash = hash('sha256', $request->validated()['login_token']);
        $pending = TwoFactorCode::where('login_token_hash', $tokenHash)->first();

        if (!$pending || is_null($pending->expires_at) || $pending->used_at) {
            // Stejný event_type jako ve verifyTwoFactor() - obě metody řeší tentýž
            // scénář (neplatný/expirovaný/použitý login_token), jen na jiném kroku
            // 2FA flow (žádost o nový kód vs. ověření kódu).
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
        $pending->attempts = 0; // nový kód = reset pokusů na uhodnutí
        $pending->save();

        Mail::to($user->user_email)->send(
            new TwoFactorCodeMail($user, $code, TwoFactorCode::CODE_TTL_MINUTES)
        );

        $this->logAction($request, CoreLog::class, 'login_2fa_code_resent', 'Auth', "2FA kód znovu odeslán (user_id: {$user->id})", $user->id, 'User');

        return response()->json([
            'message'    => 'A new code has been sent.',
            'expires_in' => TwoFactorCode::CODE_TTL_MINUTES * 60,
        ], 200);
    }

    /**
     * @description Vydá access + refresh token přihlášenému uživateli. Sdíleno mezi
     * přímým loginem (bez 2FA) a dokončením 2FA verifikace.
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
            'expires_at' => now()->addDays(7),
        ]);

        $this->logAction($request, CoreLog::class, 'login_success', 'Auth', "Uživatel se úspěšně přihlásil: {$user->user_email}", $user->id, 'User');

        return response()->json([
            'message'          => 'Login successful!',
            'user'             => new UserResource($user),
            'user_roles'       => $user->roles->pluck('role_name'),
            'user_permissions' => method_exists($user, 'getPermissionsAttribute') ? $user->getPermissionsAttribute() : [],
            'token'            => $accessToken,
            'refreshToken'     => $refreshToken,
        ], 200);
    }

    /**
     * @description Refreshes the access token using a valid refresh token.
     * @note Dodatečná kontrola `is_blocked` - pokud byl účet zablokován MEZI vydáním
     * refresh tokenu a jeho použitím (`update()` mezitím smazal Sanctum access tokeny,
     * ale samotný refresh token flow jde jinou cestou), nesmí se vydat nový access token.
     */
    public function refresh(Request $request): JsonResponse
    {
        $refreshToken = $request->input('refreshToken');
        if (!$refreshToken) {
            return response()->json(['message' => 'Refresh token is missing.'], 401);
        }

        $hashedRefreshToken = hash('sha256', $refreshToken);
        $dbRefreshToken = RefreshToken::with('user')
                                     ->where('token', $hashedRefreshToken)
                                     ->where('expires_at', '>', now())
                                     ->first();

        if (!$dbRefreshToken || !$dbRefreshToken->user) {
            // 'info', ne 'warning' - vypršelý refresh token je běžný legitimní jev
            // (uživatel se dlouho nepřihlásil), ne sám o sobě signál útoku. Opakovaný
            // vysoký objem ze stejné IP je i tak vidět přes `occurrences` v adminu.
            CoreSecurityEvent::record(
                'refresh_token_invalid',
                'info',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request)
            );

            return response()->json(['message' => 'Invalid or expired token.'], 401);
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
            return response()->json(['message' => 'This account has been blocked. Please contact the administrator.'], 403);
        }

        $dbRefreshToken->delete();
        $user->tokens()->delete();

        $newAccessToken = $user->createToken('access-token', ['*'], now()->addMinutes(60))->plainTextToken;
        $newRefreshToken = Str::random(60);

        RefreshToken::create([
            'user_id'    => $user->id,
            'token'      => hash('sha256', $newRefreshToken),
            'expires_at' => now()->addDays(7),
        ]);

        return response()->json([
            'token'        => $newAccessToken,
            'refreshToken' => $newRefreshToken,
        ], 200);
    }

    /**
     * @description Revokes user access and refresh tokens.
     * @note Beze změny oproti předchozí verzi.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            $request->merge(['user_agent' => $request->userAgent()]);
            $this->logAction($request, CoreLog::class, 'logout', 'Auth', "Uživatel se odhlásil: {$user->user_email}", $user->id, 'User');
            $user->currentAccessToken()->delete();
        }

        $refreshToken = $request->input('refreshToken');
        if ($refreshToken) {
            RefreshToken::where('token', hash('sha256', $refreshToken))->delete();
        }

        return response()->json(['message' => 'Logout successful!'], 200);
    }
}