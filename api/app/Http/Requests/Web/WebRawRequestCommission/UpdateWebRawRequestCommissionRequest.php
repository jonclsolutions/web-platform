<?php
/**
 * @file UpdateWebRawRequestCommissionRequest.php
 * @path app/Http/Requests/Web/WebRawRequestCommission/UpdateWebRawRequestCommissionRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for updating existing commission requests, including secure file handling.
 */

namespace App\Http\Requests\Web\WebRawRequestCommission;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for update requests, ensuring data consistency and security.
 */
class UpdateWebRawRequestCommissionRequest extends FormRequest
{
    use ValidatesAttachmentSecurity;

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
            'thema'             => ['sometimes', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\s\.\-]+$/u'],
            'contact_email'     => ['sometimes', 'email', 'max:255'],
            'contact_phone'     => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
            'order_description' => ['sometimes', 'string', 'max:10000'],
            'status'            => ['sometimes', 'string', 'in:Nově zadané,Zpracovává se,Dokončeno,Zrušeno'],
            'priority'          => ['sometimes', 'string', 'in:Nízká,Neutrální,Vysoká'],
            'note'              => ['sometimes', 'nullable', 'string'],
            'attachment'        => ['sometimes', 'nullable', 'file', 'max:10240', $this->attachmentExtensionRule()],
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
            'thema.min'                     => 'Téma musí mít 3-255 znaků.',
            'thema.max'                     => 'Téma musí mít 3-255 znaků.',
            'thema.regex'                   => 'Téma obsahuje nepovolené znaky.',
            'contact_email.email'           => 'Zadejte platnou e-mailovou adresu.',
            'contact_phone.regex'           => 'Zadejte platné telefonní číslo.',
            'order_description.max'         => 'Popis požadavku je příliš dlouhý.',
            'attachment.max'                => 'Soubor je příliš velký. Maximální velikost je 10 MB.',
            'attachment.file'               => 'Příloha musí být platný soubor.',
        ];
    }
}