<?php
/**
 * @file UpdateCoreSiteSettingRequest.php
 * @path app/Http/Requests/Core/CoreSiteSettings/UpdateCoreSiteSettingRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating core site settings, specifically managing maintenance mode status and messaging.
 */

namespace App\Http\Requests\Core\CoreSiteSettings;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for updating site-wide settings.
 * @note Automatically sanitizes the 'is_shop_active' input to a boolean value during the request lifecycle.
 */
class UpdateCoreSiteSettingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return [
            'is_shop_active'      => 'required|in:0,1,true,false,boolean',
            'maintenance_message' => 'nullable|string|max:255',
        ];
    }

    /**
     * Prepare the data for validation.
     *
     * @return void
     */
    protected function prepareForValidation()
    {
        if ($this->has('is_shop_active')) {
            $this->merge([
                'is_shop_active' => filter_var($this->is_shop_active, FILTER_VALIDATE_BOOLEAN),
            ]);
        }
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'is_shop_active.required' => 'Stav e-shopu (aktivní/neaktivní) je povinný.',
            'maintenance_message.max' => 'Zpráva o údržbě může mít maximálně 255 znaků.',
        ];
    }
}