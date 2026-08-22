<?php
/**
 * @file CoreSecuritySetting.php
 * @path app/Models/Core/CoreSecuritySetting.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Singleton nastavení bezpečnostního monitoringu (core_security_events) -
 * aktuálně jen retenční doba ve dnech. Stejný "jeden řádek" vzor jako WebSiteSetting.
 * Čte/upravuje se vždy záznam s `id = 1` (viz CoreSecuritySettingController).
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

class CoreSecuritySetting extends Model
{
    /** @description ID singleton řádku - v tabulce nikdy nesmí existovat druhý záznam. */
    public const SINGLETON_ID = 1;

    protected $fillable = [
        'retention_days',
    ];

    protected $casts = [
        'retention_days' => 'integer',
    ];

    /**
     * @description Vrátí (a při prvním spuštění založí) singleton řádek nastavení.
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