<?php
/**
 * @file WebCookieConsent.php
 * @path app/Models/Web/WebCookieConsent.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One cookie consent decision of a visitor (GDPR Art. 7(1) - the controller must be
 * able to demonstrate the consent): random `consent_id` (also kept in the visitor's browser, so a
 * given decision can be found), version of the consent text, chosen categories and the time.
 * Every change of the decision is a new row - the history is the proof.
 * @security Anonymous by design: no IP address, no user agent, no account. Deleted after the
 * `cookie_consents` retention period (RetentionPurgeService).
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;

class WebCookieConsent extends Model
{
    /** @description Only `created_at` - a record never changes. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'consent_id',
        'version',
        'functional',
        'analytics',
        'marketing',
    ];

    protected $casts = [
        'version'    => 'integer',
        'functional' => 'boolean',
        'analytics'  => 'boolean',
        'marketing'  => 'boolean',
        'created_at' => 'datetime',
    ];
}
