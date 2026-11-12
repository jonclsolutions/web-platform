<?php
/**
 * @file WebProjectAccount.php
 * @path app/Models/Web/WebProjectAccount.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Client account of the project portal. The administration creates it (login name,
 *   display name, password, optional e-mail) and is the only one who can change it: the client
 *   cannot change the password or anything else; a forgotten password is reset by the
 *   administration (which ends the account's sessions). Signs in with the project's link + login
 *   name + password; every message, sign-in and session of the client belongs to an account. The
 *   only things the client sets itself (portal, "My account") are its e-mail, the language of the
 *   e-mails and which notifications it wants - all off by default.
 * @property string $username Login name - unique within the project, lower case.
 * @property string $password_hash Bcrypt hash (never returned by the API).
 * @property bool $notify_replies E-mail about a new reply of the supplier (opt-in by the client).
 * @property bool $notify_checkpoint_status E-mail about a checkpoint status change (opt-in by the client).
 * @property bool $notify_checkpoint_dates E-mail about a new / changed checkpoint due date (opt-in by the client).
 * @property string $language Language of those e-mails ('cz' | 'en').
 * @dependencies WebProject, WebProjectSession
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class WebProjectAccount extends Model
{
    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['display_name', 'email'];

    /** @description Languages of the notification e-mails. */
    public const LANGUAGES = ['cz', 'en'];

    /**
     * @description Notification switches the client sets in the portal, by the kind of the e-mail
     *   (ProjectClientUpdateMail::KIND_*) they allow.
     */
    public const NOTIFICATIONS = [
        'reply'           => 'notify_replies',
        'checkpoint'      => 'notify_checkpoint_status',
        'checkpoint_date' => 'notify_checkpoint_dates',
    ];

    /** @description Length of a generated password. */
    public const GENERATED_PASSWORD_LENGTH = 14;

    protected $fillable = [
        'project_id',
        'username',
        'display_name',
        'email',
        'notify_replies',
        'notify_checkpoint_status',
        'notify_checkpoint_dates',
        'language',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $casts = [
        'notify_replies'           => 'boolean',
        'notify_checkpoint_status' => 'boolean',
        'notify_checkpoint_dates'  => 'boolean',
        'password_set_at' => 'datetime',
        'last_login_at'   => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(WebProject::class, 'project_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(WebProjectSession::class, 'account_id');
    }

    /**
     * @description Login names are compared in lower case without surrounding spaces.
     * @param string|null $value Login name as entered.
     * @return void
     */
    public function setUsernameAttribute(?string $value): void
    {
        $this->attributes['username'] = Str::lower(trim((string) $value));
    }

    /**
     * @description Turns every notification off (the e-mail was removed or changed by the
     *   administration - the client confirms the new address by turning them on again).
     * @return void
     */
    public function disableNotifications(): void
    {
        foreach (self::NOTIFICATIONS as $column) {
            $this->{$column} = false;
        }
    }

    /**
     * @description A random password for a new account / a reset (letters and digits, no symbols
     *   that are easy to mistype when the client copies it from a message).
     * @return string Plaintext password.
     */
    public static function generatePassword(): string
    {
        return Str::password(self::GENERATED_PASSWORD_LENGTH, symbols: false);
    }

    /**
     * @description Stores a new password (hash only) - the caller passes the plaintext on to the
     *   client once; it is never readable again.
     * @param string $plaintext New password.
     * @return void
     */
    public function setPassword(string $plaintext): void
    {
        $this->password_hash = Hash::make($plaintext);
        $this->password_set_at = now();
    }

    /**
     * @description Checks a password of a sign-in. A stored value that is not a hash of the
     *   configured algorithm (damaged / foreign data) is a failed sign-in, never an error.
     * @param string $plaintext Password as entered.
     * @return bool
     */
    public function verifyPassword(string $plaintext): bool
    {
        try {
            return Hash::check($plaintext, (string) $this->password_hash);
        } catch (\RuntimeException) {
            return false;
        }
    }
}
