<?php

/**
 * @file TwoFactorCode.php
 * @path app/Models/TwoFactorCode.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One "pending-login" 2FA session - created after a successful password check of a
 * user with forced 2FA, valid until the user enters a valid OTP code. Same pattern as
 * PasswordResetToken (hash instead of the raw value, expiry, used_at).
 * @property int $user_id
 * @property string $login_token_hash SHA-256 hash of the opaque token of the pending-login session.
 * @property string $code_hash SHA-256 hash of the 6-digit OTP code.
 * @property int $attempts Failed attempts to verify the code.
 * @property int $resend_count Requests for a new code within this session.
 * @property \Illuminate\Support\Carbon $expires_at
 * @property \Illuminate\Support\Carbon $last_sent_at
 * @property \Illuminate\Support\Carbon|null $used_at
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TwoFactorCode extends Model
{
    /** Validity of the OTP code in minutes since it was last sent. */
    public const CODE_TTL_MINUTES = 10;

    /** Minimum gap between two sends of a code (anti-spam cooldown). */
    public const RESEND_COOLDOWN_SECONDS = 60;

    /** Maximum resends within one pending-login session. */
    public const MAX_RESENDS = 5;

    /** Maximum wrong attempts before the session is invalidated. */
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
     * @description Whether this pending-login session can still finish the login (unused, not
     * expired, below the attempt limit).
     */
    public function isValid(): bool
    {
        return is_null($this->used_at)
            && $this->expires_at->isFuture()
            && $this->attempts < self::MAX_ATTEMPTS;
    }

    /**
     * @description Whether the cooldown since the last send of the code is still running.
     */
    public function isInCooldown(): bool
    {
        return $this->last_sent_at->diffInSeconds(now()) < self::RESEND_COOLDOWN_SECONDS;
    }
}