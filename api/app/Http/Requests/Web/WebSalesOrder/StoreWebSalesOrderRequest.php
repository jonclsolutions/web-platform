<?php
/**
 * @file StoreWebSalesOrderRequest.php
 * @path app/Http/Requests/Web/WebSalesOrder/StoreWebSalesOrderRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Validation logic for creating new sales orders, including file attachments and required agreements.
 *
 * @security `lead_id` was validated with `exists` on this PUBLIC request - the
 *   different 422 answers let anyone probe which lead ids exist (open finding #2). The field is
 *   gone: the lead is resolved only from the unguessable `lead_token` in the controller.
 */

namespace App\Http\Requests\Web\WebSalesOrder;

use App\Rules\AttachmentsTotalSize;
use Illuminate\Foundation\Http\FormRequest;
use App\Services\Web\WebApp;
use App\Support\Uploads\AttachmentPolicy;

/**
 * @description Handles request validation for new sales order submission.
 * @note Implements strict file extension and size validation to ensure security.
 */
class StoreWebSalesOrderRequest extends FormRequest
{
    /** @description Limits and allowed types of the upload profile (AttachmentPolicy - shared with GET upload-rules). */
    private const LIMITS = WebApp::UPLOAD_PROFILES[WebApp::UPLOAD_SALES_ORDER];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'salesman_name'     => 'sometimes|nullable|string|max:255',
            'client_name'       => 'required|string|max:255',
            'client_email'      => 'required|email|max:255',
            'order_description' => 'required|string',
            'ico'               => 'nullable|string|max:20',
            'client_address'    => 'nullable|string|max:500',
            'client_phone'      => 'nullable|string|max:20',
            'lang'              => 'sometimes|nullable|string|max:5',
            'attachments'       => ['nullable', 'array', 'max:' . self::LIMITS['max_files'], new AttachmentsTotalSize(self::LIMITS['max_total_bytes'])],
            'attachments.*'     => AttachmentPolicy::fileRules(WebApp::UPLOAD_SALES_ORDER),
            'dataProcessingAgreement' => 'required|accepted',
            'tosAgreement'            => 'required|accepted',
        ];
    }

    public function messages(): array
    {
        return [
            'attachments.max'                  => 'You can upload a maximum of ' . self::LIMITS['max_files'] . ' files.',
            'attachments.*.mimes'              => 'This file type is not allowed. Please upload a standard document, image, video, or archive.',
            'attachments.*.extensions'         => 'This file type is not allowed. Please upload a standard document, image, video, or archive.',
            'attachments.*.max'                => 'Each file may not be greater than 20 MB.',
            'dataProcessingAgreement.accepted' => 'You must agree to data processing to submit.',
            'tosAgreement.accepted'            => 'You must agree to the terms of service to submit.',
        ];
    }
}