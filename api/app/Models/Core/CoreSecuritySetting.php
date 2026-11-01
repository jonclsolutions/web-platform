<?php
/**
 * @file CoreSecuritySetting.php
 * @path app/Models/Core/CoreSecuritySetting.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Singleton settings of the security monitoring: retention in days + the company
 * e-mail domain of the e-mail access policy. Same "one row" pattern as WebSiteSetting - always
 * the row `id = 1` (CoreSecuritySettingController).
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

class CoreSecuritySetting extends Model
{
    /** @description ID of the singleton row - the table must never hold a second row. */
    public const SINGLETON_ID = 1;

    protected $fillable = [
        'retention_days',
        'primary_email_domain',
    ];

    protected $casts = [
        'retention_days' => 'integer',
    ];

    /**
     * @description Returns (and creates on the first call) the singleton settings row.
     * @return self
     */
    public static function current(): self
    {
        return self::firstOrCreate(
            ['id' => self::SINGLETON_ID],
            ['retention_days' => 90]
        );
    }
}