<?php
/**
 * @file WebSiteSetting.php
 * @path app/Models/Web/WebSiteSetting.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model for public-web-specific global configuration - currently limited to
 * web maintenance mode (active flag + visitor-facing message).
 *
 * @refactor-note (2026-08-15) Extracted from `App\Models\Core\CoreSiteSetting`
 * (`core_site_settings` table), which is now dropped entirely. Web maintenance is a
 * Web-domain concern, not a Core-domain concern - mirrors the earlier extraction of shop
 * maintenance into `App\Models\Shop\ShopSiteSetting`. With both sections moved out,
 * `core_site_settings` had nothing left in it and was removed rather than kept as dead
 * infrastructure.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores the public web's global availability state (maintenance mode) and
 * the message shown to visitors while it is disabled.
 *
 * @property bool $is_web_active Whether the public web is enabled.
 * @property string|null $web_maintenance_message Message displayed to visitors when disabled.
 */
class WebSiteSetting extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'web_site_settings';

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