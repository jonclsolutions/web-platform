<?php
/**
 * @file CoreSiteSetting.php
 * @path app/Models/Core/CoreSiteSetting.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model for global site configuration settings - currently limited to
 * public web maintenance mode. Shop maintenance was moved out to
 * `App\Models\Shop\ShopSiteSetting` (see refactor-note below).
 *
 * @refactor-note (2026-08-15) `is_shop_active` and `maintenance_message` removed after
 * being extracted into the new `shop_site_settings` table / `ShopSiteSetting` model.
 * @bugfix-note (2026-08-15) `$fillable` previously only listed `is_shop_active` and
 * `maintenance_message` - it never included `is_web_active` / `web_maintenance_message`,
 * even though `CoreSiteSettingController::show()` mass-assigns them via `::create()`.
 * Under Eloquent, keys not present in `$fillable` are silently dropped during mass
 * assignment, so a first-ever `show()` call (no existing settings row) would have
 * created a row with only the shop values set and web values falling back to the
 * column's DB default. Since shop is now gone from this model entirely, the web fields
 * are added to `$fillable` to close that gap for the remaining (web) use case.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores the public web's global availability state (maintenance mode) and
 * the message shown to visitors while it is disabled.
 *
 * @property bool $is_web_active Whether the public web is enabled.
 * @property string|null $web_maintenance_message Message displayed when the web is under maintenance.
 */
class CoreSiteSetting extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'core_site_settings';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'is_web_active',
        'web_maintenance_message',
    ];

    /**
     * @var array<string, string> The attributes that should be cast.
     */
    protected $casts = [
        'is_web_active' => 'boolean',
    ];
}