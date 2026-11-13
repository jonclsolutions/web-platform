<?php
/**
 * @file SaveProjectUpdateRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/SaveProjectUpdateRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New / changed update of the supplier (administration): title, text, publish
 *   (a draft is seen by the team only), new files (project_thread upload rules) and files to
 *   remove. On a change every field is optional.
 * @dependencies ProjectUpdateController, App\Support\Uploads\AttachmentPolicy
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use App\Apps\ProjectPortal\ProjectPortalApp;
use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Foundation\Http\FormRequest;

class SaveProjectUpdateRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /**
     * @description Fields; title + text required when creating.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('post') && !$this->route('updateId') ? 'required' : 'sometimes';

        return [
            'title'                   => [$required, 'string', 'max:200'],
            'body'                    => [$required, 'string', 'max:20000'],
            'publish'                 => ['sometimes', 'boolean'],
            'attachments'             => ['nullable', 'array', 'max:' . ProjectPortalApp::UPLOAD_PROFILES[ProjectPortalApp::UPLOAD_PROJECT_THREAD]['max_files']],
            'attachments.*'           => AttachmentPolicy::fileRules(ProjectPortalApp::UPLOAD_PROJECT_THREAD),
            'remove_attachment_ids'   => ['sometimes', 'array'],
            'remove_attachment_ids.*' => ['integer'],
        ];
    }
}
