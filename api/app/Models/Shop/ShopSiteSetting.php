<?php
/**
 * @file ShopSiteSetting.php
 * @path app/Models/Shop/ShopSiteSetting.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Model for shop-specific global configuration - currently limited to
 * e-shop maintenance mode (active flag + customer-facing message).
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