<?php

/**
 * @file TwoFactorAdminController.php
 * @path app/Http/Controllers/Api/Core/TwoFactorAdminController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Umožňuje sysadminovi vynutit/zrušit vynucení 2FA konkrétnímu uživateli
 * nezávisle na jeho vlastní enable_2fa volbě. Chráněno VÝHRADNĚ role_name==='sysadmin'
 * kontrolou přímo v kontroleru - stejná konvence jako CoreRoleController (matice
 * oprávnění), ne přes permission systém, protože jde o autoritu nad samotnými
 * bezpečnostními vynuceními, ne o běžné oprávnění.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreLog;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwoFactorAdminController extends Controller
{
    use LogsActivity;

    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * @description Přepne two_fa_forced_by_admin u cílového uživatele. Sysadmin roli
     * samotné to nijak neovlivní - ta má 2FA vynuceno vždy natvrdo (User::requiresTwoFactor()).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $actingUser = $request->user();
        $isSysadmin = $actingUser->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();

        if (!$isSysadmin) {
            return response()->json(['message' => 'Nedostatečná oprávnění.'], 403);
        }

        $request->validate(['forced' => 'required|boolean']);

        $targetUser = User::findOrFail($id);
        $targetUser->two_fa_forced_by_admin = $request->boolean('forced');
        $targetUser->save();

        $this->logAction(
            $request,
            CoreLog::class,
            'user_2fa_requirement_changed',
            'Auth',
            "Sysadmin {$actingUser->user_email} " . ($request->boolean('forced') ? 'vynutil' : 'zrušil vynucení') . " 2FA pro uživatele: {$targetUser->user_email}",
            $targetUser->id,
            'User'
        );

        return response()->json([
            'message' => 'Nastavení 2FA bylo aktualizováno.',
            'user_id' => $targetUser->id,
            'two_fa_forced_by_admin' => $targetUser->two_fa_forced_by_admin,
            'effective_requires_2fa' => $targetUser->requiresTwoFactor(),
        ]);
    }
}