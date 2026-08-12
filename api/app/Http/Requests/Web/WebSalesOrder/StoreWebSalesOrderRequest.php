<?php
/**
 * @file StoreWebSalesOrderRequest.php
 * @path app/Http/Requests/Web/WebSalesOrder/StoreWebSalesOrderRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for creating new sales orders, including file attachments and required agreements.
 *
 * @refactor-note (2026-08) `attachment` (jeden soubor) nahrazeno `attachments` (pole,
 * max. 10 souborů, každý max. 20 MB, souhrnně max. 50 MB) - sjednoceno se stejnou
 * politikou jako StoreWebRawRequestCommissionRequest.
 */

namespace App\Http\Requests\Web\WebSalesOrder;

use App\Rules\AttachmentsTotalSize;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\Web\WebSalesLead;

/**
 * @description Handles request validation for new sales order submission.
 * @note Implements strict file extension and size validation to ensure security.
 */
class StoreWebSalesOrderRequest extends FormRequest
{
    private const MAX_ATTACHMENTS = 10;
    private const MAX_FILE_SIZE_KB = 20480; // 20 MB
    private const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

    public function authorize(): bool
    {
        return true;
    }

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
            'attachments'       => ['nullable', 'array', 'max:' . self::MAX_ATTACHMENTS, new AttachmentsTotalSize(self::MAX_TOTAL_SIZE_BYTES)],
            'attachments.*'     => [
                'file',
                'max:' . self::MAX_FILE_SIZE_KB,
                'mimes:' . implode(',', $safeExtensions),
            ],
            'dataProcessingAgreement' => 'required|accepted',
            'tosAgreement'            => 'required|accepted',
        ];
    }

    public function messages(): array
    {
        return [
            'attachments.max'                  => 'Můžete nahrát maximálně ' . self::MAX_ATTACHMENTS . ' souborů.',
            'attachments.*.mimes'              => 'Tento typ souboru není povolen. Nahrajte prosím běžný dokument, obrázek, video nebo archiv.',
            'attachments.*.max'                => 'Každý soubor může mít maximálně 20 MB.',
            'dataProcessingAgreement.accepted' => 'Pro odeslání musíte souhlasit se zpracováním údajů.',
            'tosAgreement.accepted'            => 'Pro odeslání musíte souhlasit s obchodními podmínkami.',
        ];
    }
}