<?php
/**
 * @file StoreWebRawRequestCommissionRequest.php
 * @path app/Http/Requests/Web/WebRawRequestCommission/StoreWebRawRequestCommissionRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Validation logic for creating new commission requests from the web, including secure file attachment handling.
 */

namespace App\Http\Requests\Web\WebRawRequestCommission;

use App\Rules\AttachmentsTotalSize;
use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for store requests, ensuring input hygiene and secure file uploads.
 */
class StoreWebRawRequestCommissionRequest extends FormRequest
{
    use ValidatesAttachmentSecurity;

    /** @var int Maximum number of files in one request (same as the update). */
    private const MAX_ATTACHMENTS = 10;

    /** @var int Maximum size of one file in KB (20 MB). */
    private const MAX_FILE_SIZE_KB = 20480;

    /** @var int Maximum size of all files together (50 MB). */
    private const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024;

    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return [
            'thema'             => ['required', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\s\.\-_]+$/u'],
            'contact_email'     => ['required', 'email', 'max:255'],
            'contact_phone'     => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
            'order_description' => ['required', 'string', 'max:10000'],
            'status'            => ['sometimes', 'string', 'in:new,in_progress,done,cancelled'],
            'priority'          => ['sometimes', 'string', 'in:low,neutral,high'],
            'note'              => ['nullable', 'string'],
            'lang'              => ['sometimes', 'nullable', 'string', 'max:5'],
            'attachments'       => ['sometimes', 'nullable', 'array', 'max:' . self::MAX_ATTACHMENTS, new AttachmentsTotalSize(self::MAX_TOTAL_SIZE_BYTES)],
            'attachments.*'     => ['file', 'max:' . self::MAX_FILE_SIZE_KB, $this->attachmentExtensionRule()],
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

    /**
     * Get custom error messages for validation rules.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'thema.required'                => 'The subject must be between 3 and 255 characters.',
            'thema.min'                     => 'The subject must be between 3 and 255 characters.',
            'thema.max'                     => 'The subject must be between 3 and 255 characters.',
            'thema.regex'                   => 'The subject contains invalid characters.',
            'contact_email.required'        => 'Please provide a valid email address.',
            'contact_email.email'           => 'Please provide a valid email address.',
            'contact_phone.regex'           => 'Please provide a valid phone number.',
            'order_description.required'    => 'The description is required for processing.',
            'attachments.max'               => 'You can upload a maximum of ' . self::MAX_ATTACHMENTS . ' files at once.',
            'attachments.*.max'             => 'Each file may not be greater than 20 MB.',
            'attachments.*.file'            => 'The attachment must be a valid file.',
        ];
    }
}