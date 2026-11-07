<?php
/**
 * @file RefreshToken.php
 * @path app/Models/RefreshToken.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Model representing authentication refresh tokens (only the SHA-256 hash of the
 * token is stored). The tokens of one login form a `family`: every refresh marks the used token
 * `rotated_at` and issues a new one of the same family, so a second use of a used token (a stolen
 * copy) is detected - see AuthController::refresh(). `session_expires_at` is the absolute end of the
 * login, inherited by the whole family; no token of the family expires after it.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @description Manages persistent authentication tokens for session renewal.
 * @property int $user_id Associated user identifier.
 * @property string $token SHA-256 hash of the token.
 * @property string|null $family Id shared by all tokens of one login.
 * @property \Illuminate\Support\Carbon|null $expires_at Expiry of the token.
 * @property \Illuminate\Support\Carbon|null $session_expires_at Absolute end of the login (AuthCookies::SESSION_MAX_DAYS).
 * @property \Illuminate\Support\Carbon|null $rotated_at When the token was used and replaced (null = current token).
 */
class RefreshToken extends Model
{
    use HasFactory;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'token',
        'family',
        'expires_at',
        'session_expires_at',
        'rotated_at',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'expires_at' => 'datetime',
        'session_expires_at' => 'datetime',
        'rotated_at' => 'datetime',
    ];

    /**
     * Get the user owning the refresh token.
     * * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}