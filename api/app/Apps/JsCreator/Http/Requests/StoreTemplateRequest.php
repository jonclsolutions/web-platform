<?php
/**
 * @file StoreTemplateRequest.php
 * @path app/Apps/JsCreator/Http/Requests/StoreTemplateRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation of a new template: its name and size (the document starts empty).
 * @dependencies TemplateSize (limits of the size).
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\Support\TemplateSize;
use Illuminate\Foundation\Http\FormRequest;

class StoreTemplateRequest extends FormRequest
{
    /** @description Access is decided by the route (permission). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Name 1-120 characters without control characters; width and height 100-3000 px.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name'   => ['required', 'string', 'max:120', 'not_regex:/[\x00-\x1F\x7F]/'],
            'width'  => ['required', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
            'height' => ['required', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
        ];
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
