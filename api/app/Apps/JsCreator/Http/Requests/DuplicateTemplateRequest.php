<?php
/**
 * @file DuplicateTemplateRequest.php
 * @path app/Apps/JsCreator/Http/Requests/DuplicateTemplateRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation of a copy of a template: the name of the copy and optionally another
 *   size ("duplicate to another format" - both width and height, or neither).
 * @dependencies TemplateSize (limits of the size).
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\Support\TemplateSize;
use Illuminate\Foundation\Http\FormRequest;

class DuplicateTemplateRequest extends FormRequest
{
    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Name 1-120 characters; width and height 100-3000 px together, or neither.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name'   => ['required', 'string', 'max:120', 'not_regex:/[\x00-\x1F\x7F]/'],
            'width'  => ['nullable', 'required_with:height', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
            'height' => ['nullable', 'required_with:width', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
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
