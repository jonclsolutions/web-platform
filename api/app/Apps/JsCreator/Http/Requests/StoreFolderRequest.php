<?php
/**
 * @file StoreFolderRequest.php
 * @path app/Apps/JsCreator/Http/Requests/StoreFolderRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New folder of the own workspace: name and optional parent (an own folder outside
 *   the trash - checked by FolderController, which answers 404 for another one).
 * @dependencies FolderController::store()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFolderRequest extends FormRequest
{
    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Name 1-120 characters without control characters; parent id or null.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name'      => ['required', 'string', 'max:120', 'not_regex:/[\x00-\x1F\x7F]/'],
            'parent_id' => ['nullable', 'integer', 'min:1'],
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
