<?php
/**
 * @file SaveProjectTemplateRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/SaveProjectTemplateRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New / changed project template: name, description and the full list of its
 *   checkpoints (title, description, due date as days after the start) in their order.
 * @dependencies ProjectTemplateController
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaveProjectTemplateRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /**
     * @description Fields; on a change the checkpoints (when sent) replace the stored ones.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->route('templateId') ? 'sometimes' : 'required';

        return [
            'name'                      => [$required, 'string', 'max:160'],
            'description'               => ['nullable', 'string', 'max:5000'],
            'checkpoints'               => [$required, 'array', 'min:1', 'max:100'],
            'checkpoints.*.label'       => ['required', 'string', 'max:255'],
            'checkpoints.*.description' => ['nullable', 'string', 'max:5000'],
            'checkpoints.*.offset_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
        ];
    }
}
