<?php
/**
 * @file SaveProjectApprovalRequest.php
 * @path app/Http/Requests/Web/WebProject/SaveProjectApprovalRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New / changed approval request (administration): title, description, checkpoint
 *   of the same project, due date, new files and files to remove. On a change every field is
 *   optional.
 * @dependencies WebProjectApprovalController, App\Support\Uploads\AttachmentPolicy
 */

namespace App\Http\Requests\Web\WebProject;

use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveProjectApprovalRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /**
     * @description Fields; the checkpoint must belong to the project of the URL.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->route('approvalId') ? 'sometimes' : 'required';

        return [
            'title'                   => [$required, 'string', 'max:200'],
            'description'             => ['nullable', 'string', 'max:20000'],
            'checkpoint_id'           => ['nullable', 'integer',
                Rule::exists('web_project_checkpoints', 'id')->where('project_id', (int) $this->route('projectId'))],
            'due_date'                => ['nullable', 'date_format:Y-m-d'],
            'attachments'             => ['nullable', 'array', 'max:' . AttachmentPolicy::PROFILES[AttachmentPolicy::PROJECT_THREAD]['max_files']],
            'attachments.*'           => AttachmentPolicy::fileRules(AttachmentPolicy::PROJECT_THREAD),
            'remove_attachment_ids'   => ['sometimes', 'array'],
            'remove_attachment_ids.*' => ['integer'],
        ];
    }
}
