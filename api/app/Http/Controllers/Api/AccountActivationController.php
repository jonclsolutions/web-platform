<?php
/**
 * @file AccountActivationController.php
 * @path app/Http/Controllers/Api/AccountActivationController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Veřejné (nepřihlášené) endpointy pro aktivaci účtu založeného adminem -
 * ověření platnosti odkazu (`show`) a nastavení prvního hesla (`activate`). Účet, který
 * je zablokovaný (`is_blocked`), NELZE aktivovat, ani kdyby měl platný token.
 * @note Po úspěšné aktivaci uživatel NENÍ automaticky přihlášen - frontend přesměruje
 * na login (rozhodnuto v backlogu: "presmerovat na prihlaseni").
 * @dependencies
 * - AccountActivationToken: model tokenu, hashovaný v DB, viz jeho hlavička.
 * - LogsActivity: sdílený audit trait, stejné volání jako zbytek admin kontrolerů.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountActivationToken;
use App\Models\Core\CoreLog;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AccountActivationController extends Controller
{
    use LogsActivity;

    /**
     * @description Ověří platnost aktivačního odkazu BEZ jeho spotřebování - frontend
     * podle výsledku zobrazí buď formulář na heslo, nebo chybovou hlášku. Token se tu
     * nijak neinvaliduje, jen se čte.
     */
    public function show(string $token): JsonResponse
    {
        $record = $this->findValidToken($token);
        if ($record instanceof JsonResponse) {
            return $record;
        }

        $user = User::find($record->user_id);
        if (!$user || $user->is_blocked) {
            return response()->json(['message' => 'Účet je zablokovaný nebo neexistuje.'], 403);
        }

        return response()->json([
            'email'     => $user->user_email,
            'full_name' => $user->full_name,
        ]);
    }

    /**
     * @description Nastaví heslo, aktivuje účet (`activated_at`) a spotřebuje token
     * (smaže VŠECHNY aktivační tokeny uživatele, ne jen ten použitý - jistota proti
     * souběžnému vydání druhého tokenu, ke kterému by teoreticky nemělo dojít, viz
     * `AccountActivationToken::issueFor()`, ale je to levná dodatečná pojistka).
     */
    public function activate(Request $request, string $token): JsonResponse
    {
        $record = $this->findValidToken($token);
        if ($record instanceof JsonResponse) {
            return $record;
        }

        $user = User::find($record->user_id);
        if (!$user) {
            $record->delete();
            return response()->json(['message' => 'Účet nenalezen.'], 404);
        }

        if ($user->is_blocked) {
            return response()->json(['message' => 'Účet byl zablokován. Kontaktujte administrátora.'], 403);
        }

        $validated = $request->validate([
            'password'              => ['required', 'string', 'max:16', Password::min(8)->letters()->numbers()->symbols()],
            'password_confirmation' => ['required', 'same:password'],
        ], [
            'password.required'          => 'Heslo je povinné.',
            'password_confirmation.same' => 'Hesla se neshodují.',
        ]);

        $user->update([
            'user_password_hash' => Hash::make($validated['password']),
            'activated_at'       => now(),
        ]);

        AccountActivationToken::where('user_id', $user->id)->delete();

        $this->logAction($request, CoreLog::class, 'account_activated', 'User', "Účet aktivován: {$user->user_email}", $user->id, 'User');

        return response()->json(['message' => 'Heslo bylo nastaveno. Nyní se můžete přihlásit.']);
    }

    /**
     * @description Sdílené ověření tokenu pro show()/activate() - musí existovat a
     * nesmí být expirovaný. Vrací buď platný model, nebo hotovou chybovou JsonResponse
     * (union return typ - volající kontroluje `instanceof JsonResponse`).
     */
    private function findValidToken(string $token): AccountActivationToken|JsonResponse
    {
        $record = AccountActivationToken::where('token_hash', hash('sha256', $token))->first();

        if (!$record || !$record->isValid()) {
            return response()->json(['message' => 'Odkaz je neplatný nebo vypršel.'], 410);
        }

        return $record;
    }
}