<?php

/**
 * @file TwoFactorCode.php
 * @path app/Models/TwoFactorCode.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Reprezentuje jednu "pending-login" 2FA relaci - vzniká po úspěšném
 * ověření hesla u uživatele s vynucenou 2FA, dokud nezadá platný OTP kód. Vzor
 * (hash namísto raw hodnoty, expirace, used_at) převzat z PasswordResetToken.
 * @property int $user_id
 * @property string $login_token_hash SHA-256 hash opaque tokenu pending-login session.
 * @property string $code_hash SHA-256 hash 6místného OTP kódu.
 * @property int $attempts Počet neúspěšných pokusů o ověření kódu.
 * @property int $resend_count Počet vyžádání nového kódu v rámci téhle session.
 * @property \Illuminate\Support\Carbon $expires_at
 * @property \Illuminate\Support\Carbon $last_sent_at
 * @property \Illuminate\Support\Carbon|null $used_at
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TwoFactorCode extends Model
{
    /** Platnost OTP kódu v minutách od posledního odeslání. */
    public const CODE_TTL_MINUTES = 10;

    /** Minimální odstup mezi dvěma odesláními kódu (anti-spam cooldown). */
    public const RESEND_COOLDOWN_SECONDS = 60;

    /** Maximální počet resendů v rámci jedné pending-login session. */
    public const MAX_RESENDS = 5;

    /** Maximální počet špatných pokusů o zadání kódu, než se session zneplatní. */
    public const MAX_ATTEMPTS = 5;

    public $timestamps = false;

    protected $fillable = [
        'user_id', 'login_token_hash', 'code_hash',
        'attempts', 'resend_count', 'expires_at', 'last_sent_at', 'used_at', 'ip_address',
    ];

    protected $casts = [
        'expires_at'   => 'datetime',
        'last_sent_at' => 'datetime',
        'used_at'      => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /**
     * @description Ověří, zda je tato pending-login session ještě platná pro dokončení
     * loginu (nepoužitá, nevypršelá, pod limitem pokusů).
     */
    public function isValid(): bool
    {
        return is_null($this->used_at)
            && $this->expires_at->isFuture()
            && $this->attempts < self::MAX_ATTEMPTS;
    }

    /**
     * @description Zjistí, zda ještě neuplynul cooldown od posledního odeslání kódu.
     */
    public function isInCooldown(): bool
    {
        return $this->last_sent_at->diffInSeconds(now()) < self::RESEND_COOLDOWN_SECONDS;
    }
}