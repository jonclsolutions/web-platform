<?php

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopProductPrice extends Model
{
    protected $table = 'shop_product_prices'; // nebo jak máš pojmenovanou tabulku cen

    protected $fillable = [
        'product_id',
        'variant_id',
        'vat_rate',
        'price_czk_with_vat',
        'price_czk_without_vat',
        'price_eur_with_vat',
        'price_eur_without_vat',
        
        // 🌟 PŘIDEJ TYTO DVA ŘÁDKY SEM:
        'cost_price_czk',
        'cost_price_eur',
    ];

    protected $casts = [
        'vat_rate'              => 'float',
        'price_czk_with_vat'    => 'float',
        'price_czk_without_vat' => 'float',
        'price_eur_with_vat'    => 'float',
        'price_eur_without_vat' => 'float',
        'cost_price_czk'        => 'float', // 🌟 Můžeš přidat i přetypování
        'cost_price_eur'        => 'float', // 🌟 Můžeš přidat i přetypování
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(ShopProduct::class, 'product_id');
    }
}