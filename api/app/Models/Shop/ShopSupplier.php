<?php
/**
 * @file ShopSupplier.php
 * @path app/Models/Shop/ShopSupplier.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model representing a product supplier.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @description Manages details for suppliers providing products to the shop.
 * * @property string $name Supplier business name.
 * @property bool $is_active Toggle for supplier status.
 */
class ShopSupplier extends Model
{
    use SoftDeletes;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'name',
        'ico',
        'contact_person',
        'email',
        'phone',
        'address',
        'city',
        'postal_code',
        'country',
        'payment_terms',
        'is_active',
        'notes',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get the products provided by this supplier.
     */
    public function products(): HasMany
    {
        return $this->hasMany(ShopProduct::class, 'supplier_id');
    }
}