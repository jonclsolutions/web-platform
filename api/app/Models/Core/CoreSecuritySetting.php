<?php
/**
 * @file CoreSecuritySetting.php
 * @path app/Models/Core/CoreSecuritySetting.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Singleton nastavení bezpečnostního monitoringu (core_security_events) -
 * retenční doba ve dnech + hlavní e-mailová doména pro whitelist při vytváření admin
 * účtů. Stejný "jeden řádek" vzor jako WebSiteSetting. Čte/upravuje se vždy záznam
 * s `id = 1` (viz CoreSecuritySettingController).
 *
 * @bugfix-note (2026-08-25) KRITICKÝ BUG - `primary_email_domain` SE TICHE
 * NEUKLÁDALA: sloupec byl přidán do DB (viz email-domain-whitelist.sql), ale
 * zapomenutý v `$fillable` - `$setting->update(['primary_email_domain' => ...])` proto
 * Eloquent mass-assignment ochrana TICHE IGNOROVALA (žádná výjimka, žádná chybová
 * odpověď - request vrátil 200 "úspěch", ale do DB se nic nezapsalo). Doplněno.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

class CoreSecuritySetting extends Model
{
    /** @description ID singleton řádku - v tabulce nikdy nesmí existovat druhý záznam. */
    public const SINGLETON_ID = 1;

    protected $fillable = [
        'retention_days',
        'primary_email_domain',
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