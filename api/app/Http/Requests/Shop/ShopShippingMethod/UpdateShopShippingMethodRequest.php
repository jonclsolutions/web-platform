<?php
/**
 * @file UpdateShopShippingMethodRequest.php
 * @path app/Http/Requests/Shop/ShopShippingMethod/UpdateShopShippingMethodRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing shop shipping methods.
 */

namespace App\Http\Requests\Shop\ShopShippingMethod;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for updating shipping method configurations, ensuring unique codes.
 */
class UpdateShopShippingMethodRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool { return true; }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        $id = $this->route('id');
        return [
            'code'                    => 'required|string|max:50|unique:shop_shipping_methods,code,' . $id,
            'name'                    => 'required|string|max:100',
            'description'             => 'nullable|string',
            'shipping_type'           => 'required|string|max:30',
            'base_price'              => 'required|numeric|min:0',
            'allows_cod'              => 'boolean',
            'cod_price'               => 'nullable|numeric|min:0',
            'free_shipping_threshold' => 'nullable|numeric|min:0',
            'max_weight'              => 'nullable|numeric|min:0',
            'requires_pickup_point'   => 'boolean',
            'tracking_url'            => 'nullable|string|max:255',
            'logo_path'               => 'nullable|string|max:255',
            'delivery_days_min'       => 'nullable|integer|min:0',
            'delivery_days_max'       => 'nullable|integer|min:0',
            'is_active'               => 'boolean',
            'sort_order'              => 'integer',
        ];
    }
}