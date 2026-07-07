<?php
/**
 * @file UpdateWebSalesOrderRequest.php
 * @path app/Http/Requests/Web/WebSalesOrder/UpdateWebSalesOrderRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for updating existing sales orders.
 */

namespace App\Http\Requests\Web\WebSalesOrder;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\Web\WebSalesLead;

/**
 * @description Handles request validation for updating existing sales order data.
 */
class UpdateWebSalesOrderRequest extends FormRequest
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
            'attachment'        => [
                'nullable', 
                'file', 
                'mimes:' . implode(',', $safeExtensions), 
                'max:20480'
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
            'attachment.mimes' => 'Povolené formáty pro přílohy objednávek jsou PDF, Word, Excel, CAD formáty nebo obrázky.',
            'attachment.max'   => 'Soubor přílohy nesmí přesáhnout 20 MB.',
        ];
    }
}