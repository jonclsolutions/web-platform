<?php
/**
 * @file ShopCustomer.php
 * @path app/Models/Shop/ShopCustomer.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model representing shop customers and their associated data.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

/**
 * @description Stores customer profiles, contact info, and transaction history.
 * 
 * @property int $id The unique identifier.
 * @property string $email Customer email address.
 * @property float $total_spent Aggregate of completed orders.
 */
class ShopCustomer extends Model
{
    use SoftDeletes;

    /**
     * @var string The table associated with the model.
     */
    protected $table = 'shop_customers';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'email',
        'first_name',
        'last_name',
        'phone',
        'company',
        'address',
        'city',
        'postal_code',
        'country',
        'is_active',
        'total_spent',
        'notes',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'is_active' => 'boolean',
        'total_spent' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Get the orders associated with this customer.
     *
     * @return HasMany
     */
    public function orders(): HasMany
    {
        return $this->hasMany(ShopOrder::class, 'customer_id');
    }

    /**
     * Updates the total_spent field by calculating the sum of relevant customer orders.
     *
     * @return void
     */
    public function recalculateTotalSpent(): void
    {
        $total = ShopOrder::where('customer_id', $this->id)
            ->whereIn('status', ['confirmed', 'processing', 'shipped', 'delivered'])
            ->selectRaw('SUM(final_amount - shipping_amount) as total')
            ->value('total');

        $this->update(['total_spent' => $total ?? 0]);
    }

    /**
     * Returns the full name of the customer.
     *
     * @return string
     */
    public function getFullName(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    /**
     * Scope a query to only include active customers.
     *
     * @param Builder $query
     * @return Builder
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}