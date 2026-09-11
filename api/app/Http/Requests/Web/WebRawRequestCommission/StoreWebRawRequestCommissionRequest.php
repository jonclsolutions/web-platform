<?php
/**
 * @file StoreWebRawRequestCommissionRequest.php
 * @path app/Http/Requests/Web/WebRawRequestCommission/StoreWebRawRequestCommissionRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for creating new commission requests from the web, including secure file attachment handling.
 *
 * @bugfix-note (2026-08-19) KRITICKÝ BUG - JAZYK POTVRZOVACÍHO E-MAILU SE IGNOROVAL:
 * `rules()` neobsahovala `lang` - Laravel FormRequest validace propouští do
 * `$request->safe()`/`validated()` VÝHRADNĚ pole definovaná v `rules()`, takže i když
 * frontend (`ContactComponent`) `lang` v FormData reálně posílal, `store()`
 * (`$request->safe()->except(['attachments'])`) ho nikdy nedostal a
 * `WebRawRequestCommission::lang` zůstával na defaultu `'cz'` bez ohledu na to, v jakém
 * jazyce byl web přepnutý. Potvrzovací e-mail (`RawRequestEmailTemplate::forLang()`)
 * tak vždy vybíral českou variantu šablony. Přidáno `'lang' => ['sometimes', 'nullable',
 * 'string', 'max:5']` - stejné pravidlo, jaké má `UpdateWebRawRequestCommissionRequest`.
 */

namespace App\Http\Requests\Web\WebRawRequestCommission;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for store requests, ensuring input hygiene and secure file uploads.
 */
class StoreWebRawRequestCommissionRequest extends FormRequest
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
            'thema'             => ['required', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\s\.\-]+$/u'],
            'contact_email'     => ['required', 'email', 'max:255'],
            'contact_phone'     => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
            'order_description' => ['required', 'string', 'max:10000'],
            'status'            => ['sometimes', 'string', 'in:new,in_progress,done,cancelled'],
            'priority'          => ['sometimes', 'string', 'in:low,neutral,high'],
            'note'              => ['nullable', 'string'],
            'lang'              => ['sometimes', 'nullable', 'string', 'max:5'],
            'attachment'        => ['nullable', 'file', 'max:10240', $this->attachmentExtensionRule()],
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
            'attachment.max'                => 'The file is too large. The maximum size is 10 MB.',
            'attachment.file'               => 'The attachment must be a valid file.',
        ];
    }
}