<?php

/**
 * @file SavePresetRequest.php
 * @path app/Apps/JsCreator/Http/Requests/SavePresetRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New preset / overwrite of a preset (saved filling of the form of generating):
 *   name, the values and - for a new preset - its template (`template_id`) or set (`set_id`),
 *   exactly one of them. The values are checked strictly by PresetValues from the raw JSON body;
 *   ownership, section, trash and the limit are checked by the controller.
 * @note presetValues() reads the values from the raw JSON body: the global middleware trims texts and
 *   turns empty texts into null, which would change what the user typed.
 * @dependencies PresetController, PresetValues.
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SavePresetRequest extends FormRequest
{
    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Name, owner (only when creating) and values.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [
            'name'   => ['required', 'string', 'max:120', 'not_regex:/[\x00-\x1F\x7F]/'],
            'values' => ['required', 'array'],
        ];
        if ($this->isMethod('post')) {
            $rules['template_id'] = ['required_without:set_id', 'prohibits:set_id', 'integer', 'min:1'];
            $rules['set_id'] = ['required_without:template_id', 'integer', 'min:1'];
        }

        return $rules;
    }

    /**
     * @description The values exactly as the browser sent them (raw JSON body, at most 16 levels).
     * @return mixed Decoded values; null when the body has none.
     */
    public function presetValues(): mixed
    {
        $body = json_decode($this->getContent(), true, 16);

        return is_array($body) && array_key_exists('values', $body) ? $body['values'] : null;
    }

    /**
     * @description Trims the name.
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }
}
