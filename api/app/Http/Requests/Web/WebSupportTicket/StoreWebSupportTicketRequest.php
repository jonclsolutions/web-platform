<?php
/**
 * @file StoreWebSupportTicketRequest.php
 * @path app/Http/Requests/Web/WebSupportTicket/StoreWebSupportTicketRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation logic for creating new support tickets, including file attachment constraints.
 */

namespace App\Http\Requests\Web\WebSupportTicket;

use Illuminate\Foundation\Http\FormRequest;
use App\Support\Uploads\AttachmentPolicy;

/**
 * @description Handles request validation for new support ticket submissions from web users.
 */
class StoreWebSupportTicketRequest extends FormRequest
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
            'user_id'          => ['nullable', 'integer', 'exists:users,id'],
            'user_name_plain'  => ['nullable', 'string', 'max:255'],
            'user_plain'       => ['nullable', 'email', 'max:255'],
            'category'         => ['required', 'string', 'max:100', 'in:it,business,bug,other'],
            'subject'          => ['required', 'string', 'max:255'],
            'description'      => ['required', 'string'],
            'priority'         => ['nullable', 'string', 'max:50', 'in:low,medium,high'],
            'attachment'       => ['nullable', ...AttachmentPolicy::fileRules(AttachmentPolicy::SUPPORT_TICKET)],
        ];
    }
}