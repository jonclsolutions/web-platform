<?php
/**
 * @file UpdateSiteSettingRequest.php
 * @path app/Http/Requests/Legal/Config/UpdateSiteSettingRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating core site settings including company identification and visual branding assets.
 */

namespace App\Http\Requests\Legal\Config;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for site-wide settings updates, covering company info and logo file handling.
 */
class UpdateSiteSettingRequest extends FormRequest
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
            'company_name'   => 'required|string|max:255',
            'ico'            => 'required|string|max:20',
            'dic'            => 'nullable|string|max:20',
            'brand_tagline'  => 'nullable|string|max:255',
            'copyright_text' => 'nullable|string|max:255',
            'contact_email'  => 'required|email|max:255',
            'contact_phone'  => 'nullable|string|max:30',
            'address'        => 'required|string|max:500',
            'footer_text'    => 'nullable|string|max:1000',
            'logo_file'      => 'nullable|file|image|mimes:jpeg,png,jpg,svg|max:2048',
        ];
    }
}