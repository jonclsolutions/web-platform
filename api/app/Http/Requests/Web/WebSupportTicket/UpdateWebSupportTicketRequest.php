<?php
/**
 * @file UpdateWebSupportTicketRequest.php
 * @path app/Http/Requests/Web/WebSupportTicket/UpdateWebSupportTicketRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing support tickets.
 *
 * @refactor-note (2026-08) `$safeExtensions` zúžen shodně se StoreWebSupportTicketRequest -
 * viz jeho hlavička pro odůvodnění. Oba seznamy MUSÍ zůstat identické, jinak by šlo
 * obejít omezení na create tak, že by se nežádoucí typ souboru nahrál až přes update.
 */

namespace App\Http\Requests\Web\WebSupportTicket;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for updating existing support ticket data and attachments.
 */
class UpdateWebSupportTicketRequest extends FormRequest
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
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif',
            'pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx',
            'zip',
        ];

        return [
            'category'         => ['sometimes', 'required', 'string', 'max:100'],
            'priority'         => ['sometimes', 'required', 'string', 'max:50'],
            'state'            => ['sometimes', 'required', 'string', 'max:50'],
            'subject'          => ['sometimes', 'required', 'string', 'max:255'],
            'description'      => ['sometimes', 'required', 'string'],
            'user_name_plain'  => ['sometimes', 'required', 'string', 'max:255'],
            'user_plain'       => ['sometimes', 'required', 'string', 'max:255'],
            'attachment'       => [
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
            'attachment.max'   => 'Soubor nesmí být větší než 20 MB.',
            'attachment.mimes' => 'Tento typ souboru není povolen. Povoleny jsou pouze obrázky, PDF, textové/tabulkové soubory a ZIP archivy.',
        ];
    }
}