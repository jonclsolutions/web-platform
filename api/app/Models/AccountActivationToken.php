<?php
/**
 * @file AccountActivationToken.php
 * @path app/Models/AccountActivationToken.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One-time token for setting the password and activating an account created by an
 * admin. Same principle as `RefreshToken` / `TwoFactorCode`: the database stores only the
 * SHA-256 hash, never the raw value. `issueFor()` invalidates every earlier token of the user -
 * at most one activation link is valid at a time.
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class AccountActivationToken extends Model
{
    /** No `updated_at` - a token is either used and deleted or it expires. */
    public const UPDATED_AT = null;

    /** Validity of the link (48 hours). */
    public const EXPIRES_HOURS = 48;

    protected $fillable = ['user_id', 'token_hash', 'expires_at'];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    /**
     * @description Whether the token is still valid (exists and has not expired).
     */
    public function isValid(): bool
    {
        return !$this->expires_at->isPast();
    }

    /**
     * @description Issues a new activation token for the user: deletes ALL earlier tokens of the
     * user first (the old link stops working at once) and returns the RAW token for the e-mail -
     * the database stores only its SHA-256 hash.
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