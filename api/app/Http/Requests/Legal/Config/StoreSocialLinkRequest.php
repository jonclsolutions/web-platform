<?php
/**
 * @file StoreSocialLinkRequest.php
 * @path app/Http/Requests/Legal/Config/StoreSocialLinkRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new social media link configurations.
 */

namespace App\Http\Requests\Legal\Config;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for storing social media links.
 */
class StoreSocialLinkRequest extends FormRequest
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
            'name'      => 'required|string',
            'url'       => 'required|url',
            'icon_path' => 'required|string',
            'position'  => 'integer'
        ];
    }
}