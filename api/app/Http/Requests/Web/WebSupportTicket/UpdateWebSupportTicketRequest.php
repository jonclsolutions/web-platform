<?php
/**
 * @file UpdateWebSupportTicketRequest.php
 * @path app/Http/Requests/Web/WebSupportTicket/UpdateWebSupportTicketRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation logic for updating existing support tickets.
 */

namespace App\Http\Requests\Web\WebSupportTicket;

use Illuminate\Foundation\Http\FormRequest;
use App\Support\Uploads\AttachmentPolicy;

/**
 * @description Handles request validation for updating existing support ticket data and attachments.
 */
class UpdateWebSupportTicketRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool { return true; }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {

        return [
            'priority'         => ['sometimes', 'required', 'string', 'max:50', 'in:low,medium,high'],
            'category'         => ['sometimes', 'required', 'string', 'max:100', 'in:it,business,bug,other'],
            'state'            => ['sometimes', 'required', 'string', 'max:50', 'in:new,open,closed'],
            'subject'          => ['sometimes', 'required', 'string', 'max:255'],
            'description'      => ['sometimes', 'required', 'string'],
            'user_name_plain'  => ['sometimes', 'required', 'string', 'max:255'],
            'user_plain'       => ['sometimes', 'required', 'string', 'max:255'],
            'attachment'       => ['nullable', ...AttachmentPolicy::fileRules(AttachmentPolicy::SUPPORT_TICKET)],
        ];
    }

    /**
     * Get custom error messages for validation rules.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'attachment.max'   => 'The file must not be larger than 20 MB.',
            'attachment.mimes' => 'This file type is not allowed. Only images, PDFs, text/spreadsheet files, and ZIP archives are permitted.',
            'attachment.extensions' => 'This file type is not allowed. Only images, PDFs, text/spreadsheet files, and ZIP archives are permitted.',
        ];
    }
}