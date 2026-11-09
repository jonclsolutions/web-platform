<?php
/**
 * @file UserAvatarController.php
 * @path app/Http/Controllers/Api/UserAvatarController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Profile photo of an admin account: upload (store), removal (destroy) and the
 * photo itself (show, signed URL only). Uploading and removing is allowed for the own account
 * (personal info) and with `core-administrators-update` (account management, route middleware);
 * the photo of a sysadmin account may change only the sysadmin himself or another sysadmin - the
 * same rule as editing the account (UserController::update).
 * @note Upload limits: JPG / PNG / WebP, at most 2 MB and 8000 px per side (protection against
 * huge "decompression bomb" images); the stored photo is processed by UserAvatar (256×256 WebP
 * without metadata).
 * @dependencies
 * - App\Support\Images\UserAvatar: processing, storage, signed URL.
 * - App\Traits\LogsActivity: core_logs entries.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreLog;
use App\Models\User;
use App\Support\Images\UserAvatar;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class UserAvatarController extends Controller
{
    use LogsActivity;

    /** @description Role whose photo only a sysadmin (or the account itself) may change. */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * @description Uploads a new photo of the account.
     * @param Request $request Multipart field `avatar`.
     * @param string $id Account ID.
     * @return JsonResponse 200 { avatar_url }; 403 sysadmin rule; 422 invalid file.
     */
    public function store(Request $request, string $id): JsonResponse
    {
        $user = $this->target($id);
        if ($refusal = $this->refuseSysadminChange($request, $user)) {
            return $refusal;
        }

        $request->validate([
            'avatar' => [
                'required', 'file', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp',
                'max:2048', 'dimensions:max_width=8000,max_height=8000',
            ],
        ]);

        try {
            UserAvatar::store($user, $request->file('avatar'));
        } catch (RuntimeException) {
            return response()->json(['message' => 'The file is not a readable image.'], 422);
        }

        $this->logAction($request, CoreLog::class, 'update', 'User', "Updated profile photo: {$user->user_email}", $user->id, 'User');

        return $this->respond(['avatar_url' => UserAvatar::url($user)]);
    }

    /**
     * @description Removes the photo of the account (the default image is shown).
     * @param Request $request
     * @param string $id Account ID.
     * @return JsonResponse 200 { avatar_url: null }; 403 sysadmin rule.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $this->target($id);
        if ($refusal = $this->refuseSysadminChange($request, $user)) {
            return $refusal;
        }

        UserAvatar::remove($user);
        $this->logAction($request, CoreLog::class, 'update', 'User', "Removed profile photo: {$user->user_email}", $user->id, 'User');

        return $this->respond(['avatar_url' => null]);
    }

    /**
     * @description The photo itself - reachable only through the signed URL of UserAvatar::url().
     * @param string $id Account ID.
     * @return Response WebP, cached privately for a day; 404 without a photo.
     */
    public function show(string $id): Response
    {
        $user = User::withTrashed()->find(ctype_digit($id) ? (int) $id : 0);
        abort_unless($user?->avatar_path && Storage::disk(UserAvatar::DISK)->exists($user->avatar_path), 404);

        return Storage::disk(UserAvatar::DISK)->response($user->avatar_path, null, [
            'Content-Type'            => 'image/webp',
            'Cache-Control'           => 'private, max-age=86400',
            'X-Content-Type-Options'  => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ]);
    }

    /**
     * @description Account of the request (404 for an unknown or non-numeric ID).
     * @param string $id
     * @return User
     */
    private function target(string $id): User
    {
        abort_unless(ctype_digit($id), 404);

        return User::findOrFail((int) $id);
    }

    /**
     * @description The photo of a sysadmin account may change only the account itself or another
     * sysadmin (as UserController::update) - the refusal is logged.
     * @param Request $request
     * @param User $user Target account.
     * @return JsonResponse|null 403, or null when allowed.
     */
    private function refuseSysadminChange(Request $request, User $user): ?JsonResponse
    {
        $actor = $request->user();
        if ((int) $actor->id === (int) $user->id
            || !$user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists()
            || $actor->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists()) {
            return null;
        }

        $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Denied change of a sysadmin profile photo: {$user->user_email}", $user->id, 'User');

        return response()->json(['message' => 'Only another sysadmin may change the photo of a sysadmin account.'], 403);
    }
}
