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
 * - App\Mail\Auth\PasswordResetRequested / PasswordChangedNotification: e-mailové notifikace
 */

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Mail\Auth\PasswordChangedNotification;
use App\Mail\Auth\PasswordResetRequested;
use App\Models\PasswordResetToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
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
            'message' => 'Pokud účet s tímto e-mailem existuje, byl na něj odeslán odkaz pro reset hesla.',
        ]);

        // ── Rate limiting podle e-mailu (nezávisle na IP throttlingu na routě) ──────────
        // Kontrolujeme PŘED ověřením existence účtu a se STEJNOU odpovědí pro oba případy,
        // aby rozdílné chování nešlo použít k odhalení, jestli účet existuje.
        $emailLimiterKey = 'password-reset-email:' . $email;

        if (RateLimiter::tooManyAttempts($emailLimiterKey, self::EMAIL_MAX_ATTEMPTS)) {
            $this->logAttempt('password_reset_email_rate_limited', $request, null, [
                'email_requested' => $email,
            ]);

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

        Mail::to($user->user_email)->send(
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
            $this->logAttempt('password_reset_failed', $request, $resetToken?->user_id, [
                'reason' => $resetToken ? 'expired_or_used' : 'invalid_token',
            ]);

            return response()->json([
                'message' => 'Odkaz pro reset hesla je neplatný nebo již vypršel. Vyžádejte si prosím nový.',
            ], 400);
        }

        $user = User::find($resetToken->user_id);

        if (!$user) {
            return response()->json([
                'message' => 'Odkaz pro reset hesla je neplatný nebo již vypršel. Vyžádejte si prosím nový.',
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

        Mail::to($user->user_email)->send(
            new PasswordChangedNotification($user, now()->format('d.m.Y H:i'))
        );

        return response()->json([
            'message' => 'Heslo bylo úspěšně změněno. Nyní se můžete přihlásit novým heslem.',
            // E-mail vracíme jen pro zobrazení potvrzení na frontendu (např. "heslo změněno pro: x@y.cz"),
            // aby uživatel měl jistotu, že se změna týkala správného účtu.
            'email' => $user->user_email,
        ]);
    }

    /**
     * @description Zaloguje pokus o reset hesla do web_system_logs pro účely auditu.
     *              Chyba při logování nesmí shodit hlavní flow, proto try/catch.
     */
    private function logAttempt(string $eventType, $request, ?int $userId, array $context): void
    {
        try {
            DB::table('web_system_logs')->insert([
                'created_at'  => now(),
                'origin'      => $request->ip(),
                'event_type'  => $eventType,
                'module'      => 'auth',
                'description' => "Pokus o reset hesla (user_id: " . ($userId ?? 'neznámý') . ")",
                'context_data' => json_encode(array_merge($context, [
                    'ip'         => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'user_id'    => $userId,
                ])),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}