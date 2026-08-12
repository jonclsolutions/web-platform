<?php
/**
 * @file StoreWebRawRequestCommissionRequest.php
 * @path app/Http/Requests/Web/WebRawRequestCommission/StoreWebRawRequestCommissionRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for creating new commission requests from the web, including secure file attachment handling.
 *
 * @refactor-note (2026-08) `attachment` (jeden soubor) nahrazeno `attachments` (pole,
 * max. 10 souborů, každý max. 20 MB, souhrnně max. 50 MB) - viz AttachmentsTotalSize
 * pravidlo a HandlesAttachments trait v kontroleru.
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

    /** @description Max. počet příloh na jeden request. */
    private const MAX_ATTACHMENTS = 10;

    /** @description Max. velikost jednoho souboru v kB (Laravel `max:` pravidlo je v kB). */
    private const MAX_FILE_SIZE_KB = 20480; // 20 MB

    /** @description Max. souhrnná velikost všech příloh v bytech. */
    private const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'thema'             => ['required', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\s\.\-]+$/u'],
            'contact_email'     => ['required', 'email', 'max:255'],
            'contact_phone'     => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
            'order_description' => ['required', 'string', 'max:10000'],
            'status'            => ['sometimes', 'string', 'in:Nově zadané,Zpracovává se,Dokončeno,Zrušeno'],
            'priority'          => ['sometimes', 'string', 'in:Nízká,Neutrální,Vysoká'],
            'note'              => ['nullable', 'string'],
            'attachments'       => ['nullable', 'array', 'max:' . self::MAX_ATTACHMENTS, new AttachmentsTotalSize(self::MAX_TOTAL_SIZE_BYTES)],
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

    public function messages(): array
    {
        return [
            'thema.required'                => 'Téma musí mít 3-255 znaků.',
            'thema.min'                     => 'Téma musí mít 3-255 znaků.',
            'thema.max'                     => 'Téma musí mít 3-255 znaků.',
            'thema.regex'                   => 'Téma obsahuje nepovolené znaky.',
            'contact_email.required'        => 'Zadejte platnou e-mailovou adresu.',
            'contact_email.email'           => 'Zadejte platnou e-mailovou adresu.',
            'contact_phone.regex'           => 'Zadejte platné telefonní číslo.',
            'order_description.required'    => 'Popis je povinný pro zpracování.',
            'attachments.max'               => 'Můžete nahrát maximálně ' . self::MAX_ATTACHMENTS . ' souborů.',
            'attachments.*.max'             => 'Každý soubor může mít maximálně 20 MB.',
            'attachments.*.file'            => 'Příloha musí být platný soubor.',
        ];
    }
}