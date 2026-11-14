<?php
/**
 * @file ProjectSession.php
 * @path app/Apps/ProjectPortal/Models/ProjectSession.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The authenticated 24h-sliding session of a client account (ProjectAccount),
 * issued after a successful sign-in (see ProjectPublicController::login()). Deleted with its
 * account and when the administration resets the account's password.
 * Separate from `project_portal_projects.access_token` (the permanent URL) - this is the
 * actual post-password credential, expiring after 24h of INACTIVITY (sliding
 * window, extended on every authenticated request by CheckProjectSession
 * middleware), never on a hard wall-clock timer from login.
 *
 * @note `session_token_hash` stores a SHA-256 hash of the actual bearer token - the
 * plaintext token is returned to the client exactly once (at login) and never stored
 * server-side, same principle as how real passwords are never stored plaintext.
 */

namespace App\Apps\ProjectPortal\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ProjectSession extends Model
{
    /** @description Database table of the model. */
    protected $table = 'project_portal_project_sessions';

    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['ip_address', 'user_agent'];

    protected $fillable = [
        'project_id',
        'account_id',
        'session_token_hash',
        'expires_at',
        'last_used_at',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'expires_at'   => 'datetime',
        'last_used_at' => 'datetime',
    ];

    /** @description Sliding window length (minutes) - re-applied on every authenticated request, see CheckProjectSession. */
    public const LIFETIME_MINUTES = 24 * 60;

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(ProjectAccount::class, 'account_id');
    }

    /**
     * @description Creates a new session of the account and returns the PLAINTEXT bearer token -
     * available only at this moment, never again (only its hash is stored).
     * @param ProjectAccount $account Signed-in client account (its project owns the session).
     * @param string|null $ip Client IP address.
     * @param string|null $userAgent Browser of the client.
     * @return string Plaintext session token.
     */
    public static function issueFor(ProjectAccount $account, ?string $ip, ?string $userAgent): string
    {
        $plaintext = Str::random(64);

        self::create([
            'project_id'         => $account->project_id,
            'account_id'         => $account->id,
            'session_token_hash' => hash('sha256', $plaintext),
            'expires_at'         => now()->addMinutes(self::LIFETIME_MINUTES),
            'last_used_at'       => now(),
            'ip_address'         => $ip,
            'user_agent'         => $userAgent,
        ]);

        return $plaintext;
    }

    /**
     * @description Finds a session by the PLAINTEXT bearer token (hashed again for the lookup -
     * the plaintext is never stored); null when missing or expired. Does NOT extend the expiry
     * (the middleware does) - a pure lookup.
     */
    public static function findValidByPlaintextToken(string $plaintext): ?self
    {
        return self::where('session_token_hash', hash('sha256', $plaintext))
            ->where('expires_at', '>', now())
            ->first();
    }

    public function slideExpiry(): void
    {
        $this->expires_at = now()->addMinutes(self::LIFETIME_MINUTES);
        $this->last_used_at = now();
        $this->save();
    }
}