<?php
/**
 * @file StoreWebSalesOrderRequest.php
 * @path app/Http/Requests/Web/WebSalesOrder/StoreWebSalesOrderRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for creating new sales orders, including file attachments and required agreements.
 */

namespace App\Http\Requests\Web\WebSalesOrder;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule; 
use App\Models\Web\WebSalesLead;

/**
 * @description Handles request validation for new sales order submission.
 * @note Implements strict file extension and size validation to ensure security.
 */
class StoreWebSalesOrderRequest extends FormRequest
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
            'lead_id'           => ['nullable', Rule::exists(WebSalesLead::class, 'id')],
            'salesman_name'     => 'sometimes|nullable|string|max:255',
            'client_name'       => 'required|string|max:255',
            'client_email'      => 'required|email|max:255',
            'order_description' => 'required|string',
            'ico'               => 'nullable|string|max:20',
            'client_address'    => 'nullable|string|max:500',
            'client_phone'      => 'nullable|string|max:20',
            
            'attachment'        => [
                'nullable',
                'file',
                'max:20480',
                'mimes:' . implode(',', $safeExtensions),
            ],
            'dataProcessingAgreement' => 'required|accepted',
            'tosAgreement'            => 'required|accepted',
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
            'attachment.mimes' => 'Tento typ souboru není povolen. Nahrajte prosím běžný dokument, obrázek, video nebo archiv.',
            'attachment.max' => 'Maximální velikost souboru je 20 MB.',
            'dataProcessingAgreement.accepted' => 'Pro odeslání musíte souhlasit se zpracováním údajů.',
            'tosAgreement.accepted' => 'Pro odeslání musíte souhlasit s obchodními podmínkami.',
        ];
    }
}