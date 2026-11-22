<?php
/**
 * @file UpdateOutputRequest.php
 * @path app/Apps/JsCreator/Http/Requests/UpdateOutputRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Rename and / or move an output of the own workspace (`folder_id` null = to the top
 *   level). The picture and the text of the post never change. The ownership of the folder is
 *   checked by OutputController.
 * @dependencies OutputController::update()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOutputRequest extends FormRequest
{
    /** @description Access is decided by the route (permission) and the controller (ownership). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Name 1-150 characters without control characters; folder id or null.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name'      => ['sometimes', 'string', 'min:1', 'max:150', 'not_regex:/[\x00-\x1F\x7F]/'],
            'folder_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }
}
