<?php

/**
 * @file StoreBlockRequest.php
 * @path app/Apps/JsCreator/Http/Requests/StoreBlockRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New block: name and size, optionally with its document ("block from the selection"
 *   of the template editor sends the selected layers; otherwise the block starts empty with a
 *   transparent background). The document is validated by the controller (DocumentCheck).
 * @dependencies TemplateSize.
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\Support\TemplateSize;
use Illuminate\Foundation\Http\FormRequest;

class StoreBlockRequest extends FormRequest
{
    /** @description Access is decided by the route (permission). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Name 1-120 characters without control characters; width and height 100-3000 px;
     *   optional document.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'max:120', 'not_regex:/[\x00-\x1F\x7F]/'],
            'width'    => ['required', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
            'height'   => ['required', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
            'document' => ['sometimes', 'array'],
        ];
    }

    /**
     * @description The document exactly as the editor sent it (raw JSON body, at most 64 levels).
     * @return mixed The decoded document; null when the body has none.
     */
    public function document(): mixed
    {
        $body = json_decode($this->getContent(), true, 64);

        return is_array($body) && array_key_exists('document', $body) ? $body['document'] : null;
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
