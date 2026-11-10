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
 * @description Stores the e-shop's global availability state (maintenance mode), the
 * message shown to customers while it is disabled and the texts of the order confirmation
 * e-mail (per language, ShopOrderEmailTemplate).
 *
 * @property bool $is_shop_active Whether the e-shop storefront/checkout is enabled.
 * @property string|null $maintenance_message Message displayed to customers when disabled.
 * @property array|null $order_email_subject_i18n Subject per language.
 * @property array|null $order_email_title_i18n Title per language.
 * @property array|null $order_email_intro_i18n Intro per language.
 * @property array|null $order_email_outro_i18n Closing text per language.
 * @property array|null $order_email_labels_i18n Labels per language: { lang: { key: text } }.
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
        // Confirmation e-mail of an order, texts per language (ShopOrderEmailTemplate).
        'order_email_subject_i18n',
        'order_email_title_i18n',
        'order_email_intro_i18n',
        'order_email_outro_i18n',
        'order_email_labels_i18n',
    ];

    /**
     * @var array<string, string> The attributes that should be cast.
     */
    protected $casts = [
        'is_shop_active' => 'boolean',
        'order_email_subject_i18n' => 'array',
        'order_email_title_i18n' => 'array',
        'order_email_intro_i18n' => 'array',
        'order_email_outro_i18n' => 'array',
        'order_email_labels_i18n' => 'array',
    ];
}