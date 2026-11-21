<?php
/**
 * @file UpdateFontRequest.php
 * @path app/Apps/JsCreator/Http/Requests/UpdateFontRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Change of the face of an own font (family, weight, style) - the file stays.
 * @dependencies StoreFontRequest::faceRules(), FontController::update()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFontRequest extends FormRequest
{
    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description The face rules of an upload.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return StoreFontRequest::faceRules();
    }

    /**
     * @description Trims the family before validation.
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('family'))) {
            $this->merge(['family' => trim($this->input('family'))]);
        }
    }
}
