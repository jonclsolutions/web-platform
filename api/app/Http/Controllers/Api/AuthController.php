<?php
/**
 * @file AuthController.php
 * @path app/Http/Controllers/Api/AuthController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages user authentication, token-based session lifecycle (Access/Refresh tokens), and security-related audit logging.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Auth, Log};
use App\Models\{User, RefreshToken};
use App\Models\Web\WebLog;
use Illuminate\Support\Str;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;

/**
 * @description Handles the authentication flow for the application API.
 * @note Implements a secure token refresh pattern and logs all authentication attempts for compliance and monitoring.
 */
class AuthController extends Controller
{
    /**
     * Authenticates a user and issues access and refresh tokens.
     *
     * @param Request $request
     * @return JsonResponse Returns user data and tokens upon success.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|string',
            'password' => 'required',
        ]);

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

            $this->logAction($request, 'login_success', 'Auth', "Uživatel se úspěšně přihlásil: {$user->user_email}", $user->id, $user);
            
            return response()->json([
                'message'          => 'Přihlášení úspěšné!',
                'user'             => new UserResource($user),
                'user_roles'       => $user->roles->pluck('role_name'),
                'user_permissions' => method_exists($user, 'getPermissionsAttribute') ? $user->getPermissionsAttribute() : [], 
                'token'            => $accessToken,
                'refreshToken'     => $refreshToken,
            ], 200);
        }

        $this->logAction($request, 'login_failed', 'Auth', "Neúspěšný pokus o přihlášení na login: {$request->email}");

        return response()->json(['message' => 'Neplatné přihlašovací údaje.'], 401);
    }

    /**
     * Refreshes the access token using a valid refresh token.
     *
     * @param Request $request
     * @return JsonResponse
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
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if ($user) {
            $this->logAction($request, 'logout', 'Auth', "Uživatel se odhlásil: {$user->user_email}", $user->id, $user);
            $user->currentAccessToken()->delete();
        }
        
        $refreshToken = $request->input('refreshToken');
        if ($refreshToken) {
            RefreshToken::where('token', hash('sha256', $refreshToken))->delete();
        }
        
        return response()->json(['message' => 'Odhlášení úspěšné!'], 200);
    }

    /**
     * Logs authentication events to the WebLog system.
     *
     * @param Request $request
     * @param string $eventType
     * @param string $module
     * @param string $description
     * @param int|null $affectedId
     * @param User|null $user
     * @return void
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null, ?User $user = null)
    {
        try {
            $activeUser = $user ?? $request->user();

            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'User',
                'affected_entity_id'   => $affectedId,
                'user_id'              => $activeUser?->id,
                'context_data'         => json_encode([
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent()
                ], JSON_UNESCAPED_UNICODE),
                'user_id_plain'        => (string)($activeUser?->id ?? '0'),
                'user_plain'           => $activeUser?->user_email ?? ($request->email ?? 'Neznámý/Nepřihlášený')
            ]);
        } catch (\Exception $e) {
            Log::error("Log error (Auth): " . $e->getMessage());
        }
    }
}