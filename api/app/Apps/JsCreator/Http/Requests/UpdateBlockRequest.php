<?php

/**
 * @file UpdateBlockRequest.php
 * @path app/Apps/JsCreator/Http/Requests/UpdateBlockRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Save of the block editor: name, size, the version the editor started from and the
 *   document (validated by the controller - DocumentCheck, no block instances).
 * @dependencies TemplateSize.
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\Support\TemplateSize;
use Illuminate\Foundation\Http\FormRequest;

class UpdateBlockRequest extends FormRequest
{
    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Every property of the block is sent with each save.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'max:120', 'not_regex:/[\x00-\x1F\x7F]/'],
            'width'    => ['required', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
            'height'   => ['required', 'integer', 'min:' . TemplateSize::MIN, 'max:' . TemplateSize::MAX],
            'version'  => ['required', 'integer', 'min:1'],
            'document' => ['required', 'array'],
        ];
    }

    /**
     * @description The document exactly as the editor sent it (raw JSON body, at most 64 levels).
     * @return mixed The decoded document; null when the body is not JSON with a document.
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
