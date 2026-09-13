<?php
/**
 * @file StoreProjectThreadMessageRequest.php
 * @path app/Http/Requests/Web/WebProject/StoreProjectThreadMessageRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation for a single reply within an existing thread - used by
 * BOTH the customer's public reply endpoint and the admin's reply endpoint (shared
 * request class, same allowed attachment types on both sides).
 */

namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectThreadMessageRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
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