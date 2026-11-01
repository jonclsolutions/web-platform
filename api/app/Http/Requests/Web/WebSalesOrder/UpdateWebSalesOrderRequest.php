<?php
/**
 * @file UpdateWebSalesOrderRequest.php
 * @path app/Http/Requests/Web/WebSalesOrder/UpdateWebSalesOrderRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Validation logic for updating existing sales orders.
 */

namespace App\Http\Requests\Web\WebSalesOrder;

use App\Rules\AttachmentsTotalSize;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\Web\WebSalesLead;

/**
 * @description Handles request validation for updating existing sales order data.
 */
class UpdateWebSalesOrderRequest extends FormRequest
{
    private const MAX_ATTACHMENTS = 10;
    private const MAX_FILE_SIZE_KB = 20480; // 20 MB
    private const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

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
            'pdf', 'jpg', 'jpeg', 'png', 'zip', 'docx', 'xlsx', 'dwg', 'dxf', 'stp', 'step'
        ];

        return [
            'lead_id'           => ['sometimes', 'nullable', Rule::exists(WebSalesLead::class, 'id')],
            'salesman_name'     => 'sometimes|required|string|max:255',
            'ico'               => 'nullable|string|max:20',
            'client_name'       => 'sometimes|required|string|max:255',
            'client_address'    => 'nullable|string|max:500',
            'client_phone'      => 'nullable|string|max:255',
            'client_email'      => 'nullable|email|max:255',
            'order_description' => 'nullable|string',
            'attachments'       => ['sometimes', 'nullable', 'array', 'max:' . self::MAX_ATTACHMENTS, new AttachmentsTotalSize(self::MAX_TOTAL_SIZE_BYTES)],
            'attachments.*'     => [
                'file',
                'mimes:' . implode(',', $safeExtensions),
                'max:' . self::MAX_FILE_SIZE_KB,
            ],
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
            'attachments.max'      => 'You can add a maximum of ' . self::MAX_ATTACHMENTS . ' files at once.',
            'attachments.*.mimes'  => 'Allowed formats for order attachments are PDF, Word, Excel, CAD formats, or images.',
            'attachments.*.max'    => 'The attachment file must not exceed 20 MB.',
        ];
    }
}