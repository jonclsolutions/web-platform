<?php
/**
 * @file UpdateWebSalesOrderRequest.php
 * @path app/Apps/Web/Http/Requests/WebSalesOrder/UpdateWebSalesOrderRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Validation logic for updating existing sales orders.
 */

namespace App\Apps\Web\Http\Requests\WebSalesOrder;

use App\Rules\AttachmentsTotalSize;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Apps\Web\Models\WebSalesLead;
use App\Apps\Web\WebApp;
use App\Support\Uploads\AttachmentPolicy;

/**
 * @description Handles request validation for updating existing sales order data.
 */
class UpdateWebSalesOrderRequest extends FormRequest
{
    /** @description Limits and allowed types of the upload profile (AttachmentPolicy - shared with GET upload-rules). */
    private const LIMITS = WebApp::UPLOAD_PROFILES[WebApp::UPLOAD_SALES_ORDER];

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
            'lead_id'           => ['sometimes', 'nullable', Rule::exists(WebSalesLead::class, 'id')],
            'salesman_name'     => 'sometimes|required|string|max:255',
            'ico'               => 'nullable|string|max:20',
            'client_name'       => 'sometimes|required|string|max:255',
            'client_address'    => 'nullable|string|max:500',
            'client_phone'      => 'nullable|string|max:255',
            'client_email'      => 'nullable|email|max:255',
            'order_description' => 'nullable|string',
            'attachments'       => ['sometimes', 'nullable', 'array', 'max:' . self::LIMITS['max_files'], new AttachmentsTotalSize(self::LIMITS['max_total_bytes'])],
            'attachments.*'     => AttachmentPolicy::fileRules(WebApp::UPLOAD_SALES_ORDER),
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
            'attachments.max'      => 'You can add a maximum of ' . self::LIMITS['max_files'] . ' files at once.',
            'attachments.*.mimes'  => 'This file type is not allowed. Please upload a standard document, image, video, or archive.',
            'attachments.*.extensions' => 'This file type is not allowed. Please upload a standard document, image, video, or archive.',
            'attachments.*.max'    => 'The attachment file must not exceed 20 MB.',
        ];
    }
}