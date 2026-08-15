<?php
/**
 * @file ShopSiteSetting.php
 * @path app/Models/Shop/ShopSiteSetting.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model for shop-specific global configuration - currently limited to
 * e-shop maintenance mode (active flag + customer-facing message).
 *
 * @refactor-note (2026-08-15) Extracted from `App\Models\Core\CoreSiteSetting`, which
 * previously held both shop and web maintenance flags in a single shared table
 * (`core_site_settings`). Shop maintenance is a Shop-domain concern, not a Core-domain
 * concern, so it now lives in its own `shop_site_settings` table and model, consistent
 * with how `ShopPublicController::getStatus()` was already scoped to Shop. See migration
 * SQL executed against `core_site_settings` / `shop_site_settings` for the data move.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores the e-shop's global availability state (maintenance mode) and the
 * message shown to customers while it is disabled.
 *
 * @property bool $is_shop_active Whether the e-shop storefront/checkout is enabled.
 * @property string|null $maintenance_message Message displayed to customers when disabled.
 */
class ShopSiteSetting extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_site_settings';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'is_shop_active',
        'maintenance_message',
    ];

    /**
     * @var array<string, string> The attributes that should be cast.
     */
    protected $casts = [
        'is_shop_active' => 'boolean',
    ];
}