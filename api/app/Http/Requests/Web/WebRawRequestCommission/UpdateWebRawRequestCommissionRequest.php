<?php
/**
 * @file UpdateWebRawRequestCommissionRequest.php
 * @path app/Http/Requests/Web/WebRawRequestCommission/UpdateWebRawRequestCommissionRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Validation logic for updating existing commission requests, including secure file handling.
 */

namespace App\Http\Requests\Web\WebRawRequestCommission;

use App\Rules\AttachmentsTotalSize;
use App\Services\Web\WebApp;
use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for update requests, ensuring data consistency and security.
 */
class UpdateWebRawRequestCommissionRequest extends FormRequest
{
use ValidatesAttachmentSecurity;

/** @description Limits and allowed types of the upload profile (AttachmentPolicy - shared with GET upload-rules). */
private const LIMITS = WebApp::UPLOAD_PROFILES[WebApp::UPLOAD_RAW_REQUEST_COMMISSION];

public function authorize(): bool
    {
return true;
    }

public function rules(): array
    {
return [
'thema'             => ['required', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\s\.\-_]+$/u'],
'contact_email'              => ['sometimes', 'email', 'max:255'],
'contact_phone'              => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
'order_description'          => ['sometimes', 'string', 'max:10000'],
'status'   => ['sometimes', 'string', 'in:new,in_progress,done,cancelled'],
'priority' => ['sometimes', 'string', 'in:low,neutral,high'],
'note'                       => ['sometimes', 'nullable', 'string'],
'attachments'                => ['sometimes', 'nullable', 'array', 'max:' . self::LIMITS['max_files'], new AttachmentsTotalSize(self::LIMITS['max_total_bytes'])],
'attachments.*'              => AttachmentPolicy::fileRules(WebApp::UPLOAD_RAW_REQUEST_COMMISSION),
'attachments_removed_ids'    => ['sometimes', 'array'],
'attachments_removed_ids.*'  => ['integer'],
        ];
    }

/**
     * Perform additional MIME type validation to prevent malicious file uploads.
     *
     * @param \Illuminate\Validation\Validator $validator
     * @return void
     */
public function withValidator($validator)
    {
$validator->after(fn ($v) => $this->validateAttachmentMime($v));
    }

public function messages(): array
    {
return [
'thema.min'                          => 'The subject must be between 3 and 255 characters.',
'thema.max'                          => 'The subject must be between 3 and 255 characters.',
'thema.regex'                        => 'The subject contains invalid characters.',
'contact_email.email'                => 'Please provide a valid email address.',
'contact_phone.regex'                => 'Please provide a valid phone number.',
'order_description.max'              => 'The request description is too long.',
'attachments.max'                    => 'You can upload a maximum of ' . self::LIMITS['max_files'] . ' files at once.',
'attachments.*.max'                  => 'Each file may not be greater than 20 MB.',
'attachments.*.file'                 => 'The attachment must be a valid file.',
'attachments.*.mimes'                => 'This file type is not allowed for security reasons.',
'attachments.*.extensions'           => 'This file type is not allowed for security reasons.',
'attachments_removed_ids.array'      => 'Invalid format for the removed attachments list.',
'attachments_removed_ids.*.integer'  => 'Invalid ID for the removed attachment.',
        ];
    }
}