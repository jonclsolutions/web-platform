<?php
/**
 * @file StoreWebSupportTicketRequest.php
 * @path app/Http/Requests/Web/WebSupportTicket/StoreWebSupportTicketRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new support tickets, including file attachment constraints.
 */

namespace App\Http\Requests\Web\WebSupportTicket;

use Illuminate\Foundation\Http\FormRequest;

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
        $safeExtensions = [
            'pdf', 'doc', 'docx', 'dotx', 'odt', 'pages', 'rtf', 'txt', 'csv',
            'xls', 'xlsx', 'xlsm', 'xltx', 'ods', 'numbers', 'ppt', 'pptx', 'key',
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif', 'heic', 'heif', 'psd', 'ai', 'eps',
            'zip', 'rar', '7z', 'tar', 'gz',
            'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
            'mp4', 'mov', 'avi', 'wmv', 'mkv', 'webm',
            'dwg', 'dxf', 'stp', 'step', 'stl', 'obj'
        ];

        return [
            'user_id'          => ['nullable', 'integer', 'exists:users,id'],
            'user_name_plain'  => ['nullable', 'string', 'max:255'],
            'user_plain'       => ['nullable', 'email', 'max:255'],
            'category'         => ['required', 'string', 'max:100'],
            'subject'          => ['required', 'string', 'max:255'],
            'description'      => ['required', 'string'],
            'priority'         => ['nullable', 'string', 'max:50', 'in:low,medium,high'],
            
            'attachment'       => [
                'nullable', 
                'file', 
                'mimes:' . implode(',', $safeExtensions), 
                'max:20480'
            ],
        ];
    }
}