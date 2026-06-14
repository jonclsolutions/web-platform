<?php

namespace App\Http\Requests\Legal\Config;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSiteSettingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'company_name'  => 'required|string|max:255',
            'ico'           => 'required|string|max:20',
            'dic'           => 'nullable|string|max:20',
            'contact_email' => 'required|email|max:255',
            'contact_phone' => 'nullable|string|max:30',
            'address'       => 'required|string|max:500',
            'footer_text'   => 'nullable|string|max:1000',
            // Přidané pravidlo pro nahrání loga
            'logo_file'     => 'nullable|file|image|mimes:jpeg,png,jpg,svg|max:2048',
        ];
    }
}