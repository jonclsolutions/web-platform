<?php
/**
 * @file AccountActivationToken.php
 * @path app/Models/AccountActivationToken.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Jednorázový token pro nastavení hesla a aktivaci účtu založeného adminem
 * (backlog "workflow zakládání účtů z adminu"). Stejný bezpečnostní princip jako
 * `RefreshToken`/`TwoFactorCode` - v DB se ukládá jen SHA-256 hash tokenu, nikdy raw
 * hodnota. `issueFor()` vždy zneplatní všechny předchozí tokeny daného uživatele, takže
 * v danou chvíli může existovat maximálně jeden platný aktivační odkaz.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class AccountActivationToken extends Model
{
    /** Model nemá `updated_at` - token se buď použije a smaže, nebo vyprší. */
    public const UPDATED_AT = null;

    /** Platnost odkazu - rozhodnuto v backlogu ("48h je v pořádku"). */
    public const EXPIRES_HOURS = 48;

    protected $fillable = ['user_id', 'token_hash', 'expires_at'];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    /**
     * @description Zda je token stále platný (existuje a nevypršel).
     */
    public function isValid(): bool
    {
        return !$this->expires_at->isPast();
    }

    /**
     * @description Vygeneruje nový aktivační token pro daného uživatele. Nejdřív smaže
     * VŠECHNY předchozí tokeny uživatele (starý odkaz okamžitě přestane fungovat) a
     * vrátí RAW token pro jednorázové vložení do e-mailu - do DB jde vždy jen jeho
     * SHA-256 hash.
     */
    public static function issueFor(User $user): string
    {
        self::where('user_id', $user->id)->delete();

        $raw = Str::random(64);

         self::create([
            'user_id'    => $user->id,
            'token_hash' => hash('sha256', $raw),
            'expires_at' => now()->addHours(self::EXPIRES_HOURS),
            // TESTING ONLY - 1 minute validity. Restore the line above before commit.
            // 'expires_at' => now()->addMinutes(1),
        ]);

        return $raw;
    }
}