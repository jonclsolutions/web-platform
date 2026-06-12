<?php

namespace App\Http\Requests\Core\CoreSiteSettings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCoreSiteSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'is_shop_active'      => 'required|in:0,1,true,false,boolean',
            'maintenance_message' => 'nullable|string|max:255',
        ];
    }

    protected function prepareForValidation()
    {
        if ($this->has('is_shop_active')) {
            $this->merge([
                'is_shop_active' => filter_var($this->is_shop_active, FILTER_VALIDATE_BOOLEAN),
            ]);
        }
    }

    public function messages(): array
    {
        return [
            'is_shop_active.required' => 'Stav e-shopu (aktivní/neaktivní) je povinný.',
            'maintenance_message.max' => 'Zpráva o údržbě může mít maximálně 255 znaků.',
        ];
    }
}