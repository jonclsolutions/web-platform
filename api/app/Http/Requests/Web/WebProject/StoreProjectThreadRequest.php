<?php
/**
 * @file StoreProjectThreadRequest.php
 * @path app/Http/Requests/Web/WebProject/StoreProjectThreadRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation for the customer opening a new project thread (first
 * message). `attachments.*` optional - the customer may attach files to their very
 * first message, same allowed types as replies (see StoreProjectThreadMessageRequest).
 */

namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;
use App\Support\Uploads\AttachmentPolicy;

class StoreProjectThreadRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'subject'        => ['required', 'string', 'max:255'],
            'priority'       => ['required', 'in:low,medium,high,critic'],
            'body'           => ['required', 'string'],
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