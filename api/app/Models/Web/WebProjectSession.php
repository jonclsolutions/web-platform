<?php
/**
 * @file WebProjectSession.php
 * @path app/Models/Web/WebProjectSession.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description The customer's authenticated 24h-sliding session, issued after
 * successful password verification (see WebProjectPublicController::login()).
 * Separate from `web_projects.access_token` (the permanent URL) - this is the
 * actual post-password credential, expiring after 24h of INACTIVITY (sliding
 * window, extended on every authenticated request by CheckProjectSession
 * middleware), never on a hard wall-clock timer from login.
 *
 * @note `session_token_hash` stores a SHA-256 hash of the actual bearer token - the
 * plaintext token is returned to the client exactly once (at login) and never stored
 * server-side, same principle as how real passwords are never stored plaintext.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class WebProjectSession extends Model
{
    protected $fillable = [
        'project_id',
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

    /** @description Sliding window length (minut) - re-applied na každý autentizovaný request, viz CheckProjectSession middleware. */
    public const LIFETIME_MINUTES = 24 * 60;

    public function project(): BelongsTo
    {
        return $this->belongsTo(WebProject::class, 'project_id');
    }

    /**
     * @description Vytvoří novou session a vrátí PLAINTEXT bearer token - dostupný
     * jen v tomto přesném okamžiku, nikdy znovu (ukládá se jen hash).
     */
    public static function issueFor(WebProject $project, ?string $ip, ?string $userAgent): string
    {
        $plaintext = Str::random(64);

        self::create([
            'project_id'         => $project->id,
            'session_token_hash' => hash('sha256', $plaintext),
            'expires_at'         => now()->addMinutes(self::LIFETIME_MINUTES),
            'last_used_at'       => now(),
            'ip_address'         => $ip,
            'user_agent'         => $userAgent,
        ]);

        return $plaintext;
    }

    /**
     * @description Najde session podle PLAINTEXT bearer tokenu (znovu se hashuje pro
     * porovnání - nikdy se neukládá plaintext), vrací null pokud neexistuje nebo už
     * vypršela. NEPOSOUVÁ expiraci sama - to dělá volající (middleware), tahle metoda
     * je čisté vyhledání.
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