<?php

/**
 * @file SaveSetRequest.php
 * @path app/Apps/JsCreator/Http/Requests/SaveSetRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New set / save of a set: name, optional caption pattern (empty = the pattern of
 *   the first template) and the templates in their order (at most CreatorSet::MAX_TEMPLATES, no
 *   repeats). Ownership, section, trash and the kinds of the fields are checked by the
 *   controller.
 * @dependencies CreatorSet, UpdateTemplateRequest (MAX_CAPTION).
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\Models\CreatorSet;
use Illuminate\Foundation\Http\FormRequest;

class SaveSetRequest extends FormRequest
{
    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Name, caption pattern and template ids.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name'             => ['required', 'string', 'max:120', 'not_regex:/[\x00-\x1F\x7F]/'],
            'caption_template' => ['nullable', 'string', 'max:' . UpdateTemplateRequest::MAX_CAPTION, 'not_regex:/[\x00-\x09\x0B-\x1F\x7F]/'],
            'template_ids'     => ['present', 'array', 'max:' . CreatorSet::MAX_TEMPLATES],
            'template_ids.*'   => ['integer', 'min:1', 'distinct'],
        ];
    }

    /**
     * @description Trims the name; an empty caption pattern is stored as null.
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
        if ($this->input('caption_template') === '') {
            $this->merge(['caption_template' => null]);
        }
    }
}
