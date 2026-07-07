<?php
/**
 * @file RefreshToken.php
 * @path app/Models/RefreshToken.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Model representing authentication refresh tokens.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @description Manages persistent authentication tokens for session renewal.
 * * @property int $user_id Associated user identifier.
 * @property string $token The secure token string.
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
        'expires_at',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'expires_at' => 'datetime',
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