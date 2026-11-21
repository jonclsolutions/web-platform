<?php
/**
 * @file UpdateAssetRequest.php
 * @path app/Apps/JsCreator/Http/Requests/UpdateAssetRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Rename an image of the own library.
 * @dependencies AssetController::update()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAssetRequest extends FormRequest
{
    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Name 1-150 characters without control characters.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['name' => ['required', 'string', 'max:150', 'not_regex:/[\x00-\x1F\x7F]/']];
    }

    /**
     * @description Trims the name before validation.
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }
}
