<?php
/**
 * @file StoreProjectThreadMessageRequest.php
 * @path app/Http/Requests/Web/WebProject/StoreProjectThreadMessageRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation for a single reply within an existing thread - used by
 * BOTH the customer's public reply endpoint and the admin's reply endpoint (shared
 * request class, same allowed attachment types on both sides). `is_internal` (an internal note
 * of the team) is read only by the admin endpoint - the portal ignores it.
 */

namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;
use App\Support\Uploads\AttachmentPolicy;

class StoreProjectThreadMessageRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'body'           => ['required', 'string', 'max:20000'],
            'is_internal'    => ['sometimes', 'boolean'],
            'attachments'    => ['nullable', 'array', 'max:' . AttachmentPolicy::PROFILES[AttachmentPolicy::PROJECT_THREAD]['max_files']],
            'attachments.*'  => AttachmentPolicy::fileRules(AttachmentPolicy::PROJECT_THREAD),
        ];
    }

    public function messages(): array
    {
        return [
            'attachments.max'      => 'You can attach at most 5 files.',
            'attachments.*.file'   => 'One of the attached files is invalid.',
            'attachments.*.max'    => 'Each file can be at most 15 MB.',
            'attachments.*.mimes'  => 'One of the attached files has an unsupported format.',
            'attachments.*.extensions' => 'One of the attached files has an unsupported format.',
        ];
    }
}