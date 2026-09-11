<?php

/**
 * @file PasswordResetController.php
 * @path app/Http/Controllers/Api/Auth/PasswordResetController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Řeší celý flow resetu hesla administrátorského účtu:
 *              1) POST /forgot-password  - vyžádání resetu (vždy stejná odpověď, ochrana proti enumeraci)
 *              2) POST /reset-password   - dokončení resetu (ověření tokenu, uložení nového hesla)
 * @dependencies
 * - App\Models\User: administrátorský účet (login = user_email)
 * - App\Models\PasswordResetToken: jednorázový token s expirací
 * - App\Models\Core\CoreLog / App\Traits\LogsActivity: sdílený audit log (viz bugfix-note
 *   2026-08-19v2 níže) - stejná tabulka, do které AuthController zapisuje
 *   login_success/login_failed/logout apod., ať je celá auth audit stopa na jednom místě.
 * - App\Models\Core\CoreSecurityEvent: bezpečnostní monitoring, viz refactor-note
 *   (2026-08-24) níže - oddělené od `core_logs` (audit vs. diagnostika hrozeb).
 * - App\Mail\Auth\PasswordResetRequested / PasswordChangedNotification: e-mailové notifikace
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

    /** Doba platnosti odkazu v minutách (dle rozhodnutí: 15 minut) */
    private const TOKEN_TTL_MINUTES = 15;

    /**
     * Max. počet požadavků na reset hesla pro JEDEN e-mail v rámci okna (bez ohledu na IP).
     * Chrání konkrétní schránku před zahlcením e-maily, i kdyby útočník rotoval IP adresy
     * (IP throttle 'throttle:5,1' na routě toto sám o sobě nepokryje).
     */
    private const EMAIL_MAX_ATTEMPTS = 3;

    /** Délka okna pro limit dle e-mailu v sekundách (15 minut - stejně jako platnost tokenu). */
    private const EMAIL_DECAY_SECONDS = 900;

    /**
     * @description Krok 1+2+3: přijme e-mail, pokud účet existuje vygeneruje token a odešle e-mail.
     *              Odpověď je VŽDY stejná bez ohledu na to, zda účet existuje (ochrana proti user enumeration)
     *              a bez ohledu na to, zda byl request zamítnut limitem podle e-mailu.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $email = mb_strtolower(trim($request->validated()['email']));

        $genericResponse = response()->json([
            'message' => 'If an account with this email exists, a password reset link has been sent to it.',
        ]);

        // ── Rate limiting podle e-mailu (nezávisle na IP throttlingu na routě) ──────────
        // Kontrolujeme PŘED ověřením existence účtu a se STEJNOU odpovědí pro oba případy,
        // aby rozdílné chování nešlo použít k odhalení, jestli účet existuje.
        $emailLimiterKey = 'password-reset-email:' . $email;

        if (RateLimiter::tooManyAttempts($emailLimiterKey, self::EMAIL_MAX_ATTEMPTS)) {
            $this->logAttempt('password_reset_email_rate_limited', $request, null, [
                'email_requested' => $email,
            ]);

            // Samostatný, per-e-mail cílený limiter (na rozdíl od IP throttle na routě,
            // který hlásí 'throttle_exceeded' přes globální handler) - viz refactor-note
            // (2026-08-24) v hlavičce souboru.
            CoreSecurityEvent::record(
                'password_reset_email_rate_limited',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['email_requested' => $email])
            );

            // Tiché odmítnutí - stejná generická odpověď, žádný e-mail se neposílá,
            // útočník ani napohled nepozná, že narazil na limit.
            return $genericResponse;
        }

        // Počítáme KAŽDÝ pokus (i pro neexistující e-mail), jinak by šlo limit obejít
        // tím, že by se nejdřív "vyzkoušely" neexistující adresy bez postihu.
        RateLimiter::hit($emailLimiterKey, self::EMAIL_DECAY_SECONDS);

        $user = User::whereRaw('LOWER(user_email) = ?', [$email])->first();

        $this->logAttempt('password_reset_requested', $request, $user?->id, [
            'email_requested' => $email,
        ]);

        if (!$user) {
            // Účet neexistuje - vracíme stejnou odpověď, žádný e-mail se neposílá.
            return $genericResponse;
        }

        // Invalidace (smazání) všech předchozích nepoužitých tokenů uživatele - platí jen poslední odkaz.
        PasswordResetToken::where('user_id', $user->id)->delete();

        $rawToken  = Str::random(64);
        $tokenHash = hash('sha256', $rawToken);

        PasswordResetToken::create([
            'user_id'    => $user->id,
            'token_hash' => $tokenHash,
            'expires_at' => now()->addMinutes(self::TOKEN_TTL_MINUTES),
        ]);

        $frontendUrl = rtrim(config('app.frontend_url'), '/');
        // Frontend routa je veřejná stránka vedle přihlášení: 'auth/login' -> 'auth/reset-password'
        // (viz app.routes.ts, mimo AdminRoutingModule/AuthGuard).
        $resetUrl = "{$frontendUrl}/auth/reset-password?token={$rawToken}";

        Mail::to($user->user_email)->queue(
            new PasswordResetRequested($user, $resetUrl, self::TOKEN_TTL_MINUTES)
        );

        return $genericResponse;
    }

    /**
     * @description Krok 4+5: ověří token (hash, expirace, použití), uloží nové heslo,
     *              zneplatní token i všechny existující session/refresh tokeny a odešle notifikaci.
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

            // Token brute-force/enumerace = potenciální převzetí cizího účtu - viz
            // refactor-note (2026-08-24) v hlavičce souboru.
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

            // Token je jednorázový - označíme ho jako použitý.
            $resetToken->used_at = now();
            $resetToken->save();

            // Zneplatnění všech existujících přihlášení uživatele.
            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $user->id)
                ->delete();

            DB::table('refresh_tokens')
                ->where('user_id', $user->id)
                ->delete();
        });

        // Úspěšný reset - vyčistíme i limiter pro tenhle e-mail, ať legitimní uživatel
        // po vyřešení problému hned může žádat o další reset, kdyby ho náhodou potřeboval.
        RateLimiter::clear('password-reset-email:' . mb_strtolower($user->user_email));

        $this->logAttempt('password_reset_completed', $request, $user->id, []);

        Mail::to($user->user_email)->queue(
            new PasswordChangedNotification($user, now()->format('d.m.Y H:i'))
        );

        return response()->json([
            'message' => 'Password has been successfully changed. You can now log in with your new password.',
            // E-mail vracíme jen pro zobrazení potvrzení na frontendu (např. "heslo změněno pro: x@y.cz"),
            // aby uživatel měl jistotu, že se změna týkala správného účtu.
            'email' => $user->user_email,
        ]);
    }

    /**
     * @description Zaloguje pokus o reset hesla do sdíleného auth audit logu (`core_logs`,
     * module 'Auth') přes `LogsActivity::logAction()` - viz bugfix-note (2026-08-19v2)
     * v hlavičce souboru. Chyba při logování nesmí shodit hlavní flow -
     * `logAction()` má vlastní try/catch a nikdy nevyhazuje.
     * @param string $eventType password_reset_requested / password_reset_email_rate_limited
     *   / password_reset_failed / password_reset_completed.
     * @param Request $request Aktuální request (FormRequest instance - je to podtyp
     *   Illuminate\Http\Request, takže sedí na `logAction()` typový hint beze změny).
     * @param int|null $userId Cílový uživatel resetu (ne přihlášený actor - tahle routa
     *   je veřejná/nepřihlášená) - promítá se do `affected_entity_id`/`description`.
     * @param array $context Doplňkové okolnosti specifické pro daný event
     *   (`email_requested` u požadavku/rate-limitu, `reason` u selhání) - promítají se
     *   do čitelného textu `description`; `email_requested`/ostatní request pole se navíc
     *   automaticky objeví v `context_data` samotným `logAction()` (natahuje request
     *   payload sám, viz LogsActivity::safeContextData()).
     */
    private function logAttempt(string $eventType, $request, ?int $userId, array $context): void
    {
        $description = match ($eventType) {
            'password_reset_requested' => isset($context['email_requested'])
                ? "Password reset requested for email: {$context['email_requested']}"
                : 'Password reset requested',
            'password_reset_email_rate_limited' => isset($context['email_requested'])
                ? "Password reset attempt limit exceeded for email: {$context['email_requested']}"
                : 'Password reset attempt limit exceeded',
            'password_reset_failed' => ($context['reason'] ?? null) === 'expired_or_used'
                ? 'Password reset failed - the link has already been used or expired'
                : 'Password reset failed - invalid link',
            'password_reset_completed' => 'Password has been successfully changed',
            default => "Password reset attempt (user_id: " . ($userId ?? 'unknown') . ')',
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