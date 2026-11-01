<?php

/**
 * @file PasswordResetToken.php
 * @path app/Models/PasswordResetToken.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One-time password reset token of an admin account.
 *              The database always stores only the HASH of the token (never the raw value).
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PasswordResetToken extends Model
{
    public $timestamps = false; // created_at is managed manually (the column uses useCurrent()).

    protected $fillable = [
        'user_id',
        'token_hash',
        'expires_at',
        'used_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'used_at'    => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @description The token is valid when it was not used and has not expired.
     */
    public function isValid(): bool
    {
        return is_null($this->used_at) && $this->expires_at->isFuture();
    }
}