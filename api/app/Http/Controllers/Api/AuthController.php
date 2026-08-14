<?php
/**
 * @file AuthController.php
 * @path app/Http/Controllers/Api/AuthController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages user authentication, token-based session lifecycle (Access/Refresh tokens), and security-related audit logging.
 *
 * @refactor-note (2026-08-7) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). ZÁROVEŇ OPRAVENA DOMÉNA: lokální verze logovala do
 * `WebLog::class`, ale autentizace (login/logout) je dle dohodnutého Core/Web/Shop
 * rozdělení doménou CORE (stejně jako role, permissions, správa uživatelů) - loguje se
 * nově do `CoreLog::class`. Zachováno vědomé zalogování i veřejného (bez-auth)
 * `login`/`login_failed` - přestože jde o "public" endpoint, jde o bezpečnostně kritickou
 * událost (kdo/odkud/kolikrát se pokusil přihlásit), ne o běžnou informační veřejnou akci,
 * takže tady auditní záznam zůstává navzdory obecné poznámce "veřejné GET akce logovat
 * netřeba" (ta se týká čistě informačních GET endpointů jako WebPublicController::getStatus()).
 * User-Agent (dřív posílaný ručně v context_data) je teď do `context_data` propsán tak,
 * že se před voláním logAction() domerguje do requestu (`$request->merge()`) - trait sám
 * o sobě žádný vlastní context nepřijímá, ale automaticky sbalí celé tělo requestu
 * (mimo SENSITIVE_KEYS), takto se do něj bezpečně přidá i user_agent bez zásahu do traitu.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\{User, RefreshToken};
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use Illuminate\Support\Str;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;

/**
 * @description Handles the authentication flow for the application API.
 * @note Implements a secure token refresh pattern and logs all authentication attempts for compliance and monitoring.
 */
class AuthController extends Controller
{
    use LogsActivity;

    /**
     * Authenticates a user and issues access and refresh tokens.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|string',
            'password' => 'required',
        ]);

        // User-Agent do requestu, ať se propíše do context_data automaticky přes trait
        // (viz refactor-note výše) - nikdy nedomerguje citlivé pole, jen doplňkový string.
        $request->merge(['user_agent' => $request->userAgent()]);

        if (Auth::attempt(['user_email' => $request->email, 'password' => $request->password])) {
            /** @var \App\Models\User $user */
            $user = Auth::user();
            $user->update(['last_login_at' => now()]);
            $user->load('roles.permissions');

            // Token generation
            $accessToken = $user->createToken('access-token', ['*'], now()->addMinutes(60))->plainTextToken;
            $refreshToken = Str::random(60);

            // Manage Refresh Token
            RefreshToken::where('user_id', $user->id)->delete();
            RefreshToken::create([
                'user_id'    => $user->id,
                'token'      => hash('sha256', $refreshToken),
                'expires_at' => now()->addDays(7),
            ]);

            $this->logAction($request, CoreLog::class, 'login_success', 'Auth', "Uživatel se úspěšně přihlásil: {$user->user_email}", $user->id, 'User');

            return response()->json([
                'message'          => 'Přihlášení úspěšné!',
                'user'             => new UserResource($user),
                'user_roles'       => $user->roles->pluck('role_name'),
                'user_permissions' => method_exists($user, 'getPermissionsAttribute') ? $user->getPermissionsAttribute() : [],
                'token'            => $accessToken,
                'refreshToken'     => $refreshToken,
            ], 200);
        }

        $this->logAction($request, CoreLog::class, 'login_failed', 'Auth', "Neúspěšný pokus o přihlášení na login: {$request->email}", null, 'User');

        return response()->json(['message' => 'Neplatné přihlašovací údaje.'], 401);
    }

    /**
     * Refreshes the access token using a valid refresh token.
     */
    public function refresh(Request $request): JsonResponse
    {
        $refreshToken = $request->input('refreshToken');
        if (!$refreshToken) {
            return response()->json(['message' => 'Refresh token chybí.'], 401);
        }

        $hashedRefreshToken = hash('sha256', $refreshToken);
        $dbRefreshToken = RefreshToken::with('user')
                                     ->where('token', $hashedRefreshToken)
                                     ->where('expires_at', '>', now())
                                     ->first();

        if (!$dbRefreshToken || !$dbRefreshToken->user) {
            return response()->json(['message' => 'Neplatný nebo expirovaný token.'], 401);
        }

        $user = $dbRefreshToken->user;

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
     * Revokes user access and refresh tokens.
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

        return response()->json(['message' => 'Odhlášení úspěšné!'], 200);
    }
}