<?php
/**
 * @file ProjectLoginCode.php
 * @path app/Apps/ProjectPortal/Models/ProjectLoginCode.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One-time sign-in to the client portal sent by e-mail: an invitation (a link valid
 *   7 days, sent by the administration) or a sign-in requested by the client ("send me a code":
 *   a 6-digit code + a link, valid 15 minutes). Only SHA-256 hashes are stored; each code / link
 *   works once, a code allows 5 wrong attempts; a new one of the same purpose makes the unused
 *   older ones expire. Using one proves the e-mail of the account (email_verified_at).
 * @security Codes and links never appear in logs or answers - only in the e-mail.
 * @dependencies ProjectAccount
 */

namespace App\Apps\ProjectPortal\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ProjectLoginCode extends Model
{
    /** @description Database table of the model. */
    protected $table = 'project_portal_project_login_codes';

    /** @description Never copied into the audit log (secrets / personal data). */
    public const AUDIT_MASKED = ['code_hash', 'link_hash', 'created_ip'];

    public const PURPOSE_INVITE = 'invite';
    public const PURPOSE_LOGIN = 'login';

    /** @description Validity of an invitation link (minutes). */
    public const INVITE_TTL_MINUTES = 7 * 24 * 60;

    /** @description Validity of a requested code / link (minutes). */
    public const LOGIN_TTL_MINUTES = 15;

    /** @description Wrong codes allowed before the code stops working. */
    public const MAX_ATTEMPTS = 5;

    /** @description Codes an account may request per hour (beyond the per-IP throttle). */
    public const MAX_REQUESTS_PER_HOUR = 5;

    protected $fillable = ['account_id', 'purpose', 'code_hash', 'link_hash', 'expires_at', 'created_ip'];

    protected $casts = [
        'expires_at' => 'datetime',
        'used_at'    => 'datetime',
        'attempts'   => 'integer',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(ProjectAccount::class, 'account_id');
    }

    /**
     * @description Issues a new code / link (the unused older ones of the same purpose stop
     *   working).
     * @param ProjectAccount $account Account to sign in.
     * @param string $purpose PURPOSE_INVITE | PURPOSE_LOGIN.
     * @param string|null $ip Address of the request.
     * @return array{code: string|null, link: string, expires_at: \Illuminate\Support\Carbon} Plaintext
     *   code (login only) and link token - for the e-mail only.
     */
    public static function issue(ProjectAccount $account, string $purpose, ?string $ip = null): array
    {
        // The older unused ones stop working at once but stay (the hourly limit counts them;
        // the retention clean-up removes them a day later).
        static::where('account_id', $account->id)->where('purpose', $purpose)->whereNull('used_at')
            ->where('expires_at', '>', now())->update(['expires_at' => now()->subSecond()]);

        $code = $purpose === self::PURPOSE_LOGIN ? str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT) : null;
        $link = Str::random(64);
        $expires = now()->addMinutes($purpose === self::PURPOSE_INVITE ? self::INVITE_TTL_MINUTES : self::LOGIN_TTL_MINUTES);

        static::create([
            'account_id' => $account->id,
            'purpose'    => $purpose,
            'code_hash'  => $code !== null ? self::hashCode($account, $code) : null,
            'link_hash'  => hash('sha256', $link),
            'expires_at' => $expires,
            'created_ip' => $ip,
        ]);

        return ['code' => $code, 'link' => $link, 'expires_at' => $expires];
    }

    /**
     * @description Hash of a code - bound to the account, so equal codes of two accounts differ.
     * @param ProjectAccount $account Account of the code.
     * @param string $code Plaintext code.
     * @return string
     */
    public static function hashCode(ProjectAccount $account, string $code): string
    {
        return hash('sha256', $account->id . '|' . preg_replace('/\D/', '', $code));
    }

    /**
     * @description A valid (unused, not expired) link of a project.
     * @param int $projectId Project of the portal.
     * @param string $link Plaintext link token.
     * @return static|null
     */
    public static function findValidLink(int $projectId, string $link): ?self
    {
        return static::where('link_hash', hash('sha256', $link))
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->whereHas('account', fn ($q) => $q->where('project_id', $projectId))
            ->with('account')
            ->first();
    }

    /**
     * @description Checks a code against the newest valid sign-in code of the account; every
     *   wrong try counts, after MAX_ATTEMPTS the code is spent.
     * @param ProjectAccount $account Account.
     * @param string $code Code as entered.
     * @return static|null The matching code, else null.
     */
    public static function matchCode(ProjectAccount $account, string $code): ?self
    {
        $row = static::where('account_id', $account->id)
            ->where('purpose', self::PURPOSE_LOGIN)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->where('attempts', '<', self::MAX_ATTEMPTS)
            ->latest('id')
            ->first();
        if ($row === null) {
            return null;
        }
        if (!hash_equals((string) $row->code_hash, self::hashCode($account, $code))) {
            $row->increment('attempts');

            return null;
        }

        return $row;
    }

    /**
     * @description Spends the code / link and marks the e-mail of the account as proven.
     * @return void
     */
    public function consume(): void
    {
        $this->forceFill(['used_at' => now()])->save();
        if ($this->account && $this->account->email_verified_at === null) {
            $this->account->forceFill(['email_verified_at' => now()])->save();
        }
    }
}
