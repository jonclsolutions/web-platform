<?php
/**
 * @file ShopPaymentMethod.php
 * @path app/Models/Shop/ShopPaymentMethod.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model representing available payment options for the shop.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @description Manages payment configurations, including bank details for manual payments and provider flags.
 * * @property string $code Internal code for the payment method.
 * @property bool $is_active Toggle for method availability in checkout.
 */
class ShopPaymentMethod extends Model
{
    use SoftDeletes;

    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_payment_methods';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'code',
        'name',
        'image_path',
        'description',
        'price',
        'provider',
        'is_external',
        'bank_account_number',
        'bank_account_code',
        'bank_iban',
        'bank_swift_bic',
        'variable_symbol_type',
        'is_active',
        'sort_order',
        'config',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'is_active' => 'boolean',
        'is_external' => 'boolean',
        'price' => 'decimal:2',
        'sort_order' => 'integer',
        'config' => 'array',
    ];
}