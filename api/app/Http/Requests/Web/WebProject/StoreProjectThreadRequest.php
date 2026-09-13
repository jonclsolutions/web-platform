<?php
/**
 * @file StoreProjectThreadRequest.php
 * @path app/Http/Requests/Web/WebProject/StoreProjectThreadRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation for the customer opening a new project thread (first
 * message). `attachments.*` optional - the customer may attach files to their very
 * first message, same allowed types as replies (see StoreProjectThreadMessageRequest).
 */

namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectThreadRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'subject'        => ['required', 'string', 'max:255'],
            'priority'       => ['required', 'in:low,medium,high,critic'],
            'body'           => ['required', 'string'],
            'attachments'    => ['nullable', 'array', 'max:5'],
            'attachments.*'  => [
                'file',
                'max:15360',
                'mimes:pdf,doc,docx,odt,rtf,txt,xls,xlsx,ods,csv,ppt,pptx,odp,jpg,jpeg,png,gif,webp,svg,zip,rar,7z',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'attachments.max'      => 'You can attach at most 5 files.',
            'attachments.*.file'   => 'One of the attached files is invalid.',
            'attachments.*.max'    => 'Each file can be at most 15 MB.',
            'attachments.*.mimes'  => 'One of the attached files has an unsupported format.',
        ];
    }
}