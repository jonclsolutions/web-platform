<?php

/**
 * @file PasswordResetToken.php
 * @path app/Models/PasswordResetToken.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model reprezentující jednorázový token pro reset hesla administrátorského účtu.
 *              V databázi je uložen vždy jen HASH tokenu (nikdy raw hodnota).
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PasswordResetToken extends Model
{
    public $timestamps = false; // spravujeme created_at ručně (viz. migrace - useCurrent)

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
     * @description Token je platný, pokud ještě nebyl použit a nevypršela jeho expirace.
     */
    public function isValid(): bool
    {
        return is_null($this->used_at) && $this->expires_at->isFuture();
    }
}